-- Apply after 005 during the coordinated booking release. Existing reservations are unchanged.
begin;
alter table email_jobs add column audience text not null default 'guest' check(audience in ('guest','admin'));
alter table email_jobs add column event_key text;
alter table email_jobs add constraint email_event_recipient unique(event_key,recipient);
create index bookings_newest on bookings(created_at desc,id desc);

create function queue_admin_booking_event(p_booking uuid,p_event text,p_title text,p_detail text) returns void
language plpgsql security definer set search_path=public as $$
declare b bookings; content text;
begin
 select * into b from bookings where id=p_booking;
 if not found then raise exception 'Booking not found'; end if;
 content:='Reservation: '||b.reference||E'\nAccommodation: '||b.offering_name||E'\nGuest: '||b.guest_name||E'\nStatus: '||replace(b.status,'_',' ')||
 E'\nArrival (Philippines): '||to_char(b.starts_at at time zone 'Asia/Manila','DD Mon YYYY HH24:MI')||
 E'\nDeparture (Philippines): '||to_char(b.ends_at at time zone 'Asia/Manila','DD Mon YYYY HH24:MI')||
 E'\nTotal PHP: '||(b.total/100.0)::text||case when p_detail is null then '' else E'\n'||p_detail end;
 insert into email_jobs(booking_id,recipient,subject,body,audience,event_key)
 select b.id,lower(trim(u.email)),p_title||' — '||b.reference,content,'admin',p_event
 from admins a join auth.users u on u.id=a.user_id where u.email_confirmed_at is not null and nullif(trim(u.email),'') is not null
 on conflict(event_key,recipient) do nothing;
end $$;
revoke execute on function queue_admin_booking_event(uuid,text,text,text) from public,anon,authenticated,service_role;

-- Replace entry points together; stale clients must reload and choose an arrival time.
drop function create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text,text);
drop function create_hold_base(uuid,date,date,text,integer,integer,text,text,uuid,text);
drop function booking_quote(uuid,date,date,text,integer,integer,text,text);
drop function booking_quote_base(uuid,date,date,text,integer,integer);
create function public.booking_quote_base(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_arrival_time time) returns jsonb
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
 select coalesce(sum(allocation),0) into taken from bookings where resource_id=r.id and starts_at<e and ends_at>s and (status in ('pending_review','correction_requested','confirmed','finished') or (status='awaiting_payment' and expires_at>now()));
 if exists(select 1 from blackouts where resource_id=r.id and starts_at<e and ends_at>s) then taken:=r.capacity; end if;
 cost:=o.price::bigint*(case when o.price_basis='guest' then p_guests else p_units end)*(case when o.price_basis='unit' then 1 else n end);
 if cost>1000000000 then raise exception 'Booking exceeds the supported amount; contact the campsite'; end if;
 return jsonb_build_object('starts_at',s,'ends_at',e,'allocation',qty,'total',cost,'deposit',ceil(cost*o.deposit_percent/100.0),'available',taken+qty<=r.capacity,'remaining',greatest(r.capacity-taken,0),'name',o.name,'nights',n,'deposit_percent',o.deposit_percent,'arrival_time',p_arrival_time,'schedule_policy','arrival_24h');
end $$;

create function booking_quote(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_promo text default null,p_guest_email text default null,p_arrival_time time default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q jsonb; p promos; cost integer; saving integer:=0; mail text; today date:=(now() at time zone 'Asia/Manila')::date; used integer; customer_used integer;
begin
 q:=booking_quote_base(p_offering,p_arrival,p_departure,p_slot,p_guests,p_units,p_arrival_time);
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
   (r.consumed or b.status in ('pending_review','correction_requested','confirmed','finished') or (b.status='awaiting_payment' and b.expires_at>now()));
  if (p.usage_limit is not null and used>=p.usage_limit) or (p.customer_limit is not null and customer_used>=p.customer_limit) then raise exception 'Promo code usage limit reached'; end if;
  saving:=case when p.kind='percent' then floor(cost::numeric*p.value/10000)::integer else p.value end;
  if p.max_discount is not null then saving:=least(saving,p.max_discount); end if;
  saving:=least(saving,cost);
 end if;
 return q||jsonb_build_object('subtotal',cost,'discount',saving,'total',cost-saving,'deposit',ceil((cost-saving)*(q->>'deposit_percent')::numeric/100)::integer,'promo_code',p.code,'complimentary',cost=saving);
end $$;

create or replace function public.create_hold_base(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_name text,p_phone text,p_request uuid,p_manual_email text default null,p_arrival_time time default null) returns public.bookings
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
 q:=booking_quote(p_offering,p_arrival,p_departure,p_slot,p_guests,p_units,null,null,p_arrival_time);
 if not (q->>'available')::boolean then raise exception 'These dates just became unavailable. Please choose another option'; end if;
 select case when manual then p_manual_email else email end into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if mail is null then raise exception 'Verify your email before booking'; end if;
 insert into bookings(user_id,guest_email,guest_name,phone,offering_id,resource_id,offering_name,starts_at,ends_at,guests,units,allocation,total,deposit,request_id,snapshot,status,expires_at)
 values(case when manual then null else auth.uid() end,mail,trim(p_name),trim(p_phone),o.id,o.resource_id,o.name,(q->>'starts_at')::timestamptz,(q->>'ends_at')::timestamptz,p_guests,p_units,(q->>'allocation')::int,(q->>'total')::int,(q->>'deposit')::int,p_request,q||jsonb_build_object('payment',settings,'schedule','arrival_24h','slot',''),case when manual then 'confirmed' else 'awaiting_payment' end,now()+interval '30 minutes') returning * into b;
 insert into audit_events(action,record_id) values(case when manual then 'manual_booking' else 'hold_created' end,b.id::text);
 if manual then insert into email_jobs(booking_id,recipient,subject,body) values(b.id,mail,'Your booking is confirmed — '||b.reference,'Your reservation for '||o.name||' is confirmed. Please contact the campsite for payment and arrival details.'); end if;
 return b;
end $$;

create or replace function create_hold(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_name text,p_phone text,p_request uuid,p_manual_email text default null,p_promo text default null,p_arrival_time time default null) returns bookings
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
 q:=booking_quote(p_offering,p_arrival,p_departure,p_slot,p_guests,p_units,p_promo,p_manual_email,p_arrival_time);
 if (q->>'total')::integer>0 and p_manual_email is null and not exists(select 1 from site_content where key='settings' and payment_configured(value)) then raise exception 'Online payment is not configured; please contact the campsite'; end if;
 b:=create_hold_base(p_offering,p_arrival,p_departure,p_slot,p_guests,p_units,p_name,p_phone,p_request,p_manual_email,p_arrival_time);
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
 perform queue_admin_booking_event(b.id,'booking:'||b.id::text,'New booking',null);
 return b;
end $$;
revoke execute on function booking_quote_base(uuid,date,date,text,integer,integer,time),create_hold_base(uuid,date,date,text,integer,integer,text,text,uuid,text,time) from public,anon,authenticated,service_role;
revoke execute on function booking_quote(uuid,date,date,text,integer,integer,text,text,time),create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text,text,time) from public,anon,authenticated;
grant execute on function booking_quote(uuid,date,date,text,integer,integer,text,text,time) to anon,authenticated;
grant execute on function create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text,text,time) to authenticated;

create function notify_booking_activity() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.action='receipt_submitted' then
  perform queue_admin_booking_event(new.record_id::uuid,'proof:'||new.id::text,'Payment proof submitted — unverified','A guest submitted payment proof. Verify actual funds before confirming.');
 elsif new.action='payment_recorded' then
  perform queue_admin_booking_event(new.record_id::uuid,'payment:'||(new.detail->>'entry'),'Payment verified',
   'Verified PHP: '||((new.detail->>'amount')::numeric/100)::text||E'\nMethod: '||(new.detail->>'method'));
 end if;
 return new;
end $$;
create trigger booking_activity_email after insert on audit_events for each row execute function notify_booking_activity();
revoke execute on function notify_booking_activity() from public,anon,authenticated,service_role;
-- Apply the time policy to future guest messages, including manual and complimentary bookings.
create function decorate_booking_email() returns trigger language plpgsql security definer set search_path=public as $$
declare b bookings; policy text:='Your reservation ends at your selected arrival time on your departure date. Arriving late does not extend your reservation.';
begin
 if new.audience='guest' then
  select * into b from bookings where id=new.booking_id;
  if b.snapshot->>'schedule_policy'='arrival_24h' then
   if position('Arrival (Philippines):' in new.body)=0 then
    new.body:=new.body||E'\nArrival (Philippines): '||to_char(b.starts_at at time zone 'Asia/Manila','DD Mon YYYY HH24:MI')||E'\nDeparture (Philippines): '||to_char(b.ends_at at time zone 'Asia/Manila','DD Mon YYYY HH24:MI');
   end if;
   if position(policy in new.body)=0 then new.body:=new.body||E'\n'||policy; end if;
  end if;
 end if;
 return new;
end $$;
create trigger booking_email_policy before insert or update of body on email_jobs for each row execute function decorate_booking_email();
revoke execute on function decorate_booking_email() from public,anon,authenticated,service_role;
commit;
