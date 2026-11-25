-- Apply after 001. Preserve booking snapshots and previously verified balances.
alter table bookings drop constraint bookings_total_check;
-- PostgreSQL names the original multi-column deposit check at table level.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='bookings'::regclass and contype='c' and pg_get_constraintdef(oid) like '%deposit%' loop
  execute format('alter table bookings drop constraint %I',c.conname);
 end loop;
end $$;
alter table bookings add check(total>=0);
alter table bookings add check(deposit>=0 and deposit<=total and (total=0 or deposit>0));
alter table bookings add column subtotal integer;
alter table bookings add column discount integer not null default 0 check(discount>=0);
alter table bookings add column promo_code text;
update bookings set subtotal=total;
alter table bookings alter column subtotal set not null;
alter table bookings add check(subtotal>=total and subtotal-total=discount);

create table promos (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z0-9_-]{3,40}$'),
 enabled boolean not null default true, kind text not null check(kind in ('percent','fixed')),
 value integer not null check(value>0), max_discount integer check(max_discount>0),
 min_subtotal integer not null default 0 check(min_subtotal>=0), offering_ids uuid[] not null default '{}',
 booking_from date, booking_until date, stay_from date, stay_until date,
 usage_limit integer check(usage_limit>0), customer_limit integer check(customer_limit>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(kind<>'percent' or value<=10000),
 check(booking_until is null or booking_from is null or booking_until>=booking_from),
 check(stay_until is null or stay_from is null or stay_until>=stay_from)
);
-- Percent value is basis points (10000 = 100%); fixed values are centavos.
create table promo_redemptions (
 booking_id uuid primary key references bookings, promo_id uuid not null references promos,
 customer_email text not null, consumed boolean not null default false
);
create index redemption_limits on promo_redemptions(promo_id,customer_email);
create table payment_entries (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings,
 kind text not null check(kind in ('payment','refund','opening')), amount integer not null check(amount>0),
 occurred_at timestamptz, reference text not null default '', actor uuid default auth.uid(),
 request_id uuid unique not null, created_at timestamptz not null default now(),
 check((kind='opening')=(occurred_at is null))
);
create index payment_reporting on payment_entries(occurred_at,booking_id);
create index bookings_reporting on bookings(starts_at,status);
create index bookings_created on bookings(created_at,status);
insert into payment_entries(booking_id,kind,amount,request_id)
 select id,'opening',paid,gen_random_uuid() from bookings where paid>0;

alter table promos enable row level security;
alter table promo_redemptions enable row level security;
alter table payment_entries enable row level security;
create policy admin_promos on promos for select to authenticated using(is_admin());
create policy admin_redemptions on promo_redemptions for select to authenticated using(is_admin());
create policy admin_payments on payment_entries for select to authenticated using(is_admin());
grant select on promos,promo_redemptions,payment_entries to authenticated;
grant select,insert,update,delete on promos,promo_redemptions,payment_entries to service_role;
revoke insert,update,delete on promos,promo_redemptions,payment_entries from anon,authenticated;

-- Renamed private implementation functions keep the original allocation locks.
alter function booking_quote(uuid,date,date,text,integer,integer) rename to booking_quote_base;
revoke execute on function booking_quote_base(uuid,date,date,text,integer,integer) from public,anon,authenticated;
create function booking_quote(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_promo text default null,p_guest_email text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q jsonb; p promos; cost integer; saving integer:=0; mail text; today date:=(now() at time zone 'Asia/Manila')::date; used integer; customer_used integer;
begin
 q:=booking_quote_base(p_offering,p_arrival,p_departure,p_slot,p_guests,p_units);
 cost:=(q->>'total')::integer;
 if nullif(trim(p_promo),'') is not null then
  if p_guest_email is not null and not is_admin() then raise exception 'Admin access required'; end if;
  select lower(trim(case when p_guest_email is not null then p_guest_email else email end)) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if mail is null then raise exception 'Sign in with a verified account to apply a promo code'; end if;
  select * into p from promos where code=upper(trim(p_promo)) and enabled;
  if not found then raise exception 'Promo code is invalid or disabled'; end if;
  if (p.booking_from is not null and today<p.booking_from) or (p.booking_until is not null and today>p.booking_until)
   or (p.stay_from is not null and p_arrival<p.stay_from)
   or (p.stay_until is not null and (((q->>'ends_at')::timestamptz-interval '1 microsecond') at time zone 'Asia/Manila')::date>p.stay_until)
   or (cardinality(p.offering_ids)>0 and not p_offering=any(p.offering_ids)) or cost<p.min_subtotal then
   raise exception 'Promo code does not apply to this booking';
  end if;
  select count(*),count(*) filter(where r.customer_email=mail) into used,customer_used
  from promo_redemptions r join bookings b on b.id=r.booking_id where r.promo_id=p.id and
   (r.consumed or b.status in ('pending_review','correction_requested','confirmed') or (b.status='awaiting_payment' and b.expires_at>now()));
  if (p.usage_limit is not null and used>=p.usage_limit) or (p.customer_limit is not null and customer_used>=p.customer_limit) then raise exception 'Promo code usage limit reached'; end if;
  saving:=case when p.kind='percent' then floor(cost::numeric*p.value/10000)::integer else p.value end;
  if p.max_discount is not null then saving:=least(saving,p.max_discount); end if;
  saving:=least(saving,cost);
 end if;
 return q||jsonb_build_object('subtotal',cost,'discount',saving,'total',cost-saving,'deposit',ceil((cost-saving)*(q->>'deposit_percent')::numeric/100)::integer,'promo_code',p.code,'complimentary',cost=saving);
end $$;

alter function create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text) rename to create_hold_base;
revoke execute on function create_hold_base(uuid,date,date,text,integer,integer,text,text,uuid,text) from public,anon,authenticated;
create or replace function public.create_hold_base(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_name text,p_phone text,p_request uuid,p_manual_email text default null) returns public.bookings
language plpgsql security definer set search_path=public as $$
declare q jsonb; b bookings; o offerings; mail text; settings jsonb; manual boolean:=p_manual_email is not null;
begin
 if auth.uid() is null then raise exception 'Sign in to reserve'; end if;
 if manual and not is_admin() then raise exception 'Admin access required'; end if;
 select * into b from bookings where request_id=p_request;
 if found then
  if b.user_id=auth.uid() or is_admin() then return b; end if;
  raise exception 'Request already used';
 end if;
 if length(trim(p_name))<2 or length(p_name)>120 or length(trim(p_phone))<6 or length(p_phone)>40 then raise exception 'Enter your name and contact number'; end if;
 select * into o from offerings where id=p_offering for update;
 if not found then raise exception 'Offering is unavailable'; end if;
 perform 1 from resources where id=o.resource_id for update;
 select value into settings from site_content where key='settings';
 q:=booking_quote(p_offering,p_arrival,p_departure,p_slot,p_guests,p_units);
 if not (q->>'available')::boolean then raise exception 'These dates just became unavailable. Please choose another option'; end if;
 select case when manual then p_manual_email else email end into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if mail is null then raise exception 'Verify your email before booking'; end if;
 insert into bookings(user_id,guest_email,guest_name,phone,offering_id,resource_id,offering_name,starts_at,ends_at,guests,units,allocation,total,deposit,request_id,snapshot,status,expires_at)
 values(case when manual then null else auth.uid() end,mail,trim(p_name),trim(p_phone),o.id,o.resource_id,o.name,(q->>'starts_at')::timestamptz,(q->>'ends_at')::timestamptz,p_guests,p_units,(q->>'allocation')::int,(q->>'total')::int,(q->>'deposit')::int,p_request,q||jsonb_build_object('payment',settings,'schedule',o.schedule,'slot',p_slot),case when manual then 'confirmed' else 'awaiting_payment' end,now()+interval '30 minutes') returning * into b;
 insert into audit_events(action,record_id) values(case when manual then 'manual_booking' else 'hold_created' end,b.id::text);
 if manual then insert into email_jobs(booking_id,recipient,subject,body) values(b.id,mail,'Your booking is confirmed — '||b.reference,'Your reservation for '||o.name||' is confirmed. Please contact the campsite for payment and arrival details.'); end if;
 return b;
end $$;

-- Base insert needs a subtotal before the discounted snapshot is installed.
create function initial_subtotal() returns trigger language plpgsql set search_path=public as $$ begin new.subtotal:=coalesce(new.subtotal,new.total); return new; end $$;
create trigger initial_subtotal before insert on bookings for each row execute function initial_subtotal();
create function create_hold(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_name text,p_phone text,p_request uuid,p_manual_email text default null,p_promo text default null) returns bookings
language plpgsql security definer set search_path=public as $$
declare q jsonb; b bookings; pid uuid; mail text;
begin
 if auth.uid() is null then raise exception 'Sign in to reserve'; end if;
 if p_manual_email is not null and not is_admin() then raise exception 'Admin access required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into b from bookings where request_id=p_request;
 if found then
  if b.user_id=auth.uid() or is_admin() then return b; end if;
  raise exception 'Request already used';
 end if;
 if nullif(trim(p_promo),'') is not null then
  select id into pid from promos where code=upper(trim(p_promo)) for update;
 end if;
 -- Lock before quoting so prices and capacity cannot change between operations.
 perform 1 from offerings where id=p_offering for update;
 perform 1 from resources where id=(select resource_id from offerings where id=p_offering) for update;
 q:=booking_quote(p_offering,p_arrival,p_departure,p_slot,p_guests,p_units,p_promo,p_manual_email);
 if (q->>'total')::integer>0 and p_manual_email is null and not exists(select 1 from site_content where key='settings' and coalesce((value->>'payment_ready')::boolean,false) and coalesce(value->>'qr_url','')<>'' and coalesce(value->>'payment_recipient','')<>'') then raise exception 'Online payment is not configured; please contact the campsite'; end if;
 b:=create_hold_base(p_offering,p_arrival,p_departure,p_slot,p_guests,p_units,p_name,p_phone,p_request,p_manual_email);
 update bookings set subtotal=(q->>'subtotal')::int,discount=(q->>'discount')::int,total=(q->>'total')::int,deposit=(q->>'deposit')::int,
  promo_code=q->>'promo_code',snapshot=snapshot||q,
  status=case when (q->>'complimentary')::boolean and p_manual_email is null then 'pending_review' else status end
  where id=b.id returning * into b;
 if pid is not null then
  insert into promo_redemptions values(b.id,pid,lower(trim(b.guest_email)),p_manual_email is not null and b.total=0);
 end if;
 if b.total=0 and p_manual_email is null then
  insert into email_jobs(booking_id,recipient,subject,body) values(b.id,b.guest_email,'Complimentary reservation awaiting approval — '||b.reference,'Your complimentary reservation is awaiting staff approval. No payment or screenshot is required. Capacity is reserved while staff review it.');
 elsif b.total=0 then
  update email_jobs set body='Your complimentary reservation for '||b.offering_name||' is confirmed. No payment is required. Please contact the campsite for arrival details.' where booking_id=b.id;
 end if;
 return b;
end $$;

alter function review_booking(uuid,text,text,integer,text) rename to review_booking_base;
revoke execute on function review_booking_base(uuid,text,text,integer,text) from public,anon,authenticated;
create function review_booking(p_booking uuid,p_action text,p_note text default '',p_paid integer default null,p_refund text default '',p_occurred date default null,p_request uuid default null) returns bookings
language plpgsql security definer set search_path=public as $$
declare b bookings; old_paid integer; day date:=coalesce(p_occurred,(now() at time zone 'Asia/Manila')::date);
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 select * into b from bookings where id=p_booking for update;
 if not found then raise exception 'Booking not found'; end if;
 if b.total=0 and p_action='correction' then raise exception 'Complimentary bookings do not require payment proof'; end if;
 if day>(now() at time zone 'Asia/Manila')::date then raise exception 'Payment date cannot be in the future'; end if;
 old_paid:=b.paid;
 b:=review_booking_base(p_booking,p_action,p_note,p_paid,p_refund);
 if b.paid>old_paid then
  insert into payment_entries(booking_id,kind,amount,occurred_at,reference,request_id)
   values(b.id,'payment',b.paid-old_paid,(day+time '12:00') at time zone 'Asia/Manila',left(p_note,2000),coalesce(p_request,gen_random_uuid()));
 end if;
 if b.paid>0 or (b.total=0 and b.status='confirmed') then update promo_redemptions set consumed=true where booking_id=b.id; end if;
 return b;
end $$;

create function record_refund(p_booking uuid,p_amount integer,p_day date,p_reference text,p_request uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare remaining bigint; result uuid;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 perform 1 from bookings where id=p_booking for update;
 if not found then raise exception 'Booking not found'; end if;
 select id into result from payment_entries where request_id=p_request and booking_id=p_booking and kind='refund';
 if found then return result; end if;
 if p_amount is null or p_amount<=0 or p_day is null or p_day>(now() at time zone 'Asia/Manila')::date or length(trim(p_reference))<3 then raise exception 'Enter a positive refund, past/current date, and reference'; end if;
 select coalesce(sum(case when kind='refund' then -amount else amount end),0) into remaining from payment_entries where booking_id=p_booking;
 if p_amount>remaining then raise exception 'Refund exceeds recorded collections'; end if;
 insert into payment_entries(booking_id,kind,amount,occurred_at,reference,request_id)
  values(p_booking,'refund',p_amount,(p_day+time '12:00') at time zone 'Asia/Manila',left(p_reference,2000),p_request) returning id into result;
 insert into audit_events(action,record_id,detail) values('refund_recorded',p_booking::text,jsonb_build_object('entry',result,'amount',p_amount));
 return result;
end $$;

create function list_admins() returns table(user_id uuid,email text) language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 return query select a.user_id,u.email::text from admins a join auth.users u on u.id=a.user_id order by u.email;
end $$;
create function protect_last_admin() returns trigger language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(721093);
 if (select count(*) from admins)<=1 then raise exception 'Cannot remove the last administrator'; end if;
 return old;
end $$;
create trigger protect_last_admin before delete on admins for each row execute function protect_last_admin();
create function manage_admin(p_email text default null,p_remove uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
 -- Take the membership lock before checking the caller, including concurrent revocations.
 perform pg_advisory_xact_lock(721093);
 if not is_admin() then raise exception 'Admin access required'; end if;
 if p_remove is not null then
  delete from admins where user_id=p_remove returning user_id into target;
  if not found then raise exception 'Administrator not found'; end if;
 else
  select id into target from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;
  if target is null then raise exception 'No verified account matches this email'; end if;
  if exists(select 1 from admins where user_id=target) then raise exception 'This account is already an administrator'; end if;
  insert into admins values(target);
 end if;
 insert into audit_events(action,record_id) values(case when p_remove is null then 'admin_added' else 'admin_removed' end,target::text);
 return target;
end $$;

create function save_promo(p_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; existing promos; ids uuid[];
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 select coalesce(array_agg(value::uuid),'{}') into ids from jsonb_array_elements_text(coalesce(p_data->'offering_ids','[]'));
 if exists(select 1 from unnest(ids) i where not exists(select 1 from offerings where id=i)) then raise exception 'Unknown eligible offering'; end if;
 if p_data->>'id' is not null then
  select * into existing from promos where id=(p_data->>'id')::uuid for update;
  if not found then raise exception 'Promo not found'; end if;
  if existing.code<>upper(trim(p_data->>'code')) then raise exception 'Promo codes cannot be renamed'; end if;
 end if;
 insert into promos(id,code,enabled,kind,value,max_discount,min_subtotal,offering_ids,booking_from,booking_until,stay_from,stay_until,usage_limit,customer_limit)
 values(coalesce((p_data->>'id')::uuid,gen_random_uuid()),upper(trim(p_data->>'code')),(p_data->>'enabled')::boolean,p_data->>'kind',(p_data->>'value')::int,(p_data->>'max_discount')::int,coalesce((p_data->>'min_subtotal')::int,0),ids,(p_data->>'booking_from')::date,(p_data->>'booking_until')::date,(p_data->>'stay_from')::date,(p_data->>'stay_until')::date,(p_data->>'usage_limit')::int,(p_data->>'customer_limit')::int)
 on conflict(id) do update set enabled=excluded.enabled,kind=excluded.kind,value=excluded.value,max_discount=excluded.max_discount,min_subtotal=excluded.min_subtotal,offering_ids=excluded.offering_ids,booking_from=excluded.booking_from,booking_until=excluded.booking_until,stay_from=excluded.stay_from,stay_until=excluded.stay_until,usage_limit=excluded.usage_limit,customer_limit=excluded.customer_limit,updated_at=now() returning id into result;
 insert into audit_events(action,record_id) values('promo_saved',result::text);
 return result;
end $$;

create function admin_report(p_from date,p_until date,p_offering uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare start_at timestamptz:=p_from::timestamp at time zone 'Asia/Manila'; end_at timestamptz:=p_until::timestamp at time zone 'Asia/Manila'; result jsonb;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 if p_from is null or p_until is null or p_until<=p_from or p_until-p_from>366 then raise exception 'Choose a reporting period of up to 366 days'; end if;
 with b as (select * from bookings where p_offering is null or offering_id=p_offering),
 entries as (select e.* from payment_entries e join b on b.id=e.booking_id where occurred_at>=start_at and occurred_at<end_at),
 created as (select * from b where created_at>=start_at and created_at<end_at),
 stays as (select * from b where status='confirmed' and starts_at>=start_at and starts_at<end_at)
 select jsonb_build_object(
  'bookings',(select count(*) from created),
  'statuses',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from created group by status) s),
  'booking_value',(select coalesce(sum(total),0) from stays),
  'outstanding',(select coalesce(sum(greatest(total-paid,0)),0) from stays),
  'collections',(select coalesce(sum(amount),0) from entries where kind='payment'),
  'refunds',(select coalesce(sum(amount),0) from entries where kind='refund'),
  'opening',(select coalesce(sum(e.amount),0) from payment_entries e join b on b.id=e.booking_id where e.kind='opening'),
  'daily',(select coalesce(jsonb_agg(jsonb_build_object('date',d::date,'collections',(select coalesce(sum(amount),0) from entries where kind='payment' and (occurred_at at time zone 'Asia/Manila')::date=d::date),'refunds',(select coalesce(sum(amount),0) from entries where kind='refund' and (occurred_at at time zone 'Asia/Manila')::date=d::date),'bookings',(select count(*) from created where (created_at at time zone 'Asia/Manila')::date=d::date),'booking_value',(select coalesce(sum(total),0) from stays where (starts_at at time zone 'Asia/Manila')::date=d::date)) order by d),'[]') from generate_series(p_from::timestamp,(p_until-1)::timestamp,interval '1 day') d),
  'offerings',(select coalesce(jsonb_agg(row_to_json(x)),'[]') from (select offering_id,offering_name,count(*) bookings,sum(total) booking_value from stays group by offering_id,offering_name order by sum(total) desc) x)
 ) into result;
 return result;
end $$;

create function list_promos() returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object(
  'reserved',(select count(*) from promo_redemptions r join bookings b on b.id=r.booking_id where r.promo_id=p.id and not r.consumed and (b.status in ('pending_review','correction_requested','confirmed') or (b.status='awaiting_payment' and b.expires_at>now()))),
  'consumed',(select count(*) from promo_redemptions r where r.promo_id=p.id and r.consumed)
 ) order by p.created_at desc),'[]') into result from promos p;
 return result;
end $$;

-- New functions must never inherit PostgreSQL's implicit PUBLIC execute grant.
revoke execute on function initial_subtotal(),protect_last_admin(),booking_quote(uuid,date,date,text,integer,integer,text,text),create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text,text),review_booking(uuid,text,text,integer,text,date,uuid),record_refund(uuid,integer,date,text,uuid),list_admins(),manage_admin(text,uuid),save_promo(jsonb),admin_report(date,date,uuid) from public,anon,authenticated;
grant execute on function booking_quote(uuid,date,date,text,integer,integer,text,text) to anon,authenticated;
grant execute on function create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text,text),review_booking(uuid,text,text,integer,text,date,uuid),record_refund(uuid,integer,date,text,uuid),list_admins(),manage_admin(text,uuid),save_promo(jsonb),admin_report(date,date,uuid) to authenticated;
revoke execute on function list_promos() from public,anon,authenticated;
grant execute on function list_promos() to authenticated;
