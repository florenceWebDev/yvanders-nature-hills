-- Apply after 002, before deploying the multi-QR application. Existing snapshots are unchanged.
begin;
create function public.valid_payment_options(options jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare item jsonb; seen text[] := '{}'; id text; image text;
begin
 if options is null or jsonb_typeof(options)<>'array' then return false; end if;
 if jsonb_array_length(options)>3 then return false; end if;
 for item in select * from jsonb_array_elements(options) loop
  if jsonb_typeof(item)<>'object' then return false; end if;
  id:=item->>'id'; image:=item->>'qr_url';
  if coalesce(jsonb_typeof(item->'id'),'')<>'string' or coalesce(id,'')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or id=any(seen) then return false; end if;
  seen:=array_append(seen,id);
  if coalesce(jsonb_typeof(item->'label'),'')<>'string' or length(trim(item->>'label')) not between 1 and 100
   or coalesce(jsonb_typeof(item->'recipient'),'')<>'string' or length(trim(item->>'recipient')) not between 1 and 200
   or coalesce(jsonb_typeof(item->'instructions'),'')<>'string' or length(item->>'instructions')>4000
   or coalesce(jsonb_typeof(item->'qr_url'),'')<>'string' or length(image)>2048
   or not (image ~ '^https://[^[:space:]]+$' or (image like '/images/%' and position('..' in image)=0)) then return false; end if;
 end loop;
 return true;
end $$;
create function public.payment_configured(settings jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
begin
 if settings->'payment_ready' is distinct from 'true'::jsonb then return false; end if;
 if not valid_payment_options(settings->'payment_options') then return false; end if;
 return jsonb_array_length(settings->'payment_options') between 1 and 3;
end $$;
-- Never convert the known nonpayable test image into a usable payment option.
update site_content set value=value||'{"qr_url":"","payment_recipient":"","payment_instructions":"","payment_ready":false,"payment_options":[]}'::jsonb
 where key='settings' and value->>'payment_recipient'='SYSTEM CHECK — NO PAYMENT ACCOUNT'
 and value->>'qr_url' like '%/storage/v1/object/public/marketing/system-check/do-not-pay.png';
-- Convert the old configuration once. Cleanup of the approved fixture is a separate, guarded operation.
update site_content set value=value||jsonb_build_object('payment_options',case
 when coalesce(value->>'qr_url','')<>'' and coalesce(value->>'payment_recipient','')<>'' then
 jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','QR payment','qr_url',value->>'qr_url','recipient',value->>'payment_recipient','instructions',coalesce(value->>'payment_instructions','')))
 else '[]'::jsonb end) where key='settings' and not(value ? 'payment_options');
create or replace function public.save_content(p_value jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 if not valid_payment_options(p_value->'payment_options') then raise exception 'Configure zero to three complete payment options with unique IDs'; end if;
 if coalesce(jsonb_typeof(p_value->'payment_ready'),'')<>'boolean' then raise exception 'Payment readiness must be boolean'; end if;
 if p_value->'payment_ready'='true'::jsonb and not payment_configured(p_value) then raise exception 'Add a complete payment option before enabling payments'; end if;
 -- Mirror the first option for the previous app during a rolling deployment.
 p_value:=(p_value-'qr_url'-'payment_recipient'-'payment_instructions')||jsonb_build_object(
 'qr_url',coalesce(p_value#>>'{payment_options,0,qr_url}',''),
 'payment_recipient',coalesce(p_value#>>'{payment_options,0,recipient}',''),
 'payment_instructions',coalesce(p_value#>>'{payment_options,0,instructions}',''));
 insert into site_content(key,value) values('settings',p_value) on conflict(key) do update set value=excluded.value;
 insert into audit_events(action,record_id) values('content_saved','settings');
end $$;
create or replace function create_hold(p_offering uuid,p_arrival date,p_departure date,p_slot text,p_guests integer,p_units integer,p_name text,p_phone text,p_request uuid,p_manual_email text default null,p_promo text default null) returns bookings
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
 if (q->>'total')::integer>0 and p_manual_email is null and not exists(select 1 from site_content where key='settings' and payment_configured(value)) then raise exception 'Online payment is not configured; please contact the campsite'; end if;
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
create or replace function public.save_offering(p_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
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
 if (p_data->>'published')::boolean and (not payment_configured(settings)) then raise exception 'Configure verified payment instructions before publishing'; end if;
 insert into offerings(id,slug,name,kind,description,images,amenities,published,resource_id,allocation_basis,max_guests,price,price_basis,deposit_percent,schedule,check_in,check_out,slots)
 values(oid,p_data->>'slug',p_data->>'name',p_data->>'kind',p_data->>'description',array(select jsonb_array_elements_text(p_data->'images')),array(select jsonb_array_elements_text(p_data->'amenities')),(p_data->>'published')::boolean,rid,p_data->>'allocation_basis',(p_data->>'max_guests')::int,(p_data->>'price')::int,p_data->>'price_basis',(p_data->>'deposit_percent')::int,p_data->>'schedule',(p_data->>'check_in')::time,(p_data->>'check_out')::time,p_data->'slots')
 on conflict(id) do update set slug=excluded.slug,name=excluded.name,kind=excluded.kind,description=excluded.description,images=excluded.images,amenities=excluded.amenities,published=excluded.published,resource_id=excluded.resource_id,allocation_basis=excluded.allocation_basis,max_guests=excluded.max_guests,price=excluded.price,price_basis=excluded.price_basis,deposit_percent=excluded.deposit_percent,schedule=excluded.schedule,check_in=excluded.check_in,check_out=excluded.check_out,slots=excluded.slots,updated_at=now();
 insert into audit_events(action,record_id) values('offering_saved',oid::text); return oid;
end $$;

revoke execute on function valid_payment_options(jsonb),payment_configured(jsonb) from public,anon,authenticated;
-- Helpers run inside the existing security-definer booking/content functions.
commit;
