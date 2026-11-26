-- Apply after 004. Existing gross paid amounts, snapshots and ledger dates are preserved.
begin;
alter table payment_entries add column method text not null default 'unspecified'
 check(method in ('cash','gcash','bank','other','unspecified'));
alter table receipts add column method text not null default 'unspecified';
alter table receipts add column payment_option_id text;
alter table receipts add column uploaded_by uuid;
alter table receipts add column payment_entry_id uuid unique references payment_entries on delete set null;
alter table bookings add column refunded integer not null default 0 check(refunded>=0);
update bookings b set refunded=coalesce((select sum(amount) from payment_entries where booking_id=b.id and kind='refund'),0);
alter table bookings add column finished_at timestamptz;
alter table bookings add column finished_by uuid;
alter table bookings drop constraint bookings_status_check;
alter table bookings add check(status in ('awaiting_payment','pending_review','correction_requested','confirmed','finished','declined','cancelled','expired'));

-- Keep the former review implementation private; money now uses an explicit payment operation.
alter function review_booking(uuid,text,text,integer,text,date,uuid) rename to review_booking_legacy;
revoke execute on function review_booking_legacy(uuid,text,text,integer,text,date,uuid) from public,anon,authenticated,service_role;
create function review_booking(p_booking uuid,p_action text,p_note text default '',p_paid integer default null,p_refund text default '',p_occurred date default null,p_request uuid default null) returns bookings
language plpgsql security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 if p_action='balance' or (p_action='confirm' and exists(select 1 from bookings where id=p_booking and total>0)) then raise exception 'Use Record payment with a payment method'; end if;
 return review_booking_legacy(p_booking,p_action,p_note,p_paid,p_refund,p_occurred,p_request);
end $$;

create function record_payment(p_booking uuid,p_amount integer,p_method text,p_day date,p_reference text,p_request uuid,p_confirm boolean default false,p_receipt uuid default null) returns bookings
language plpgsql security definer set search_path=public as $$
declare b bookings; previous payment_entries; result bookings;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 select * into b from bookings where id=p_booking for update;
 if not found then raise exception 'Booking not found'; end if;
 select * into previous from payment_entries where request_id=p_request;
 if found then
  if previous.booking_id<>p_booking or previous.kind<>'payment' or previous.amount is distinct from p_amount or previous.method is distinct from p_method or (previous.occurred_at at time zone 'Asia/Manila')::date is distinct from p_day or previous.reference is distinct from trim(p_reference)
    or (select id from receipts where payment_entry_id=previous.id) is distinct from p_receipt
    or not exists(select 1 from audit_events where action='payment_recorded' and record_id=b.id::text and detail->>'entry'=previous.id::text and (detail->>'confirm')::boolean is not distinct from p_confirm)
   then raise exception 'Payment retry differs from the recorded request; reload the booking'; end if;
  return b;
 end if;
 if p_amount is null or p_amount<=0 or p_request is null or p_confirm is null or p_method is null or p_method not in ('cash','gcash','bank','other') or p_day is null or p_day>(now() at time zone 'Asia/Manila')::date or p_reference is null or length(p_reference)>2000 then raise exception 'Enter a positive payment, method, past/current date and request'; end if;
 if p_method<>'cash' and length(trim(p_reference))<3 then raise exception 'Enter the transfer reference or Other payment details'; end if;
 if (p_confirm and b.status not in ('pending_review','correction_requested')) or (not p_confirm and b.status not in ('confirmed','finished')) then raise exception 'This booking cannot receive this payment'; end if;
 if p_method='cash' and p_receipt is not null then raise exception 'Cash payments do not use online proof'; end if;
 if p_method<>'cash' then
  perform 1 from receipts where id=p_receipt and booking_id=b.id and payment_entry_id is null for update;
  if not found then raise exception 'Upload or select unlinked payment proof for this booking'; end if;
 end if;
 if p_amount>b.total-b.paid+b.refunded then raise exception 'Payment exceeds the remaining balance'; end if;
 if p_confirm and b.paid-b.refunded+p_amount<b.deposit then raise exception 'Verified amount must cover the deposit'; end if;
 insert into payment_entries(booking_id,kind,amount,occurred_at,reference,request_id,method)
 values(b.id,'payment',p_amount,(p_day+time '12:00') at time zone 'Asia/Manila',trim(p_reference),p_request,p_method) returning * into previous;
 if p_receipt is not null then update receipts set payment_entry_id=previous.id,method=p_method where id=p_receipt; end if;
 update bookings set paid=paid+p_amount,status=case when p_confirm then 'confirmed' else status end,updated_at=now() where id=b.id returning * into result;
 update promo_redemptions set consumed=true where booking_id=b.id;
 insert into audit_events(action,record_id,detail) values('payment_recorded',b.id::text,jsonb_build_object('entry',previous.id,'amount',p_amount,'method',p_method,'confirm',p_confirm));
 if p_confirm then
  insert into email_jobs(booking_id,recipient,subject,body) values(b.id,b.guest_email,'Your booking is confirmed — '||b.reference,'Reservation: '||b.reference||E'\nYour reservation for '||b.offering_name||' is confirmed.'||E'\nArrival (Philippines): '||to_char(b.starts_at at time zone 'Asia/Manila','DD Mon YYYY HH24:MI')||E'\nDeparture: '||to_char(b.ends_at at time zone 'Asia/Manila','DD Mon YYYY HH24:MI')||E'\nTotal PHP: '||(b.total/100.0)::text||E'\nNet received PHP: '||((result.paid-result.refunded)/100.0)::text||E'\nRemaining PHP: '||((result.total-result.paid+result.refunded)/100.0)::text);
 end if;
 return result;
end $$;

-- Refund accounting is applied for every insertion, including the existing idempotent refund RPC.
create function apply_refund_balance() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.kind='refund' then update bookings set refunded=refunded+new.amount,updated_at=now() where id=new.booking_id; end if;
 return new;
end $$;
create trigger payment_refund_balance after insert on payment_entries for each row execute function apply_refund_balance();
revoke execute on function apply_refund_balance() from public,anon,authenticated,service_role;

create function finish_booking(p_booking uuid) returns bookings language plpgsql security definer set search_path=public as $$
declare b bookings;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 select * into b from bookings where id=p_booking for update;
 if not found then raise exception 'Booking not found'; end if;
 if b.status='finished' then return b; end if;
 if b.status<>'confirmed' or b.starts_at>now() or b.paid-b.refunded<b.total then raise exception 'Only an arrived, fully paid confirmed booking can be finished'; end if;
 update bookings set status='finished',finished_at=now(),finished_by=auth.uid(),updated_at=now() where id=b.id returning * into b;
 insert into audit_events(action,record_id) values('booking_finished',b.id::text);
 return b;
end $$;

-- A row lock plus a scoped merge prevents Website saves from overwriting Payment saves.
create function save_settings_section(p_section text,p_value jsonb) returns void language plpgsql security definer set search_path=public as $$
declare current_value jsonb; allowed text[]; k text;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 allowed:=case p_section when 'website' then array['logo','palette','images','gallery','tagline','intro','contact','email','address','cancellation_policy','faq'] when 'payment' then array['payment_options','payment_ready'] else null end;
 if allowed is null or jsonb_typeof(p_value) is distinct from 'object' then raise exception 'Invalid settings section'; end if;
 if p_section='payment' and exists(select 1 from jsonb_array_elements(p_value->'payment_options') o where coalesce(o->>'method','') not in ('gcash','bank','other')) then raise exception 'Choose the method for every payment option'; end if;
 for k in select jsonb_object_keys(p_value) loop if not k=any(allowed) then raise exception 'Field does not belong to this settings section'; end if; end loop;
 select value into current_value from site_content where key='settings' for update;
 if not found then raise exception 'Settings not found'; end if;
 perform save_content(current_value||p_value);
end $$;

revoke execute on function record_payment(uuid,integer,text,date,text,uuid,boolean,uuid),finish_booking(uuid),save_settings_section(text,jsonb),review_booking(uuid,text,text,integer,text,date,uuid) from public,anon;
grant execute on function record_payment(uuid,integer,text,date,text,uuid,boolean,uuid),finish_booking(uuid),save_settings_section(text,jsonb),review_booking(uuid,text,text,integer,text,date,uuid) to authenticated;

-- Finished stays keep their original allocated interval, including early checkout.
do $$ declare f record; definition text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('booking_quote_base','create_hold_base','create_hold','save_offering','add_blackout','booking_quote') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,$old$status in ('confirmed',$old$,$new$status in ('finished','confirmed',$new$);
  definition:=replace(definition,$old$status in ('pending_review','correction_requested','confirmed')$old$,$new$status in ('pending_review','correction_requested','confirmed','finished')$new$);
  execute definition;
 end loop;
end $$;

create or replace function admin_report(p_from date,p_until date,p_offering uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare start_at timestamptz:=p_from::timestamp at time zone 'Asia/Manila'; end_at timestamptz:=p_until::timestamp at time zone 'Asia/Manila'; result jsonb;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 if p_from is null or p_until is null or p_until<=p_from or p_until-p_from>366 then raise exception 'Choose a reporting period of up to 366 days'; end if;
 with b as (select * from bookings where p_offering is null or offering_id=p_offering),
 entries as (select e.* from payment_entries e join b on b.id=e.booking_id where occurred_at>=start_at and occurred_at<end_at),
 created as (select * from b where created_at>=start_at and created_at<end_at),
 stays as (select * from b where status in ('confirmed','finished') and starts_at>=start_at and starts_at<end_at)
 select jsonb_build_object(
  'bookings',(select count(*) from created),
  'statuses',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from created group by status) s),
  'booking_value',(select coalesce(sum(total),0) from stays),
  'outstanding',(select coalesce(sum(greatest(total-paid+refunded,0)),0) from stays),
  'collections',(select coalesce(sum(amount),0) from entries where kind='payment'),
  'refunds',(select coalesce(sum(amount),0) from entries where kind='refund'),
  'opening',(select coalesce(sum(e.amount),0) from payment_entries e join b on b.id=e.booking_id where e.kind='opening'),
  'methods',(select coalesce(jsonb_agg(row_to_json(m)),'[]') from (select method,coalesce(sum(amount) filter(where kind='payment'),0) collections,coalesce(sum(amount) filter(where kind='refund'),0) refunds from entries group by method order by method) m),
  'daily',(select coalesce(jsonb_agg(jsonb_build_object('date',d::date,'collections',(select coalesce(sum(amount),0) from entries where kind='payment' and (occurred_at at time zone 'Asia/Manila')::date=d::date),'refunds',(select coalesce(sum(amount),0) from entries where kind='refund' and (occurred_at at time zone 'Asia/Manila')::date=d::date),'bookings',(select count(*) from created where (created_at at time zone 'Asia/Manila')::date=d::date),'booking_value',(select coalesce(sum(total),0) from stays where (starts_at at time zone 'Asia/Manila')::date=d::date)) order by d),'[]') from generate_series(p_from::timestamp,(p_until-1)::timestamp,interval '1 day') d),
  'offerings',(select coalesce(jsonb_agg(row_to_json(x)),'[]') from (select offering_id,offering_name,count(*) bookings,sum(total) booking_value from stays group by offering_id,offering_name order by sum(total) desc) x)
 ) into result;
 return result;
end $$;

-- Guest choice is read from the immutable booking snapshot, never trusted as verified funds.
create function submit_selected_receipt(p_booking uuid,p_path text,p_reference text,p_receipt uuid,p_user uuid,p_option text) returns bookings
language plpgsql security definer set search_path=public as $$
declare b bookings; option jsonb; existing receipts;
begin
 select * into b from bookings where id=p_booking for update;
 if not found or b.user_id is distinct from p_user or p_user is null then raise exception 'Booking not found'; end if;
 select * into existing from receipts where id=p_receipt;
 if found then
  if existing.booking_id<>p_booking or existing.payment_option_id is distinct from p_option or existing.object_path<>p_path or existing.transaction_reference<>trim(p_reference) then raise exception 'Receipt retry differs'; end if;
  return b;
 end if;
 select o into option from jsonb_array_elements(coalesce(b.snapshot->'payment'->'payment_options','[]')) o where o->>'id'=p_option;
 if option is null and p_option='00000000-0000-4000-8000-000000000001' and coalesce(b.snapshot->'payment'->>'qr_url','')<>'' then option:=jsonb_build_object('method','unspecified'); end if;
 if option is null then raise exception 'Choose a payment option from this booking'; end if;
 b:=submit_receipt(p_booking,p_path,p_reference,p_receipt,p_user);
 update receipts set method=coalesce(option->>'method','unspecified'),payment_option_id=p_option,uploaded_by=p_user where id=p_receipt;
 return b;
end $$;
create function register_payment_proof(p_booking uuid,p_path text,p_receipt uuid,p_actor uuid) returns receipts
language plpgsql security definer set search_path=public as $$
declare b bookings; r receipts;
begin
 if p_actor is null or not exists(select 1 from admins where user_id=p_actor) then raise exception 'Admin access required'; end if;
 select * into b from bookings where id=p_booking for update;
 if not found then raise exception 'Booking not found'; end if;
 select * into r from receipts where id=p_receipt;
 if found then
  if r.booking_id<>p_booking or r.object_path<>p_path or r.uploaded_by is distinct from p_actor then raise exception 'Receipt retry differs'; end if;
  return r;
 end if;
 if b.status not in ('pending_review','correction_requested','confirmed','finished') then raise exception 'Payment upload is closed'; end if;
 if p_path not like p_actor::text||'/'||b.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='receipts' and name=p_path) then raise exception 'Receipt file is missing'; end if;
 insert into receipts(id,booking_id,object_path,transaction_reference,uploaded_by) values(p_receipt,p_booking,p_path,'Staff payment proof',p_actor) returning * into r;
 insert into audit_events(actor,action,record_id,detail) values(p_actor,'payment_proof_uploaded',p_booking::text,jsonb_build_object('receipt',r.id));
 return r;
end $$;
revoke execute on function submit_selected_receipt(uuid,text,text,uuid,uuid,text),register_payment_proof(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function submit_selected_receipt(uuid,text,text,uuid,uuid,text),register_payment_proof(uuid,text,uuid,uuid) to service_role;

alter function record_refund(uuid,integer,date,text,uuid) rename to record_refund_legacy;
revoke execute on function record_refund_legacy(uuid,integer,date,text,uuid) from public,anon,authenticated,service_role;
create function record_refund(p_booking uuid,p_amount integer,p_day date,p_reference text,p_request uuid,p_method text default 'unspecified') returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid; previous payment_entries;
begin
 if not is_admin() then raise exception 'Admin access required'; end if;
 if p_method is null or p_method not in ('cash','gcash','bank','other','unspecified') then raise exception 'Invalid refund method'; end if;
 perform 1 from bookings where id=p_booking for update;
 select * into previous from payment_entries where request_id=p_request;
 if found and (previous.booking_id<>p_booking or previous.kind<>'refund' or previous.method<>p_method) then raise exception 'Refund retry differs from the recorded request'; end if;
 result:=record_refund_legacy(p_booking,p_amount,p_day,p_reference,p_request);
 if previous.id is null then update payment_entries set method=p_method where id=result; end if;
 return result;
end $$;
revoke execute on function record_refund(uuid,integer,date,text,uuid,text) from public,anon;
grant execute on function record_refund(uuid,integer,date,text,uuid,text) to authenticated;


-- Register the staff prefix before issuing a signed upload, so deletion also cleans unfinished uploads.
create function prepare_payment_proof(p_booking uuid,p_actor uuid) returns void language plpgsql security definer set search_path=public as $$
declare b bookings;
begin
 if p_actor is null or not exists(select 1 from admins where user_id=p_actor) then raise exception 'Admin access required'; end if;
 select * into b from bookings where id=p_booking for update;
 if not found then raise exception 'Booking not found'; end if;
 if b.status not in ('pending_review','correction_requested','confirmed','finished') then raise exception 'Payment upload is closed'; end if;
 insert into audit_events(actor,action,record_id,detail) values(p_actor,'payment_upload_prepared',b.id::text,jsonb_build_object('prefix',p_actor::text||'/'||b.id::text));
end $$;
revoke execute on function prepare_payment_proof(uuid,uuid) from public,anon,authenticated;
grant execute on function prepare_payment_proof(uuid,uuid) to service_role;

create or replace function erase_booking(p_booking uuid,p_admin boolean) returns void language plpgsql security definer set search_path=public as $$
declare b bookings; stamp timestamptz:=clock_timestamp();
begin
 if auth.uid() is null then raise exception 'Sign in to delete a booking'; end if;
 if p_admin and not is_admin() then raise exception 'Admin access required'; end if;
 select * into b from bookings where id=p_booking for update;
 if not found or (not p_admin and b.user_id is distinct from auth.uid()) then raise exception 'Booking not found'; end if;
 if p_admin then
  if b.status<>'cancelled' then raise exception 'Only cancelled reservations can be deleted'; end if;
 else
  if b.status<>'awaiting_payment' or b.expires_at<=stamp or b.paid<>0
   or exists(select 1 from receipts where booking_id=b.id) or exists(select 1 from payment_entries where booking_id=b.id)
   then raise exception 'Only an active booking awaiting payment can be deleted'; end if;
 end if;
 -- Serialize with queue claims before checking their leases.
 perform 1 from email_jobs where booking_id=b.id order by id for update;
 if exists(select 1 from email_jobs where booking_id=b.id and status='sending' and coalesce(locked_at,stamp)>stamp-interval '5 minutes') then
  raise exception 'A booking email is being sent. Retry deletion in a few minutes';
 end if;
 if b.user_id is not null then
  insert into receipt_cleanup_jobs(prefix) values(b.user_id::text||'/'||b.id::text) on conflict(prefix) do nothing;
 end if;
 insert into receipt_cleanup_jobs(prefix)
  select distinct regexp_replace(object_path,'/[^/]+$','') from receipts where booking_id=b.id on conflict(prefix) do nothing;
 insert into receipt_cleanup_jobs(prefix) select distinct detail->>'prefix' from audit_events where record_id=b.id::text and action='payment_upload_prepared' and detail->>'prefix' is not null on conflict(prefix) do nothing;
 delete from email_jobs where booking_id=b.id;
 delete from payment_entries where booking_id=b.id;
 delete from promo_redemptions where booking_id=b.id;
 delete from audit_events where record_id=b.id::text;
 delete from receipts where booking_id=b.id;
 delete from bookings where id=b.id;
 -- Deliberately retain no booking-specific audit or financial tombstone.
end $$;

commit;
