-- Apply after 003 and before deploying appearance and permanent-deletion controls.
begin;

create function valid_site_image(image jsonb) returns boolean language sql immutable set search_path=public as $$
 select coalesce(jsonb_typeof(image)='object' and jsonb_typeof(image->'src')='string'
  and length(image->>'src') between 1 and 2048
  and ((image->>'src') ~ '^https://[^[:space:]]+$' or ((image->>'src') like '/images/%' and position('..' in image->>'src')=0))
  and jsonb_typeof(image->'alt')='string' and length(trim(image->>'alt')) between 1 and 300,false);
$$;
create function check_site_appearance() returns trigger language plpgsql set search_path=public as $$
declare k text; item jsonb;
begin
 if new.key<>'settings' then return new; end if;
 if new.value ? 'logo' and not valid_site_image(new.value->'logo') then raise exception 'Invalid logo'; end if;
 if new.value ? 'palette' then
  if jsonb_typeof(new.value->'palette')<>'object' then raise exception 'Invalid palette'; end if;
  for k,item in select * from jsonb_each(new.value->'palette') loop
   if k not in ('forest','deep','gold','cream','white','text','muted','line','section','buttonText','success','successBg','warning','warningBg','danger','dangerBg')
    or jsonb_typeof(item)<>'string' or (item#>>'{}')!~*'^#[0-9a-f]{6}$' then raise exception 'Invalid palette color'; end if;
  end loop;
 end if;
 if new.value ? 'images' then
  if jsonb_typeof(new.value->'images')<>'object' then raise exception 'Invalid page images'; end if;
  for k,item in select * from jsonb_each(new.value->'images') loop
   if k not in ('hero','introMain','introInset','experience','gathering','camping','gatherings','about','contact','account','fallback') or not valid_site_image(item) then raise exception 'Invalid page image'; end if;
  end loop;
 end if;
 if new.value ? 'gallery' then
  if jsonb_typeof(new.value->'gallery')<>'array' then raise exception 'Invalid gallery'; end if;
  if jsonb_array_length(new.value->'gallery')>20 then raise exception 'Gallery supports up to 20 images'; end if;
  for item in select * from jsonb_array_elements(new.value->'gallery') loop
   if not valid_site_image(item) then raise exception 'Invalid gallery image'; end if;
  end loop;
 end if;
 return new;
end $$;
-- SECURITY DEFINER permits the validation-only trigger to invoke the private helper.
alter function check_site_appearance() security definer;
create trigger check_site_appearance before insert or update on site_content for each row execute function check_site_appearance();

create table receipt_cleanup_jobs (
 id uuid primary key default gen_random_uuid(), prefix text unique not null,
 -- Signed upload URLs can remain usable for two hours. Re-scan after that window.
 finish_after timestamptz not null default now()+interval '130 minutes',
 available_at timestamptz not null default now(), locked_at timestamptz,
 attempts integer not null default 0, last_error text
);
alter table receipt_cleanup_jobs enable row level security;
revoke all on receipt_cleanup_jobs from public,anon,authenticated;
grant select,insert,update,delete on receipt_cleanup_jobs to service_role;

create function erase_booking(p_booking uuid,p_admin boolean) returns void language plpgsql security definer set search_path=public as $$
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
 delete from email_jobs where booking_id=b.id;
 delete from payment_entries where booking_id=b.id;
 delete from promo_redemptions where booking_id=b.id;
 delete from audit_events where record_id=b.id::text;
 delete from receipts where booking_id=b.id;
 delete from bookings where id=b.id;
 -- Deliberately retain no booking-specific audit or financial tombstone.
end $$;
create function delete_unpaid_booking(p_booking uuid) returns void language sql security definer set search_path=public as $$select erase_booking(p_booking,false)$$;
create function delete_cancelled_booking(p_booking uuid) returns void language sql security definer set search_path=public as $$select erase_booking(p_booking,true)$$;

create function claim_receipt_cleanup_jobs() returns setof receipt_cleanup_jobs language plpgsql security definer set search_path=public as $$
begin
 return query update receipt_cleanup_jobs set locked_at=now(),attempts=attempts+1 where id in
 (select id from receipt_cleanup_jobs where available_at<=now() and (locked_at is null or locked_at<now()-interval '5 minutes')
 order by available_at for update skip locked limit 10) returning *;
end $$;
revoke execute on function valid_site_image(jsonb),check_site_appearance(),erase_booking(uuid,boolean),delete_unpaid_booking(uuid),delete_cancelled_booking(uuid),claim_receipt_cleanup_jobs() from public,anon,authenticated;
grant execute on function delete_unpaid_booking(uuid),delete_cancelled_booking(uuid) to authenticated;
grant execute on function claim_receipt_cleanup_jobs() to service_role;
commit;
