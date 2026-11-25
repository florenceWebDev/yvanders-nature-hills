-- Apply to a fresh Supabase project. All monetary values are integer centavos.
create extension if not exists pgcrypto;
create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from admins where user_id=auth.uid()) $$;
create table public.resources (id uuid primary key default gen_random_uuid(), name text not null, capacity integer not null check(capacity between 1 and 10000));
create table public.offerings (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), name text not null,
 kind text not null check(kind in ('room','camping','pavilion','day-use')), description text not null default '',
 images text[] not null default '{}', amenities text[] not null default '{}', published boolean not null default false,
 resource_id uuid not null references resources, allocation_basis text not null check(allocation_basis in ('unit','guest')) default 'unit',
 max_guests integer not null check(max_guests between 1 and 10000), price integer check(price>0),
 price_basis text not null check(price_basis in ('night','unit','guest')), deposit_percent integer not null check(deposit_percent between 1 and 100) default 50,
 schedule text not null check(schedule in ('overnight','slots')), check_in time not null default '14:00', check_out time not null default '12:00',
 slots jsonb not null default '[]', updated_at timestamptz not null default now(),
 check(schedule <> 'slots' or jsonb_array_length(slots)>0), check(schedule <> 'slots' or price_basis <> 'night'), check(not published or price is not null)
);
create table public.site_content (key text primary key, value jsonb not null);
insert into site_content values ('settings','{"tagline":"A little closer to nature.","intro":"Open skies, green hills, and time to slow down. Discover a stay at Yvander’s Nature Hills.","contact":"","email":"","address":"","qr_url":"","payment_recipient":"","payment_instructions":"","payment_ready":false,"cancellation_policy":"Contact the campsite to request changes or cancellation. Refunds are reviewed and processed manually."}');
create table public.bookings (
 id uuid primary key default gen_random_uuid(), reference text unique not null default ('YNH-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 user_id uuid references auth.users(id), guest_email text not null, guest_name text not null, phone text not null,
 offering_id uuid not null references offerings, resource_id uuid not null references resources,
 offering_name text not null, starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 guests integer not null check(guests>0), units integer not null check(units>0), allocation integer not null check(allocation>0),
 total integer not null check(total>0), deposit integer not null check(deposit>0 and deposit<=total), paid integer not null default 0 check(paid>=0),
 status text not null check(status in ('awaiting_payment','pending_review','correction_requested','confirmed','declined','cancelled','expired')) default 'awaiting_payment',
 expires_at timestamptz not null default now()+interval '30 minutes', request_id uuid unique not null,
 snapshot jsonb not null, admin_note text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index booking_capacity on bookings(resource_id,starts_at,ends_at);
create index booking_owner on bookings(user_id,created_at desc);
create table public.receipts (id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings, object_path text not null unique, transaction_reference text not null, created_at timestamptz not null default now());
create table public.audit_events (id bigint generated always as identity primary key, actor uuid default auth.uid(), action text not null, record_id text not null, detail jsonb, created_at timestamptz default now());
create table public.blackouts (id uuid primary key default gen_random_uuid(),resource_id uuid not null references resources,starts_at timestamptz not null,ends_at timestamptz not null,reason text not null,check(ends_at>starts_at));
create table public.email_jobs (id uuid primary key default gen_random_uuid(),booking_id uuid references bookings,recipient text not null,subject text not null,body text not null,attempts integer not null default 0,status text not null default 'queued' check(status in ('queued','sending','sent','failed')),available_at timestamptz not null default now(),locked_at timestamptz,last_error text,created_at timestamptz default now());

-- Guests cannot grant themselves a role or directly alter prices/booking state.
alter table admins enable row level security;
alter table resources enable row level security;
alter table offerings enable row level security;
alter table site_content enable row level security;
alter table bookings enable row level security;
alter table receipts enable row level security;
alter table audit_events enable row level security;
alter table blackouts enable row level security;
alter table email_jobs enable row level security;
create policy admin_read on admins for select to authenticated using(user_id=auth.uid());
create policy public_offerings on offerings for select using(published or is_admin());
create policy public_content on site_content for select using(true);
create policy admin_resources on resources for select to authenticated using(is_admin());
create policy own_booking on bookings for select to authenticated using(user_id=auth.uid() or is_admin());
create policy own_receipt on receipts for select to authenticated using(exists(select 1 from bookings b where b.id=booking_id and (b.user_id=auth.uid() or is_admin())));
create policy admin_blackouts on blackouts for select to authenticated using(is_admin());
create policy admin_audit on audit_events for select to authenticated using(is_admin());
create policy admin_jobs on email_jobs for select to authenticated using(is_admin());
grant select on offerings,site_content to anon,authenticated;
grant select on admins,resources,bookings,receipts,blackouts,audit_events,email_jobs to authenticated;
revoke insert,update,delete on all tables in schema public from anon,authenticated;

create function public.booking_quote(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o offerings; r resources; s timestamptz; e timestamptz; sl jsonb; n integer; cost bigint; taken integer; qty integer;
begin
 select * into o from offerings where id=p_offering and (published or is_admin());
 if not found then raise exception 'Offering is unavailable'; end if;
 select * into r from resources where id=o.resource_id;
 if p_arrival is null or p_arrival<(now() at time zone 'Asia/Manila')::date or p_arrival>(now() at time zone 'Asia/Manila')::date+730 then raise exception 'Choose an arrival within the next two years'; end if;
 if o.price is null then raise exception 'This offering does not have a verified rate'; end if;
 if p_guests is null or p_units is null or p_guests<1 or p_units<1 or p_units>1000 or p_guests>o.max_guests*p_units then raise exception 'Guest count exceeds the offering capacity'; end if;
 if o.schedule='overnight' then
  n:=p_departure-p_arrival;
  if n is null or n<1 or n>60 then raise exception 'Choose a stay of 1 to 60 nights'; end if;
  s:=(p_arrival+o.check_in) at time zone 'Asia/Manila'; e:=(p_departure+o.check_out) at time zone 'Asia/Manila';
 else
  select v into sl from jsonb_array_elements(o.slots) v where v->>'id'=p_slot;
  if sl is null then raise exception 'Choose a valid time slot'; end if;
  s:=(p_arrival+(sl->>'start')::time) at time zone 'Asia/Manila';
  e:=(p_arrival+(sl->>'end')::time) at time zone 'Asia/Manila';
  if e<=s then e:=e+interval '1 day'; end if; n:=1;
 end if;
 if s<=now() then raise exception 'Choose a future arrival time'; end if;
 qty:=case when o.allocation_basis='guest' then p_guests else p_units end;
 select coalesce(sum(allocation),0) into taken from bookings where resource_id=r.id and starts_at<e and ends_at>s and (status in ('pending_review','correction_requested','confirmed') or (status='awaiting_payment' and expires_at>now()));
 if exists(select 1 from blackouts where resource_id=r.id and starts_at<e and ends_at>s) then taken:=r.capacity; end if;
 cost:=o.price::bigint*(case when o.price_basis='guest' then p_guests else p_units end)*(case when o.price_basis='unit' then 1 else n end);
 if cost>1000000000 then raise exception 'Booking exceeds the supported amount; contact the campsite'; end if;
 return jsonb_build_object('starts_at',s,'ends_at',e,'allocation',qty,'total',cost,'deposit',ceil(cost*o.deposit_percent/100.0),'available',taken+qty<=r.capacity,'remaining',greatest(r.capacity-taken,0),'name',o.name,'nights',n,'deposit_percent',o.deposit_percent);
end $$;

create function public.create_hold(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_name text,p_phone text,p_request uuid,p_manual_email text default null) returns public.bookings
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
 if not manual and (not coalesce((settings->>'payment_ready')::boolean,false) or coalesce(settings->>'qr_url','')='' or coalesce(settings->>'payment_recipient','')='') then raise exception 'Online payment is not configured; please contact the campsite'; end if;
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

create function public.submit_receipt(p_booking uuid,p_path text,p_reference text,p_receipt uuid,p_user uuid) returns public.bookings
language plpgsql security definer set search_path=public as $$
declare b bookings;
begin
 select * into b from bookings where id=p_booking for update;
 if b.id is null or b.user_id is distinct from p_user or p_user is null then raise exception 'Booking not found'; end if;
 if exists(select 1 from receipts where id=p_receipt and booking_id=b.id) then return b; end if;
 if b.status not in ('awaiting_payment','correction_requested') or (b.status='awaiting_payment' and b.expires_at<=now()) then raise exception 'Payment upload is closed. If you have paid, contact the campsite with your reference'; end if;
 if length(trim(p_reference))<3 or length(p_reference)>120 then raise exception 'Enter the payment transaction reference'; end if;
 if p_path not like p_user::text||'/'||b.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='receipts' and name=p_path) then raise exception 'Receipt file is missing'; end if;
 insert into receipts(id,booking_id,object_path,transaction_reference) values(p_receipt,b.id,p_path,trim(p_reference));
 update bookings set status='pending_review',updated_at=now() where id=b.id returning * into b;
 insert into audit_events(actor,action,record_id) values(p_user,'receipt_submitted',b.id::text);
 insert into email_jobs(booking_id,recipient,subject,body) values(b.id,b.guest_email,'Payment proof received — '||b.reference,'We received your payment screenshot for '||b.offering_name||'. Your reservation is awaiting staff payment verification. This is not a booking confirmation.');
 return b;
end $$;

create function public.review_booking(p_booking uuid,p_action text,p_note text default '',p_paid integer default null,p_refund text default '') returns public.bookings
language plpgsql security definer set search_path=public as $$
declare b bookings; next_status text;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 select * into b from bookings where id=p_booking for update;
 if not found then raise exception 'Booking not found'; end if;
 next_status:=case p_action when 'confirm' then 'confirmed' when 'decline' then 'declined' when 'correction' then 'correction_requested' when 'cancel' then 'cancelled' when 'balance' then b.status else null end;
 if next_status is null then raise exception 'Invalid action'; end if;
 if b.status=next_status and p_action<>'balance' then return b; end if;
 if p_action in ('confirm','decline','correction') and b.status not in ('pending_review','correction_requested') then raise exception 'This booking is not awaiting review'; end if;
 if p_action='confirm' and (p_paid is null or p_paid<b.deposit or p_paid>b.total) then raise exception 'Verified amount must cover the deposit and not exceed the total'; end if;
 if p_action='balance' and (b.status<>'confirmed' or p_paid is null or p_paid<b.paid or p_paid>b.total) then raise exception 'Enter a valid cumulative paid amount'; end if;
 if p_action='cancel' and b.status not in ('confirmed','pending_review','correction_requested','awaiting_payment') then raise exception 'Booking cannot be cancelled'; end if;
 if p_action in ('decline','correction','cancel') and length(trim(p_note))<3 then raise exception 'Provide a reason for the guest'; end if;
 update bookings set status=next_status,paid=case when p_action in ('confirm','balance') then p_paid else paid end,admin_note=left(p_note,2000),updated_at=now() where id=b.id returning * into b;
 insert into audit_events(action,record_id,detail) values('booking_'||p_action,b.id::text,jsonb_build_object('paid',b.paid,'note',p_note,'refund',p_refund));
 if p_action<>'balance' then insert into email_jobs(booking_id,recipient,subject,body) values(b.id,b.guest_email,'Reservation '||replace(next_status,'_',' ')||' — '||b.reference,
 'Reservation: '||b.reference||E'\nOffering: '||b.offering_name||E'\nStatus: '||replace(next_status,'_',' ')||E'\nArrival (Philippines): '||to_char(b.starts_at at time zone 'Asia/Manila','DD Mon YYYY HH24:MI')||E'\nDeparture: '||to_char(b.ends_at at time zone 'Asia/Manila','DD Mon YYYY HH24:MI')||E'\nTotal PHP: '||(b.total/100.0)::text||E'\nVerified payment PHP: '||(b.paid/100.0)::text||E'\nRemaining PHP: '||((b.total-b.paid)/100.0)::text||E'\n'||p_note); end if;
 return b;
end $$;

-- All admin configuration uses one trusted operation and serializes capacity changes.
create function public.save_offering(p_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare oid uuid; rid uuid; v jsonb; settings jsonb;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 oid:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 perform 1 from offerings where id=oid for update;
 rid:=nullif(p_data->>'resource_id','')::uuid;
 if exists(select 1 from offerings where id=oid and resource_id is distinct from rid) and exists(select 1 from bookings where offering_id=oid and ends_at>now() and (status in ('confirmed','pending_review','correction_requested') or (status='awaiting_payment' and expires_at>now()))) then raise exception 'Inventory pool cannot change while this offering has active reservations'; end if;
 if rid is null then insert into resources(name,capacity) values(p_data->>'name',(p_data->>'capacity')::int) returning id into rid;
 else perform 1 from resources where id=rid for update; if not found then raise exception 'Resource not found'; end if; end if;
 if exists(select 1 from bookings where resource_id=rid and ends_at>now() and (status in ('confirmed','pending_review','correction_requested') or (status='awaiting_payment' and expires_at>now()))) and (select capacity from resources where id=rid)<>(p_data->>'capacity')::int then raise exception 'Capacity cannot change while this pool has active reservations'; end if;
 update resources set capacity=(p_data->>'capacity')::int where id=rid;
 if p_data->>'schedule'='slots' then
  for v in select * from jsonb_array_elements(p_data->'slots') loop
   perform (v->>'start')::time,(v->>'end')::time;
   if coalesce(v->>'id','')='' or coalesce(v->>'label','')='' or (v->>'start')::time=(v->>'end')::time then raise exception 'Invalid slot'; end if;
  end loop;
 end if;
 select value into settings from site_content where key='settings';
 if (p_data->>'published')::boolean and (not coalesce((settings->>'payment_ready')::boolean,false) or coalesce(settings->>'qr_url','')='' or coalesce(settings->>'payment_recipient','')='') then raise exception 'Configure verified payment instructions before publishing'; end if;
 insert into offerings(id,slug,name,kind,description,images,amenities,published,resource_id,allocation_basis,max_guests,price,price_basis,deposit_percent,schedule,check_in,check_out,slots)
 values(oid,p_data->>'slug',p_data->>'name',p_data->>'kind',p_data->>'description',array(select jsonb_array_elements_text(p_data->'images')),array(select jsonb_array_elements_text(p_data->'amenities')),(p_data->>'published')::boolean,rid,p_data->>'allocation_basis',(p_data->>'max_guests')::int,(p_data->>'price')::int,p_data->>'price_basis',(p_data->>'deposit_percent')::int,p_data->>'schedule',(p_data->>'check_in')::time,(p_data->>'check_out')::time,p_data->'slots')
 on conflict(id) do update set slug=excluded.slug,name=excluded.name,kind=excluded.kind,description=excluded.description,images=excluded.images,amenities=excluded.amenities,published=excluded.published,resource_id=excluded.resource_id,allocation_basis=excluded.allocation_basis,max_guests=excluded.max_guests,price=excluded.price,price_basis=excluded.price_basis,deposit_percent=excluded.deposit_percent,schedule=excluded.schedule,check_in=excluded.check_in,check_out=excluded.check_out,slots=excluded.slots,updated_at=now();
 insert into audit_events(action,record_id) values('offering_saved',oid::text); return oid;
end $$;
create function public.save_content(p_value jsonb) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 insert into site_content(key,value) values('settings',p_value) on conflict(key) do update set value=excluded.value;
 insert into audit_events(action,record_id) values('content_saved','settings');
end $$;
create function public.add_blackout(p_resource uuid,p_start timestamptz,p_end timestamptz,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 perform 1 from resources where id=p_resource for update;
 if exists(select 1 from bookings where resource_id=p_resource and starts_at<p_end and ends_at>p_start and (status in ('confirmed','pending_review','correction_requested') or (status='awaiting_payment' and expires_at>now()))) then raise exception 'Existing reservations overlap this blackout'; end if;
 insert into blackouts(resource_id,starts_at,ends_at,reason) values(p_resource,p_start,p_end,p_reason);
 insert into audit_events(action,record_id) values('blackout_added',p_resource::text);
end $$;
create function public.remove_blackout(p_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 delete from blackouts where id=p_id; insert into audit_events(action,record_id) values('blackout_removed',p_id::text);
end $$;

create function public.claim_email_jobs() returns setof public.email_jobs language plpgsql security definer set search_path=public as $$ begin
 update bookings set status='expired',updated_at=now() where status='awaiting_payment' and expires_at<=now();
 return query update email_jobs set status='sending',locked_at=now(),attempts=attempts+1 where id in
 (select id from email_jobs where ((status in ('queued','failed') and available_at<=now() and attempts<8) or (status='sending' and locked_at<now()-interval '5 minutes' and attempts<8)) order by created_at for update skip locked limit 20) returning *;
end $$;

-- Functions default to PUBLIC execute in PostgreSQL; remove that implicit grant.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function is_admin() to anon,authenticated;
grant execute on function booking_quote(uuid,date,date,text,integer,integer) to anon,authenticated;
grant execute on function create_hold(uuid,date,date,text,integer,integer,text,text,uuid,text) to authenticated;
-- Only the server may finalize a receipt, after inspecting the original bytes.
grant execute on function submit_receipt(uuid,text,text,uuid,uuid) to service_role;
grant execute on function review_booking(uuid,text,text,integer,text) to authenticated;
grant execute on function save_offering(jsonb),save_content(jsonb),add_blackout(uuid,timestamptz,timestamptz,text),remove_blackout(uuid) to authenticated;
grant execute on function claim_email_jobs() to service_role;
grant select,insert,update,delete on admins,resources,offerings,site_content,bookings,receipts,audit_events,blackouts,email_jobs to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('receipts','receipts',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('marketing','marketing',true,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- Receipt uploads and signed reads are issued by authenticated server routes using
-- the service role after ownership checks. No direct client storage writes granted.
create policy marketing_read on storage.objects for select using(bucket_id='marketing');
