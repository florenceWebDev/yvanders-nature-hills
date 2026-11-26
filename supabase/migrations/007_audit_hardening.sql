-- Apply once after 006; see docs/OPERATIONS.md for release ordering.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- Preserve a coordinated-release hold pause instead of reopening writes mid-release.
create temporary table audit007_release_state on commit drop as
 select has_function_privilege('authenticated','public.create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text,text,time)','EXECUTE') hold_enabled;
create table rate_limit_counters (
 key text primary key check(length(key)<=160), hits integer not null check(hits>0), expires_at timestamptz not null
);
create index rate_limit_expiry on rate_limit_counters(expires_at);
-- No booking FK: deleting a reservation must not reset its hourly allowance.
create table hold_creation_events (
 id bigint generated always as identity primary key, user_id uuid not null,
 created_at timestamptz not null default clock_timestamp()
);
create index hold_creation_window on hold_creation_events(user_id,created_at);
alter table rate_limit_counters enable row level security;
alter table hold_creation_events enable row level security;
revoke all on rate_limit_counters,hold_creation_events from public,anon,authenticated,service_role;
insert into hold_creation_events(user_id,created_at)
 select user_id,created_at from bookings where user_id is not null and created_at>now()-interval '1 hour';

create function consume_rate_limit(p_key text,p_limit integer,p_seconds integer) returns integer
language plpgsql security definer set search_path=public as $$
declare counter rate_limit_counters; stamp timestamptz:=clock_timestamp();
begin
 if p_key is null or length(p_key)>160 or p_limit not between 1 and 10000 or p_seconds not between 1 and 86400 then raise exception 'Invalid limiter configuration'; end if;
 insert into rate_limit_counters values(p_key,1,stamp+make_interval(secs=>p_seconds))
 on conflict(key) do update set
 hits=case when rate_limit_counters.expires_at<=stamp then 1 else least(rate_limit_counters.hits+1,p_limit+1) end,
 expires_at=case when rate_limit_counters.expires_at<=stamp then stamp+make_interval(secs=>p_seconds) else rate_limit_counters.expires_at end
 returning * into counter;
 return case when counter.hits<=p_limit then 0 else greatest(1,ceil(extract(epoch from counter.expires_at-stamp))::integer) end;
end $$;
create function clean_abuse_history() returns void language plpgsql security definer set search_path=public as $$
begin
 delete from rate_limit_counters where key in (select key from rate_limit_counters where expires_at<now()-interval '1 day' limit 1000);
 delete from hold_creation_events where id in (select id from hold_creation_events where created_at<now()-interval '1 day' limit 1000);
end $$;
revoke execute on function consume_rate_limit(text,integer,integer),clean_abuse_history() from public,anon,authenticated;
grant execute on function consume_rate_limit(text,integer,integer),clean_abuse_history() to service_role;
create or replace function public.booking_quote_base(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_arrival_time time) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o offerings; r resources; s timestamptz; e timestamptz; sl jsonb; n integer; cost bigint; taken integer; qty integer;
begin
 select * into o from offerings where id=p_offering and (published or is_admin());
 if not found then raise exception 'Offering is unavailable'; end if;
 select * into r from resources where id=o.resource_id;
 if p_arrival is null or p_arrival<(now() at time zone 'Asia/Manila')::date or p_arrival>(now() at time zone 'Asia/Manila')::date+730 then raise exception 'Choose an arrival within the next two years'; end if;
 if o.price is null then raise exception 'This offering does not have a verified rate'; end if;
 if p_guests is null or p_units is null or p_guests<1 or p_units<1 or p_units>1000 or p_guests>o.max_guests*p_units then raise exception 'Guest count exceeds the offering capacity'; end if;
 if p_arrival_time is null or extract(second from p_arrival_time)<>0 or p_arrival_time>=time '24:00' then raise exception 'Choose an arrival time in whole minutes'; end if;
 n:=p_departure-p_arrival;
 if n is null or n<1 or n>60 then raise exception 'Choose a stay of 1 to 60 days'; end if;
 s:=(p_arrival+p_arrival_time) at time zone 'Asia/Manila';
 e:=(p_departure+p_arrival_time) at time zone 'Asia/Manila';
 if s<=now() then raise exception 'Choose a future arrival time'; end if;
 qty:=case when o.allocation_basis='guest' then p_guests else p_units end;
 with active as (
 select greatest(starts_at,s) a,least(ends_at,e) z,allocation from bookings
 where resource_id=r.id and starts_at<e and ends_at>s and
 (status in ('pending_review','correction_requested','confirmed','finished') or (status='awaiting_payment' and expires_at>now()))
), changes as (select a t,allocation delta from active union all select z,-allocation from active),
grouped as (select t,sum(delta) delta from changes group by t),
running as (select sum(delta) over(order by t) used from grouped)
select coalesce(max(used),0) into taken from running;
 if exists(select 1 from blackouts where resource_id=r.id and starts_at<e and ends_at>s) then taken:=r.capacity; end if;
 cost:=o.price::bigint*(case when o.price_basis='guest' then p_guests else p_units end)*(case when o.price_basis='unit' then 1 else n end);
 if cost>1000000000 then raise exception 'Booking exceeds the supported amount; contact the campsite'; end if;
 return jsonb_build_object('starts_at',s,'ends_at',e,'allocation',qty,'total',cost,'deposit',ceil(cost*o.deposit_percent/100.0),'available',taken+qty<=r.capacity,'remaining',greatest(r.capacity-taken,0),'name',o.name,'nights',n,'deposit_percent',o.deposit_percent,'arrival_time',p_arrival_time,'schedule_policy','arrival_24h');
end $$;

create or replace function admin_report(p_from date,p_until date,p_offering uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare start_at timestamptz:=p_from::timestamp at time zone 'Asia/Manila'; end_at timestamptz:=p_until::timestamp at time zone 'Asia/Manila'; result jsonb;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 if p_from is null or p_until is null or p_until<=p_from or p_until-p_from>366 then raise exception 'Choose a reporting period of up to 366 days'; end if;
 with b as (select * from bookings where p_offering is null or offering_id=p_offering),
 entries as (select e.* from payment_entries e join b on b.id=e.booking_id where occurred_at>=start_at and occurred_at<end_at),
 created as (select * from b where created_at>=start_at and created_at<end_at),
 stays as (select * from b where status in ('confirmed','finished') and starts_at>=start_at and starts_at<end_at),
entry_days as (select (occurred_at at time zone 'Asia/Manila')::date as report_day,coalesce(sum(amount) filter(where kind='payment'),0) collections,coalesce(sum(amount) filter(where kind='refund'),0) refunds from entries group by 1),
created_days as (select (created_at at time zone 'Asia/Manila')::date as report_day,count(*) bookings from created group by 1),
stay_days as (select (starts_at at time zone 'Asia/Manila')::date as report_day,sum(total) booking_value from stays group by 1)
 select jsonb_build_object(
  'bookings',(select count(*) from created),
  'statuses',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from created group by status) s),
  'booking_value',(select coalesce(sum(total),0) from stays),
  'outstanding',(select coalesce(sum(greatest(total-paid+refunded,0)),0) from stays),
  'collections',(select coalesce(sum(amount),0) from entries where kind='payment'),
  'refunds',(select coalesce(sum(amount),0) from entries where kind='refund'),
  'opening',(select coalesce(sum(e.amount),0) from payment_entries e join b on b.id=e.booking_id where e.kind='opening'),
  'methods',(select coalesce(jsonb_agg(row_to_json(m)),'[]') from (select method,coalesce(sum(amount) filter(where kind='payment'),0) collections,coalesce(sum(amount) filter(where kind='refund'),0) refunds from entries group by method order by method) m),
  'daily',(select coalesce(jsonb_agg(jsonb_build_object('date',d::date,'collections',coalesce(e.collections,0),'refunds',coalesce(e.refunds,0),'bookings',coalesce(c.bookings,0),'booking_value',coalesce(s.booking_value,0)) order by d),'[]') from generate_series(p_from::timestamp,(p_until-1)::timestamp,interval '1 day') d left join entry_days e on e.report_day=d::date left join created_days c on c.report_day=d::date left join stay_days s on s.report_day=d::date),
  'offerings',(select coalesce(jsonb_agg(row_to_json(x)),'[]') from (select offering_id,offering_name,count(*) bookings,sum(total) booking_value from stays group by offering_id,offering_name order by sum(total) desc) x)
 ) into result;
 return result;
end $$;


-- Preserve the existing business transaction behind a quota-enforcing entry point.
alter function create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text,text,time) rename to create_hold_unlimited;
revoke execute on function create_hold_unlimited(uuid,date,date,text,integer,integer,text,text,uuid,text,text,time) from public,anon,authenticated,service_role;
create function create_hold(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_name text,p_phone text,p_request uuid,p_manual_email text default null,p_promo text default null,p_arrival_time time default null) returns bookings
language plpgsql security definer set search_path=public as $$
declare b bookings; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in to reserve'; end if;
 perform pg_advisory_xact_lock(hashtextextended('guest-holds:'||actor::text,0));
 select * into b from bookings where request_id=p_request;
 if found then
  if b.user_id=actor or is_admin() then return b; end if;
  raise exception 'Request already used';
 end if;
 if p_manual_email is null then
  if (select count(*) from bookings where user_id=actor and paid=0 and
   (status in ('pending_review','correction_requested') or (status='awaiting_payment' and expires_at>now())))>=3 then
   raise exception using errcode='P0429',message='You already have three unresolved reservations. Release an unpaid hold or contact the campsite.';
  end if;
  if (select count(*) from hold_creation_events where user_id=actor and created_at>clock_timestamp()-interval '1 hour')>=10 then
   raise exception using errcode='P0429',message='Hourly reservation limit reached. Please try again later.';
  end if;
 end if;
 b:=create_hold_unlimited(p_offering,p_arrival,p_departure,p_slot,p_guests,p_units,p_name,p_phone,p_request,p_manual_email,p_promo,p_arrival_time);
 if p_manual_email is null then insert into hold_creation_events(user_id) values(actor); end if;
 return b;
end $$;
revoke execute on function create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text,text,time) from public,anon,authenticated;
do $$begin
 if (select hold_enabled from audit007_release_state) then
  grant execute on function create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text,text,time) to authenticated;
 end if;
end $$;

-- Only the verified HTTP service may quote. Internal definer booking calls retain access.
revoke execute on function booking_quote(uuid,date,date,text,integer,integer,text,text,time) from public,anon,authenticated,service_role;
create function quote_for_actor(p_offering uuid,p_arrival date,p_departure date,p_arrival_time time,p_guests integer,p_units integer,p_slot text default '',p_promo text default null,p_guest_email text default null,p_actor uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare previous text:=current_setting('request.jwt.claim.sub',true); result jsonb;
begin
 if p_actor is not null and not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null) then raise exception 'Verify your email to continue'; end if;
 perform set_config('request.jwt.claim.sub',coalesce(p_actor::text,''),true);
 if p_guest_email is not null and not is_admin() then raise exception 'Admin access required'; end if;
 result:=booking_quote(p_offering,p_arrival,p_departure,p_slot,p_guests,p_units,p_promo,p_guest_email,p_arrival_time);
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);
 return result;
end $$;
revoke execute on function quote_for_actor(uuid,date,date,time,integer,integer,text,text,text,uuid) from public,anon,authenticated;
grant execute on function quote_for_actor(uuid,date,date,time,integer,integer,text,text,text,uuid) to service_role;
create function public_availability(p_arrival date,p_departure date,p_arrival_time time,p_guests integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o offerings; q jsonb; result jsonb:='[]';
begin
 if p_guests is null or p_guests not between 1 and 10000 then raise exception 'Guest count exceeds the offering capacity'; end if;
 if p_arrival is null or p_arrival<(now() at time zone 'Asia/Manila')::date or p_arrival>(now() at time zone 'Asia/Manila')::date+730 then raise exception 'Choose an arrival within the next two years'; end if;
 if p_departure is null or p_departure-p_arrival not between 1 and 60 then raise exception 'Choose a stay of 1 to 60 days'; end if;
 if p_arrival_time is null or extract(second from p_arrival_time)<>0 or p_arrival_time>=time '24:00' then raise exception 'Choose an arrival time in whole minutes'; end if;
 if (p_arrival+p_arrival_time) at time zone 'Asia/Manila'<=now() then raise exception 'Choose a future arrival time'; end if;
 if (select count(*) from offerings where published)>100 then raise exception 'Use individual accommodation availability'; end if;
 for o in select * from offerings where published order by id loop
  if p_guests>o.max_guests then continue; end if;
  q:=quote_for_actor(o.id,p_arrival,p_departure,p_arrival_time,p_guests,1);
  result:=result||jsonb_build_array(jsonb_build_object('id',o.id,'available',(q->>'available')::boolean));
 end loop;
 return result;
end $$;
revoke execute on function public_availability(date,date,time,integer) from public,anon,authenticated;
grant execute on function public_availability(date,date,time,integer) to service_role;

create index receipts_booking on receipts(booking_id);
create index payments_booking on payment_entries(booking_id,created_at);
create index email_booking on email_jobs(booking_id);
create index email_ready on email_jobs(available_at,created_at) where status in ('queued','failed');
create index email_leased on email_jobs(locked_at) where status='sending';
create index blackouts_overlap on blackouts(resource_id,starts_at,ends_at);
create index booking_unpaid on bookings(user_id,expires_at) where paid=0 and status in ('awaiting_payment','pending_review','correction_requested');
create index booking_expiry on bookings(expires_at) where status='awaiting_payment';

alter table email_jobs add column lease_token uuid;
alter table receipt_cleanup_jobs add column lease_token uuid;
create function pause_email_delivery(p_seconds integer) returns void language plpgsql security definer set search_path=public as $$
begin
 if p_seconds is null or p_seconds not between 1 and 2678400 then raise exception 'Invalid cooldown'; end if;
 insert into rate_limit_counters values('email-cooldown',1,clock_timestamp()+make_interval(secs=>p_seconds))
 on conflict(key) do update set expires_at=greatest(rate_limit_counters.expires_at,excluded.expires_at);
end $$;
revoke execute on function pause_email_delivery(integer) from public,anon,authenticated;
grant execute on function pause_email_delivery(integer) to service_role;
create or replace function claim_email_jobs() returns setof email_jobs language plpgsql security definer set search_path=public as $$
begin
 update bookings set status='expired',updated_at=now() where status='awaiting_payment' and expires_at<=now();
 -- A crash during the final attempt must become visible and manually retryable.
 update email_jobs set status='failed',locked_at=null,lease_token=null,last_error='Delivery lease expired after final attempt'
 where status='sending' and locked_at<now()-interval '5 minutes' and attempts>=8;
 if exists(select 1 from rate_limit_counters where key='email-cooldown' and expires_at>clock_timestamp()) then return; end if;
 return query update email_jobs set status='sending',locked_at=now(),lease_token=gen_random_uuid(),attempts=attempts+1 where id in
 (select id from email_jobs where attempts<8 and ((status in ('queued','failed') and available_at<=now()) or (status='sending' and locked_at<now()-interval '5 minutes')) order by created_at for update skip locked limit 5) returning *;
end $$;
create or replace function claim_receipt_cleanup_jobs() returns setof receipt_cleanup_jobs language plpgsql security definer set search_path=public as $$
begin
 return query update receipt_cleanup_jobs set locked_at=now(),lease_token=gen_random_uuid(),attempts=attempts+1 where id in
 (select id from receipt_cleanup_jobs where available_at<=now() and (locked_at is null or locked_at<now()-interval '5 minutes') order by available_at for update skip locked limit 2) returning *;
end $$;
create function worker_health() returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('oldestQueuedSeconds',(select coalesce(greatest(extract(epoch from now()-min(created_at)),0),0) from email_jobs where status in ('queued','failed') and attempts<8),'exhaustedJobs',(select count(*) from email_jobs where status='failed' and attempts>=8),'cleanupFailedJobs',(select count(*) from receipt_cleanup_jobs where last_error is not null))
$$;
revoke execute on function worker_health() from public,anon,authenticated;
grant execute on function worker_health() to service_role;
commit;
