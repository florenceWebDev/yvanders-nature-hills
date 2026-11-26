import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {campDate,addDays,periodRange,overlapsDay} from '../src/lib/admin-dates';
import {promoSchema,sameOrigin} from '../src/lib/validation';
const db=new PGlite();
const staff='10000000-0000-4000-8000-000000000003',guest='10000000-0000-4000-8000-000000000001',second='10000000-0000-4000-8000-000000000002';
const day=addDays(campDate(),60),end=addDays(day,2);
async function identity(id:string,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);}
async function sql<T=Record<string,unknown>>(query:string,params:unknown[]=[]){return(await db.query<T>(query,params)).rows;}
async function room(price=10000){await identity(staff);const resource=crypto.randomUUID(),offering=crypto.randomUUID();await db.exec('reset role');await db.query('insert into resources(id,name,capacity) values($1,$2,1)',[resource,'Test pool']);await db.query("insert into offerings(id,name,slug,kind,published,resource_id,max_guests,price,price_basis,schedule) values($1,'Cabana',$2,'room',true,$3,4,$4,'night','overnight')",[offering,offering,resource,price]);await identity(guest);return offering;}
async function promo(code:string,overrides:Record<string,unknown>={}){await identity(staff);const p={code,enabled:true,kind:'percent',value:2500,min_subtotal:0,max_discount:null,offering_ids:[],booking_from:null,booking_until:null,stay_from:null,stay_until:null,usage_limit:null,customer_limit:null,...overrides};return(await sql<{id:string}>('select save_promo($1) id',[p]))[0].id;}
async function hold(offering:string,code:string|null=null,request=crypto.randomUUID()){return(await sql<{id:string;total:number;subtotal:number;discount:number;deposit:number;status:string;paid:number;promo_code:string}>('select * from create_hold($1,$2,$3,\'\',2,1,\'Guest Name\',\'09123456789\',$4,null,$5)',[offering,day,end,request,code]))[0];}
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`);
 for(const name of ['001_booking.sql','002_administration.sql','003_payment_options.sql','004_appearance_deletion.sql','005_payments_settings.sql'])try{
  if(name==='002_administration.sql')await db.exec(`insert into resources(id,name,capacity) values('20000000-0000-4000-8000-000000000099','Legacy pool',1);insert into offerings(id,name,slug,kind,resource_id,max_guests,price,price_basis,schedule) values('30000000-0000-4000-8000-000000000099','Legacy','legacy','room','20000000-0000-4000-8000-000000000099',2,10000,'night','overnight');insert into bookings(id,guest_email,guest_name,phone,offering_id,resource_id,offering_name,starts_at,ends_at,guests,units,allocation,total,deposit,paid,request_id,snapshot,status) values('40000000-0000-4000-8000-000000000099','legacy@example.test','Legacy','123456','30000000-0000-4000-8000-000000000099','20000000-0000-4000-8000-000000000099','Legacy',now()+interval '1 day',now()+interval '2 days',1,1,1,10000,5000,5000,gen_random_uuid(),'{}','confirmed');`);
  if(name==='003_payment_options.sql')await db.exec(`update site_content set value=value||'{"payment_ready":true,"qr_url":"/images/legacy-qr.png","payment_recipient":"Legacy camp","payment_instructions":"Original instructions"}'::jsonb where key='settings'`);
  await db.exec((await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''));
  if(name==='003_payment_options.sql'){
   const converted=(await sql<{value:{payment_options:{label:string;qr_url:string;recipient:string;instructions:string}[]}}>("select value from site_content where key='settings'"))[0].value.payment_options;
   assert.equal(converted.length,1);assert.equal(converted[0].qr_url,'/images/legacy-qr.png');assert.equal(converted[0].recipient,'Legacy camp');assert.equal(converted[0].instructions,'Original instructions');
  }
 }catch(e){throw new Error(`${name}: ${e instanceof Error?e.message:String(e)}`);}
 await db.exec(`insert into auth.users values('${staff}','staff@example.test',now()),('${guest}','guest@example.test',now()),('${second}','second@example.test',now());insert into admins values('${staff}');update site_content set value=value||'{"payment_ready":true,"qr_url":"/images/qr.jpg","payment_recipient":"Test","payment_options":[{"id":"10000000-0000-4000-8000-000000000005","label":"Test QR","qr_url":"/images/qr.jpg","recipient":"Test","instructions":""}]}' where key='settings';`);
});
after(()=>db.close());
test('periods use Monday weeks, calendar quarters, leap years and Manila dates',()=>{
 assert.deepEqual(periodRange('week','2027-01-03'),{from:'2026-12-28',until:'2027-01-04'});
 assert.deepEqual(periodRange('quarter','2027-12-03',1),{from:'2028-01-01',until:'2028-04-01'});
 assert.deepEqual(periodRange('year','2028-02-29'),{from:'2028-01-01',until:'2029-01-01'});
 assert.equal(campDate('2027-01-01T18:00:00Z'),'2027-01-02');
 assert.equal(overlapsDay('2027-01-01T14:00:00+08:00','2027-01-02T00:00:00+08:00','2027-01-02'),false);
});
test('same-origin checks use actual host and protocol, rejecting missing, foreign and malformed origins',()=>{
 assert.equal(sameOrigin('http://127.0.0.1:3003','127.0.0.1:3003','http:'),true);
 assert.equal(sameOrigin('https://camp.example','camp.example','https:'),true);
 for(const origin of [null,'null','https://other.example','https://camp.example.evil','http://camp.example','https://user@camp.example','https://camp.example/path'])assert.equal(sameOrigin(origin,'camp.example','https:'),false);
 assert.equal(sameOrigin('http://localhost:3003','127.0.0.1:3003','http:'),false);
});
test('admin promotion, duplicate denial, revocation and last administrator protection',async()=>{
 await identity(staff);await assert.rejects(sql('select manage_admin($1)',['missing@example.test']),/verified account/);
 await sql('select manage_admin($1)',['SECOND@example.test']);await assert.rejects(sql('select manage_admin($1)',['second@example.test']),/already/);
 await identity(second);assert.equal((await sql('select * from list_admins()')).length,2);await sql('select manage_admin(null,$1)',[second]);
 await assert.rejects(sql('select * from list_admins()'),/Admin access/);await identity(staff);await assert.rejects(sql('select manage_admin(null,$1)',[staff]),/last administrator/);
 await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=null where id=$1',[second]);await identity(staff);await assert.rejects(sql('select manage_admin($1)',['second@example.test']),/verified account/);
});
test('guest cannot read private reporting, promos, memberships or write financial data',async()=>{
 await identity(guest);for(const q of ["select admin_report(current_date,current_date+1)","select list_promos()","select list_admins()","select manage_admin('guest@example.test')","select record_refund(gen_random_uuid(),1,current_date,'ref',gen_random_uuid())"])await assert.rejects(sql(q),/Admin access/);
 assert.equal((await sql('select * from payment_entries')).length,0);assert.equal((await sql('select * from promos')).length,0);
 await assert.rejects(sql("insert into promos(code,kind,value) values('FORGED','fixed',1)"),/permission denied/);
 await assert.rejects(sql('select * from create_hold_base(null,null,null,null,1,1,null,null,null,null)'),/permission denied/);
});
test('discount quote, centavo rounding, discounted deposit, idempotency and snapshot stability',async()=>{
 const offering=await room(10001);const pid=await promo('NATURE25',{usage_limit:1});await identity(guest);
 const request=crypto.randomUUID(),b=await hold(offering,'nature25',request);assert.equal(b.subtotal,20002);assert.equal(b.discount,5000);assert.equal(b.total,15002);assert.equal(b.deposit,7501);
 assert.equal((await hold(offering,'nature25',request)).id,b.id);
 await promo('NATURE25',{id:pid,enabled:false});await identity(guest);assert.equal((await hold(offering,'NATURE25',request)).total,15002);
 const other=await room();await assert.rejects(hold(other,'NATURE25'),/invalid or disabled/);
});
test('promo eligibility, full stay window, limits and expiry of a reserved use',async()=>{
 const offering=await room(),other=await room();await promo('ONEUSE',{usage_limit:1,customer_limit:1,offering_ids:[offering]});await identity(guest);
 await assert.rejects(hold(other,'ONEUSE'),/does not apply/);const b=await hold(offering,'ONEUSE');await assert.rejects(hold(other,'ONEUSE'),/does not apply/);
 await assert.rejects(hold(offering,'ONEUSE'),/limit/);await db.exec('reset role');await db.query("update bookings set expires_at=now()-interval '1 second' where id=$1",[b.id]);await identity(guest);await hold(offering,'ONEUSE');
 await promo('LATER',{booking_from:addDays(campDate(),1)});await identity(guest);await assert.rejects(hold(other,'LATER'),/does not apply/);
 await promo('SHORT',{stay_until:day});await identity(guest);await assert.rejects(hold(other,'SHORT'),/does not apply/);
 await promo('MINIMUM',{min_subtotal:999999});await identity(guest);await assert.rejects(hold(other,'MINIMUM'),/does not apply/);
});
test('complimentary bookings need staff approval without proof and consume usage permanently',async()=>{
 const offering=await room();await promo('FREE',{value:10000,usage_limit:1});await identity(guest);const b=await hold(offering,'FREE');assert.equal(b.total,0);assert.equal(b.deposit,0);assert.equal(b.status,'pending_review');
 await identity(staff);await assert.rejects(sql("select review_booking($1,'correction','Please retry',0)",[b.id]),/do not require/);
 const approved=(await sql<{status:string}>("select * from review_booking($1,'confirm','Approved',0)",[b.id]))[0];assert.equal(approved.status,'confirmed');
 await sql("select review_booking($1,'cancel','Cancelled by guest',0)",[b.id]);const other=await room();await assert.rejects(hold(other,'FREE'),/limit/);
 await identity(staff);assert.equal((await sql<{n:number}>('select count(*)::int n from payment_entries where booking_id=$1',[b.id]))[0].n,0);
});
test('per-customer limits are independent of the global limit',async()=>{
 const a=await room(),b=await room();await promo('CUSTOMER',{usage_limit:3,customer_limit:1});await identity(guest);await hold(a,'CUSTOMER');await assert.rejects(hold(b,'CUSTOMER'),/limit/);
 await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=now() where id=$1',[second]);await identity(second);assert.equal((await hold(b,'CUSTOMER')).discount,5000);
});
test('serialized competing requests cannot both consume the last promo use',async()=>{
 const a=await room(),b=await room();await promo('FINALUSE',{usage_limit:1});await identity(guest);
 const result=await Promise.allSettled([hold(a,'FINALUSE'),hold(b,'FINALUSE')]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.filter(r=>r.status==='rejected').length,1);
});
test('fixed discounts cap at zero, optional max discount limits savings, declined unpaid uses release',async()=>{
 const offering=await room();await promo('FIXED',{kind:'fixed',value:999999,usage_limit:1});await identity(guest);const b=await hold(offering,'FIXED');assert.equal(b.total,0);
 await identity(staff);await sql("select review_booking($1,'decline','Not approved',0)",[b.id]);await identity(guest);assert.equal((await hold(offering,'FIXED')).total,0);
 const other=await room();await promo('CAPPED',{value:10000,max_discount:5000});await identity(guest);assert.equal((await hold(other,'CAPPED')).discount,5000);
});
test('payment deltas, retry safety, refunds and period totals reconcile',async()=>{
 const offering=await room();await identity(staff);const b=(await sql<{id:string}>("select * from create_hold($1,$2,$3,'',2,1,'Manual Guest','09123456789',$4,'manual@example.test')",[offering,day,end,crypto.randomUUID()]))[0];
 const today=campDate(),request=crypto.randomUUID();await sql("select record_payment($1,10000,'cash',$2,'Transfer',$3)",[b.id,today,request]);await sql("select record_payment($1,10000,'cash',$2,'Transfer',$3)",[b.id,today,request]);
 await sql("select record_payment($1,10000,'cash',$2,'Balance',$3)",[b.id,today,crypto.randomUUID()]);
 const refundRequest=crypto.randomUUID();await sql('select record_refund($1,5000,$2,\'REFUND-1\',$3)',[b.id,today,refundRequest]);await sql('select record_refund($1,5000,$2,\'REFUND-1\',$3)',[b.id,today,refundRequest]);
 await assert.rejects(sql('select record_refund($1,6000,$2,\'REFUND-1\',$3)',[b.id,today,refundRequest]),/retry differs/);
 await assert.rejects(sql('select record_refund($1,16000,$2,\'REFUND-2\',$3)',[b.id,today,crypto.randomUUID()]),/exceeds/);
 const payments=await sql<{kind:string;amount:number}>('select kind,amount from payment_entries where booking_id=$1',[b.id]);assert.equal(payments.length,3);assert.equal(payments.filter(p=>p.kind==='payment').reduce((n,p)=>n+p.amount,0),20000);
 const report=(await sql<{r:{collections:number;refunds:number;bookings:number}}>('select admin_report($1,$2,$3) r',[today,addDays(today,1),offering]))[0].r;assert.equal(report.collections,20000);assert.equal(report.refunds,5000);assert.equal(report.bookings,1);
 const arrivals=(await sql<{r:{booking_value:number;outstanding:number}}>('select admin_report($1,$2,$3) r',[day,end,offering]))[0].r;assert.equal(arrivals.booking_value,20000);assert.equal(arrivals.outstanding,5000);
});
test('reports include more than 500 rows and exclude undated opening balances from periods',async()=>{
 const offering=await room();await db.exec('reset role');await db.query(`insert into bookings(guest_email,guest_name,phone,offering_id,resource_id,offering_name,starts_at,ends_at,guests,units,allocation,total,deposit,request_id,snapshot,status)
 select 'manual@example.test','Guest','09123456789',o.id,o.resource_id,o.name,$2::date+time '14:00',$3::date+time '12:00',1,1,1,100,50,gen_random_uuid(),'{}','confirmed' from offerings o cross join generate_series(1,601) n where o.id=$1`,[offering,day,end]);
 await identity(staff);const report=(await sql<{r:{booking_value:number}}>('select admin_report($1,$2,$3) r',[day,end,offering]))[0].r;assert.equal(report.booking_value,60100);
 const legacy=(await sql<{r:{opening:number;collections:number}}>('select admin_report($1,$2,$3) r',[campDate(),addDays(campDate(),7),'30000000-0000-4000-8000-000000000099']))[0].r;assert.equal(legacy.opening,5000);assert.equal(legacy.collections,0);
});
test('promo request validation rejects percentages above 100 and reversed date windows',()=>{
 const p={code:'TEST',enabled:true,kind:'percent',value:10001,max_discount:null,min_subtotal:0,offering_ids:[],booking_from:null,booking_until:null,stay_from:null,stay_until:null,usage_limit:null,customer_limit:null};
 assert.equal(promoSchema.safeParse(p).success,false);assert.equal(promoSchema.safeParse({...p,value:10000,booking_from:'2027-02-02',booking_until:'2027-01-01'}).success,false);
});

test('multi-QR settings enforce direct database validation and preserve booking snapshots',async()=>{
 const offering=await room();await identity(staff);
 const initial=(await sql<{value:Record<string,unknown>}>("select value from site_content where key='settings'"))[0].value;
 const options=Array.from({length:3},(_,i)=>({id:crypto.randomUUID(),label:'Method '+(i+1),qr_url:'/images/qr.jpg',recipient:'Test recipient',instructions:'Fictional test only'}));
 const settings={...initial,payment_options:options,payment_ready:true};
 await sql('select save_content($1)',[settings]);await identity(guest);
 const booking=await hold(offering);
 const snapshot=(await sql<{snapshot:{payment:{payment_options:unknown[]}}}>('select snapshot from bookings where id=$1',[booking.id]))[0].snapshot;
 assert.deepEqual(snapshot.payment.payment_options,options);
 await assert.rejects(sql('select save_content($1)',[settings]),/Admin access/);
 await identity(staff);
 for(const invalid of [null,{},[...options,{...options[0],id:crypto.randomUUID()}],[options[0],options[0]],[{...options[0],recipient:' '}],[{...options[0],qr_url:'javascript:alert(1)'}]])await assert.rejects(sql('select save_content($1)',[{...settings,payment_options:invalid}]),/complete payment options/);
 await assert.rejects(sql('select save_content($1)',[{...settings,payment_options:[]}]),/complete payment option/);
 await sql('select save_content($1)',[{...settings,payment_options:[],payment_ready:false}]);
 await identity(guest);await assert.rejects(hold(offering),/payment is not configured/);
 assert.deepEqual((await sql<{snapshot:unknown}>('select snapshot from bookings where id=$1',[booking.id]))[0].snapshot,snapshot);
 await identity(staff);await sql('select save_content($1)',[initial]);
});


test('appearance settings persist and database rejects malformed images and palettes',async()=>{
 await identity(staff);
 const settings=(await sql<{value:Record<string,unknown>}>("select value from site_content where key='settings'"))[0].value;
 const appearance={...settings,logo:{src:'/images/cabana.jpg',alt:'Camp logo'},palette:{forest:'#123456'},images:{hero:{src:'/images/hills.jpg',alt:'Green hills'}},gallery:[]};
 await sql('select save_content($1)',[appearance]);
 assert.deepEqual((await sql<{value:Record<string,unknown>}>("select value from site_content where key='settings'"))[0].value.palette,{forest:'#123456'});
 for(const patch of [{palette:{forest:'red'}},{palette:{bogus:'#123456'}},{images:{hero:{src:'javascript:bad',alt:'Bad'}}},{images:{unknown:{src:'/images/hills.jpg',alt:'Bad'}}},{logo:{src:'/images/hills.jpg',alt:''}},{gallery:Array(21).fill({src:'/images/hills.jpg',alt:'Hills'})}])await assert.rejects(sql('select save_content($1)',[{...appearance,...patch}]),/Invalid|up to 20/);
 await identity(guest);await assert.rejects(sql('select save_content($1)',[appearance]),/Admin access/);
 await assert.rejects(sql("select valid_site_image('{}')"),/permission denied/);
});

test('only the owner can erase an active unpaid hold and reuse its capacity',async()=>{
 const offering=await room();await identity(guest);const b=await hold(offering);
 await identity(second);await assert.rejects(sql('select delete_unpaid_booking($1)',[b.id]),/Booking not found/);
 await identity('', 'anon');await assert.rejects(sql('select delete_unpaid_booking($1)',[b.id]),/permission denied/);
 await identity(guest);await assert.rejects(sql('select erase_booking($1,true)',[b.id]),/permission denied/);
 await sql('select delete_unpaid_booking($1)',[b.id]);assert.equal((await sql('select id from bookings where id=$1',[b.id])).length,0);
 await assert.rejects(sql('select delete_unpaid_booking($1)',[b.id]),/Booking not found/);
 const replacement=await hold(offering);assert.ok(replacement.id);
 await db.exec('reset role');assert.equal((await sql('select * from audit_events where record_id=$1',[b.id])).length,0);
 assert.equal((await sql('select * from receipt_cleanup_jobs where prefix=$1',[guest+'/'+b.id])).length,1);
 await identity(guest);await assert.rejects(sql('select * from receipt_cleanup_jobs'),/permission denied/);await assert.rejects(sql('select claim_receipt_cleanup_jobs()'),/permission denied/);
});

test('guest deletion rejects expired, review, confirmed, correction, declined and cancelled states',async()=>{
 for(const status of ['expired','pending_review','confirmed','correction_requested','declined','cancelled']){
  const offering=await room();await identity(guest);const b=await hold(offering);await db.exec('reset role');await sql('update bookings set status=$1 where id=$2',[status,b.id]);await identity(guest);
  await assert.rejects(sql('select delete_unpaid_booking($1)',[b.id]),/Only an active/);
 }
 const offering=await room();await identity(guest);const b=await hold(offering);await db.exec('reset role');await sql("update bookings set expires_at=now()-interval '1 second' where id=$1",[b.id]);await identity(guest);await assert.rejects(sql('select delete_unpaid_booking($1)',[b.id]),/Only an active/);
});

test('cancelled permanent deletion erases financial history, receipts, promo usage and email jobs',async()=>{
 const offering=await room();const code='ERASETEST';await promo(code);await identity(guest);const b=await hold(offering,code);
 const receipt=crypto.randomUUID(),path=guest+'/'+b.id+'/'+receipt+'.png';await db.exec('reset role');await sql("insert into storage.objects(bucket_id,name) values('receipts',$1)",[path]);
 await identity('','service_role');await sql('select submit_receipt($1,$2,$3,$4,$5)',[b.id,path,'FICTIONAL-PAYMENT',receipt,guest]);
 await identity(staff);await sql("select record_payment($1,$2,'gcash',$3,'Verified',$4,true,$5)",[b.id,b.deposit,campDate(),crypto.randomUUID(),receipt]);
 await sql('select record_refund($1,$2,$3,$4,$5)',[b.id,100,campDate(),'Fictional refund',crypto.randomUUID()]);
 await assert.rejects(sql('select delete_cancelled_booking($1)',[b.id]),/Only cancelled/);
 await sql("select review_booking($1,'cancel','Guest request',null,'',null,null)",[b.id]);
 await identity(guest);await assert.rejects(sql('select delete_cancelled_booking($1)',[b.id]),/Admin access/);
 await identity(staff);
 const from=campDate(),until=addDays(from,1);
 const before=(await sql<{r:{collections:number;refunds:number}}>('select admin_report($1,$2,$3) r',[from,until,offering]))[0].r;
 await sql('select delete_cancelled_booking($1)',[b.id]);
 for(const table of ['bookings','receipts','email_jobs','payment_entries','promo_redemptions'])assert.equal((await sql('select * from '+table+' where '+(table==='bookings'?'id':'booking_id')+'=$1',[b.id])).length,0);
 const after=(await sql<{r:{collections:number;refunds:number}}>('select admin_report($1,$2,$3) r',[from,until,offering]))[0].r;
 assert.ok(before.collections>after.collections);assert.ok(before.refunds>after.refunds);
 await db.exec('reset role');assert.equal((await sql('select * from audit_events where record_id=$1',[b.id])).length,0);
 // File removal is external; SQL retains a retry job rather than pretending to erase storage.
 assert.equal((await sql('select * from storage.objects where name=$1',[path])).length,1);
 await identity('','service_role');const jobs=await sql('select * from claim_receipt_cleanup_jobs()');assert.ok(jobs.length>0);assert.equal((await sql('select * from claim_receipt_cleanup_jobs()')).length,0);
});

test('deletion waits for active email leases and succeeds after the lease expires',async()=>{
 const offering=await room();await identity(guest);const b=await hold(offering);await identity(staff);await sql("select review_booking($1,'cancel','Guest request',null,'',null,null)",[b.id]);
 await db.exec('reset role');await sql("update email_jobs set status='sending',locked_at=now() where booking_id=$1",[b.id]);await identity(staff);
 await assert.rejects(sql('select delete_cancelled_booking($1)',[b.id]),/email is being sent/);
 assert.equal((await sql('select id from bookings where id=$1',[b.id])).length,1);
 await db.exec('reset role');await sql("update email_jobs set locked_at=now()-interval '6 minutes' where booking_id=$1",[b.id]);await identity(staff);await sql('select delete_cancelled_booking($1)',[b.id]);
 await identity('','service_role');await assert.rejects(sql('select submit_receipt($1,$2,$3,$4,$5)',[b.id,guest+'/'+b.id+'/late.png','LATE',crypto.randomUUID(),guest]),/Booking not found/);
});


test('daily overlap includes ongoing overnight stays and excludes exact departure and next-day arrivals',()=>{
 const selected='2027-02-01';
 assert.equal(overlapsDay('2027-01-31T14:00:00+08:00','2027-02-02T12:00:00+08:00',selected),true);
 assert.equal(overlapsDay('2027-02-01T09:00:00+08:00','2027-02-01T17:00:00+08:00',selected),true);
 assert.equal(overlapsDay('2027-01-31T14:00:00+08:00','2027-02-01T00:00:00+08:00',selected),false);
 assert.equal(overlapsDay('2027-02-02T00:00:00+08:00','2027-02-02T17:00:00+08:00',selected),false);
});

async function proofFor(booking:string,actor=staff){
 await db.exec('reset role');const id=crypto.randomUUID(),path=`${actor}/${booking}/${id}.png`;
 await sql('insert into storage.objects(bucket_id,name) values(\'receipts\',$1)',[path]);
 await identity('', 'service_role');const r=(await sql<{id:string}>('select * from register_payment_proof($1,$2,$3,$4)',[booking,path,id,actor]))[0];await identity(staff);return r.id;
}
async function manualBooking(){const offering=await room();await identity(staff);const b=(await sql<{id:string;total:number;deposit:number}>("select * from create_hold($1,$2,$3,'',2,1,'Manual Guest','09123456789',$4,'manual@example.test')",[offering,day,end,crypto.randomUUID()]))[0];return{...b,offering};}

test('GCash deposit plus cash balance preserves two methods, proof, retries and completion history',async()=>{
 const b=await manualBooking(),receipt=await proofFor(b.id),request=crypto.randomUUID();
 await sql('select record_payment($1,$2,\'gcash\',$3,\'GCASH-123\',$4,false,$5)',[b.id,b.deposit,campDate(),request,receipt]);
 await sql('select record_payment($1,$2,\'gcash\',$3,\'GCASH-123\',$4,false,$5)',[b.id,b.deposit,campDate(),request,receipt]);
 await assert.rejects(sql('select record_payment($1,$2,\'bank\',$3,\'GCASH-123\',$4,false,$5)',[b.id,b.deposit,campDate(),request,receipt]),/retry differs/);
 const remaining=b.total-b.deposit;
 await assert.rejects(sql('select record_payment($1,$2,\'gcash\',$3,\'GCASH-456\',$4,false,$5)',[b.id,remaining,campDate(),crypto.randomUUID(),receipt]),/unlinked payment proof/);
 await assert.rejects(sql('select finish_booking($1)',[b.id]),/arrived, fully paid/);
 await sql('select record_payment($1,$2,\'cash\',$3,\'Arrival cash\',$4)',[b.id,remaining,campDate(),crypto.randomUUID()]);
 await assert.rejects(sql('select record_payment($1,1,\'cash\',$2,\'\',$3)',[b.id,campDate(),crypto.randomUUID()]),/exceeds/);
 await db.exec('reset role');await sql("update bookings set starts_at=now()-interval '1 hour' where id=$1",[b.id]);await identity(staff);
 const finished=(await sql<{status:string;finished_at:string}>('select * from finish_booking($1)',[b.id]))[0];assert.equal(finished.status,'finished');assert.ok(finished.finished_at);
 await sql('select finish_booking($1)',[b.id]);
 assert.equal((await sql<{n:number}>("select count(*)::int n from audit_events where record_id=$1 and action='booking_finished'",[b.id]))[0].n,1);
 const entries=await sql<{method:string;amount:number;actor:string}>('select method,amount,actor from payment_entries where booking_id=$1 order by created_at',[b.id]);assert.deepEqual(entries.map(e=>e.method),['gcash','cash']);assert.ok(entries.every(e=>e.actor===staff));
 const linked=(await sql<{payment_entry_id:string}>('select payment_entry_id from receipts where id=$1',[receipt]))[0];assert.ok(linked.payment_entry_id);
 const report=(await sql<{r:{methods:{method:string;collections:number}[];booking_value:number}}>('select admin_report($1,$2,$3) r',[campDate(),addDays(campDate(),1),b.offering]))[0].r;assert.equal(report.booking_value,b.total);assert.equal(report.methods.reduce((n,m)=>n+m.collections,0),b.total);await identity(guest);await assert.rejects(hold(b.offering),/available/);await identity(staff);
 await sql('select record_refund($1,100,$2,\'Refunded cash\',$3,\'cash\')',[b.id,campDate(),crypto.randomUUID()]);
 const refunded=(await sql<{paid:number;refunded:number;status:string}>('select paid,refunded,status from bookings where id=$1',[b.id]))[0];assert.equal(refunded.paid-refunded.refunded,b.total-100);assert.equal(refunded.status,'finished');
 await sql('select record_payment($1,100,\'cash\',$2,\'Repaid\',$3)',[b.id,campDate(),crypto.randomUUID()]);
});

test('online balance requires booking-specific proof and admin operations deny guests',async()=>{
 const a=await manualBooking(),b=await manualBooking(),receipt=await proofFor(a.id);
 await assert.rejects(sql('select record_payment($1,100,\'gcash\',$2,\'ONLINE-1\',$3)',[a.id,campDate(),crypto.randomUUID()]),/proof/);
 await assert.rejects(sql('select record_payment($1,100,\'bank\',$2,\'ONLINE-2\',$3,false,$4)',[b.id,campDate(),crypto.randomUUID(),receipt]),/proof/);
 await assert.rejects(sql('select record_payment($1,100,\'cash\',$2,\'\',$3,false,$4)',[a.id,campDate(),crypto.randomUUID(),receipt]),/Cash payments/);
 await assert.rejects(sql("select review_booking($1,'balance','Bypass',100)",[a.id]),/Record payment/);
 await identity(guest);
 for(const query of ["select record_payment($1,100,'cash',current_date,'',gen_random_uuid())","select finish_booking($1)","select save_settings_section('website','{}')"])await assert.rejects(sql(query,query.includes('$1')?[a.id]:[]),/Admin access/);
 await assert.rejects(sql('select register_payment_proof($1,\'path\',gen_random_uuid(),$2)',[a.id,guest]),/permission denied/);
 assert.equal((await sql('select * from receipts where booking_id=$1',[a.id])).length,0);
 await identity(staff);await sql("select review_booking($1,'cancel','Cancelled by guest')",[a.id]);await assert.rejects(sql('select record_payment($1,100,\'cash\',$2,\'\',$3)',[a.id,campDate(),crypto.randomUUID()]),/cannot receive/);
});

test('website and payment section saves merge without overwriting and reject cross-section fields',async()=>{
 await identity(staff);const initial=(await sql<{value:Record<string,unknown>}>("select value from site_content where key='settings'"))[0].value;
 const options=[{id:crypto.randomUUID(),label:'GCash',method:'gcash',qr_url:'/images/qr.png',recipient:'Fictional campsite',instructions:''}];
 await sql("select save_settings_section('payment',$1)",[{payment_options:options,payment_ready:true}]);
 await sql("select save_settings_section('website',$1)",[{tagline:'A verified campsite tagline'}]);
 const saved=(await sql<{value:{tagline:string;payment_options:unknown[]}}>("select value from site_content where key='settings'"))[0].value;assert.deepEqual(saved.payment_options,options);assert.equal(saved.tagline,'A verified campsite tagline');
 await assert.rejects(sql("select save_settings_section('website',$1)",[{payment_ready:false}]),/does not belong/);
 await assert.rejects(sql("select save_settings_section('payment',$1)",[{payment_options:[{...options[0],method:'invalid'}]}]),/Choose the method/);
 await sql('select save_content($1)',[initial]);
});

test('guest payment selection is snapshotted and proof confirmation records that payment',async()=>{
 const offering=await room();await identity(staff);const option={id:crypto.randomUUID(),label:'GCash',method:'gcash',qr_url:'/images/qr.png',recipient:'Fictional campsite',instructions:''};
 await sql("select save_settings_section('payment',$1)",[{payment_options:[option],payment_ready:true}]);
 await identity(guest);const b=await hold(offering);await db.exec('reset role');const receipt=crypto.randomUUID(),path=`${guest}/${b.id}/${receipt}.png`;await sql("insert into storage.objects(bucket_id,name) values('receipts',$1)",[path]);
 await identity('', 'service_role');await assert.rejects(sql('select submit_selected_receipt($1,$2,\'TX-123\',$3,$4,$5)',[b.id,path,receipt,second,option.id]),/Booking not found/);
 await assert.rejects(sql('select submit_selected_receipt($1,$2,\'TX-123\',$3,$4,$5)',[b.id,path,receipt,guest,crypto.randomUUID()]),/Choose a payment option/);
 await sql('select submit_selected_receipt($1,$2,\'TX-123\',$3,$4,$5)',[b.id,path,receipt,guest,option.id]);
 await identity(guest);const visible=(await sql<{method:string;payment_option_id:string}>('select method,payment_option_id from receipts where id=$1',[receipt]))[0];assert.equal(visible.method,'gcash');assert.equal(visible.payment_option_id,option.id);
 await identity(staff);await sql("select save_settings_section('payment',$1)",[{payment_options:[],payment_ready:false}]);
 await sql('select record_payment($1,$2,\'gcash\',$3,\'TX-123\',$4,true,$5)',[b.id,b.deposit,campDate(),crypto.randomUUID(),receipt]);
 assert.equal((await sql<{status:string}>('select status from bookings where id=$1',[b.id]))[0].status,'confirmed');
});

test('staff arrival payment proof and prepared upload prefixes survive retry and deletion races',async()=>{
 const b=await manualBooking();await identity('', 'service_role');await sql('select prepare_payment_proof($1,$2)',[b.id,staff]);await identity(staff);
 const proof=await proofFor(b.id);await sql('select record_payment($1,$2,\'bank\',$3,\'ARRIVAL-ONLINE\',$4,false,$5)',[b.id,b.total,campDate(),crypto.randomUUID(),proof]);
 assert.equal((await sql<{paid:number}>('select paid from bookings where id=$1',[b.id]))[0].paid,b.total);
 await sql("select review_booking($1,'cancel','Guest cancellation')",[b.id]);await sql('select delete_cancelled_booking($1)',[b.id]);
 await identity('', 'service_role');assert.equal((await sql('select * from receipt_cleanup_jobs where prefix=$1',[`${staff}/${b.id}`])).length,1);
 await assert.rejects(sql('select register_payment_proof($1,$2,$3,$4)',[b.id,`${staff}/${b.id}/late.png`,crypto.randomUUID(),staff]),/Booking not found/);
});
