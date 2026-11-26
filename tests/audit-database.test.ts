import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.waitReady;
async function sql<T=Record<string,unknown>>(text:string,args:unknown[]=[]){return(await db.query<T>(text,args)).rows;}
async function identity(user:string,role='authenticated'){await db.exec('reset role');await sql("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec(`set role ${role}`);}
async function fixture(capacity=20){
 await db.exec('reset role');const user=crypto.randomUUID(),resource=crypto.randomUUID(),offering=crypto.randomUUID();
 await sql("insert into auth.users values($1,'fictional@example.test',now())",[user]);
 await sql("insert into resources(id,name,capacity) values($1,'Audit pool',$2)",[resource,capacity]);
 await sql("insert into offerings(id,name,slug,kind,published,resource_id,max_guests,price,price_basis,schedule) values($1,'Audit stay',($1::uuid)::text,'room',true,$2,4,10000,'night','overnight')",[offering,resource]);
 await identity(user);return{user,resource,offering};
}
async function hold(id:string,request=crypto.randomUUID(),start='2027-05-01',end='2027-05-03',manual:string|null=null){
 return(await sql<{id:string;status:string}>("select * from create_hold($1,$2,$3,'',1,1,'Fictional Guest','09123456789',$4,$5,null,'09:00')",[id,start,end,request,manual]))[0];
}
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`);
 for(const name of ['001_booking','002_administration','003_payment_options','004_appearance_deletion','005_payments_settings','006_booking_experience','007_audit_hardening']){
  if(name==='007_audit_hardening'){
   const source=await readFile(new URL('../supabase/migrations/005_payments_settings.sql',import.meta.url),'utf8');
   await db.exec(source.slice(source.indexOf('create or replace function admin_report'),source.indexOf('\n-- Guest choice')).replace('function admin_report','function audit_report_baseline'));
   await db.exec('revoke all on function audit_report_baseline(date,date,uuid) from public,anon,authenticated');
  }
  await db.exec((await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''));
 }
 await db.exec(`update site_content set value=value||' {"payment_ready":true,"payment_options":[{"id":"10000000-0000-4000-8000-000000000005","label":"GCash","method":"gcash","qr_url":"/images/qr.jpg","recipient":"Test camp","instructions":"Fictional only"}]}'::jsonb;`);
});
after(()=>db.close());
test('peak occupancy permits adjacent allocations across a longer stay but rejects a real peak',async()=>{
 const f=await fixture(2);await hold(f.offering,crypto.randomUUID(),'2027-05-01','2027-05-02');await hold(f.offering,crypto.randomUUID(),'2027-05-02','2027-05-03');
 await identity('','service_role');const q=await sql<{q:{available:boolean;remaining:number}}>("select quote_for_actor($1,'2027-05-01','2027-05-03','09:00',1,1) q",[f.offering]);assert.equal(q[0].q.available,true);assert.equal(q[0].q.remaining,1);
 await identity(f.user);await hold(f.offering);await assert.rejects(hold(f.offering),/three unresolved/);
 await identity('','service_role');assert.equal((await sql<{q:{available:boolean}}>("select quote_for_actor($1,'2027-05-01','2027-05-03','09:00',1,1) q",[f.offering]))[0].q.available,false);
});
test('guest quotas include unresolved proofs, allow retries and survive hold deletion',async()=>{
 const f=await fixture();const request=crypto.randomUUID(),first=await hold(f.offering,request);await hold(f.offering);const third=await hold(f.offering);
 await db.exec('reset role');await sql("update bookings set status='correction_requested' where id=$1",[first.id]);await identity(f.user);
 assert.equal((await hold(f.offering,request)).id,first.id);await assert.rejects(hold(f.offering),/three unresolved/);
 await sql('select delete_unpaid_booking($1)',[third.id]);await hold(f.offering);
 // Expiry releases active quota, but not rolling-hour creation history.
 for(let i=0;i<6;i++){await db.exec('reset role');await sql("update bookings set expires_at=now()-interval '1 minute' where user_id=$1 and status='awaiting_payment'",[f.user]);await identity(f.user);await hold(f.offering);}
 await db.exec('reset role');await sql("update bookings set expires_at=now()-interval '1 minute' where user_id=$1 and status='awaiting_payment'",[f.user]);await identity(f.user);
 await assert.rejects(hold(f.offering),/Hourly reservation limit/);
 await assert.rejects(sql('select * from hold_creation_events'),/permission denied/);
 await assert.rejects(sql("select consume_rate_limit('forged',1,1)"),/permission denied/);
});
test('manual staff reservations are exempt and direct public quote execution is revoked',async()=>{
 const f=await fixture();await db.exec('reset role');await sql('insert into admins values($1)',[f.user]);await identity(f.user);
 for(let i=0;i<4;i++)await hold(f.offering,crypto.randomUUID(),'2027-06-01','2027-06-02','walkin@example.test');
 await assert.rejects(sql("select booking_quote($1,'2027-05-01','2027-05-03','',1,1,null,null,'09:00')",[f.offering]),/permission denied/);
 await assert.rejects(sql("select quote_for_actor($1,'2027-05-01','2027-05-03','09:00',1,1)",[f.offering]),/permission denied/);
 await identity('','anon');await assert.rejects(sql("select booking_quote($1,'2027-05-01','2027-05-03','',1,1,null,null,'09:00')",[f.offering]),/permission denied/);
 await identity('','service_role');const batch=await sql<{q:{id:string;available:boolean}[]}>("select public_availability('2027-07-01','2027-07-02','09:00',1) q");assert.ok(batch[0].q.some(q=>q.id===f.offering&&q.available));
});
test('shared pools, expired holds and blackouts still govern the corrected quote',async()=>{
 const f=await fixture(1);await hold(f.offering);await db.exec('reset role');const other=crypto.randomUUID();
 await sql("insert into offerings(id,name,slug,kind,published,resource_id,max_guests,price,price_basis,schedule) values($1,'Shared audit stay',($1::uuid)::text,'room',true,$2,4,10000,'night','overnight')",[other,f.resource]);
 await identity('','service_role');const quote=async()=>(await sql<{q:{available:boolean}}>("select quote_for_actor($1,'2027-05-01','2027-05-03','09:00',1,1) q",[other]))[0].q.available;
 assert.equal(await quote(),false);await db.exec('reset role');await sql("update bookings set expires_at=now()-interval '1 minute' where user_id=$1",[f.user]);await identity('','service_role');assert.equal(await quote(),true);
 await db.exec('reset role');await sql("insert into blackouts(resource_id,starts_at,ends_at,reason) values($1,'2027-05-02T00:00+08','2027-05-02T01:00+08','Fictional maintenance')",[f.resource]);await identity('','service_role');assert.equal(await quote(),false);
 await assert.rejects(sql("select quote_for_actor($1,'2027-05-01','2027-05-03','09:00',1,1,'',null,'someone@example.test',$2)",[other,f.user]),/Admin access/);
});
test('atomic counters enforce shared windows, expiry and service-only access',async()=>{
 await identity('','service_role');assert.equal((await sql<{n:number}>("select consume_rate_limit('fictional',2,60) n"))[0].n,0);assert.equal((await sql<{n:number}>("select consume_rate_limit('fictional',2,60) n"))[0].n,0);assert.ok((await sql<{n:number}>("select consume_rate_limit('fictional',2,60) n"))[0].n>0);
 await db.exec('reset role');await db.exec("update rate_limit_counters set expires_at=now()-interval '1 minute' where key='fictional'");await identity('','service_role');assert.equal((await sql<{n:number}>("select consume_rate_limit('fictional',2,60) n"))[0].n,0);
 await assert.rejects(sql('select * from rate_limit_counters'),/permission denied/);
});
test('grouped reporting reconciles with the prior report across 601 rows and Manila date boundaries',async()=>{
 const f=await fixture();await db.exec('reset role');await sql('insert into admins values($1)',[f.user]);
 await sql(`insert into bookings(guest_email,guest_name,phone,offering_id,resource_id,offering_name,starts_at,ends_at,guests,units,allocation,total,deposit,request_id,snapshot,status,created_at)
 select 'fictional@example.test','Fictional Guest','09123456789',o.id,o.resource_id,o.name,'2027-05-01T00:00+08'::timestamptz+n*interval '1 minute','2027-05-03T00:00+08'::timestamptz,1,1,1,100,50,gen_random_uuid(),'{}','confirmed','2027-05-01T00:00+08'::timestamptz+n*interval '1 minute' from offerings o cross join generate_series(1,601) n where o.id=$1`,[f.offering]);
 const booking=(await sql<{id:string}>('select id from bookings where offering_id=$1 limit 1',[f.offering]))[0].id;
 await sql('update bookings set paid=100 where id=$1',[booking]);
 await sql(`insert into payment_entries(booking_id,kind,amount,method,occurred_at,request_id) values
 ($1,'opening',10,'unspecified',null,gen_random_uuid()),($1,'payment',60,'gcash','2027-04-30T16:00Z',gen_random_uuid()),
 ($1,'payment',30,'cash','2027-05-01T16:00Z',gen_random_uuid()),($1,'refund',20,'cash','2027-05-01T16:00Z',gen_random_uuid())`,[booking]);
 await sql("select set_config('request.jwt.claim.sub',$1,false)",[f.user]);
 const reports=await sql<{a:{booking_value:number;collections:number;refunds:number;opening:number;daily:{booking_value:number;collections:number;refunds:number}[]};b:unknown}>("select admin_report('2027-05-01','2027-05-04',$1) a,audit_report_baseline('2027-05-01','2027-05-04',$1) b",[f.offering]);
 assert.deepEqual(reports[0].a,reports[0].b);assert.equal(reports[0].a.booking_value,60100);assert.equal(reports[0].a.daily[0].booking_value,60100);
 assert.equal(reports[0].a.collections,90);assert.equal(reports[0].a.refunds,20);assert.equal(reports[0].a.opening,10);assert.equal(reports[0].a.daily[0].collections,60);assert.equal(reports[0].a.daily[1].collections,30);assert.equal(reports[0].a.daily[1].refunds,20);
 await identity(f.user);await assert.rejects(sql("select * from audit_report_baseline('2027-05-01','2027-05-04',$1)",[f.offering]),/permission denied/);
});
test('expired final email leases become retryable failures and claim tokens change',async()=>{
 await db.exec('reset role');await db.exec("delete from email_jobs;insert into email_jobs(recipient,subject,body,status,attempts,locked_at) values('fictional@example.test','Test','Test','sending',8,now()-interval '6 minutes')");
 await identity('','service_role');assert.equal((await sql('select * from claim_email_jobs()')).length,0);
 await db.exec('reset role');const failed=await sql<{id:string;status:string;last_error:string}>('select * from email_jobs');assert.equal(failed[0].status,'failed');assert.match(failed[0].last_error,/final attempt/);
 await sql("update email_jobs set attempts=0,status='queued' where id=$1",[failed[0].id]);await identity('','service_role');const jobs=await sql<{id:string;lease_token:string}>('select * from claim_email_jobs()');assert.ok(jobs[0].lease_token);
 await db.exec('reset role');await sql("update email_jobs set locked_at=now()-interval '6 minutes' where id=$1",[jobs[0].id]);await identity('','service_role');const next=await sql<{lease_token:string}>('select * from claim_email_jobs()');assert.notEqual(jobs[0].lease_token,next[0].lease_token);
 assert.equal((await sql('update email_jobs set status=\'sent\' where id=$1 and lease_token=$2 returning id',[jobs[0].id,jobs[0].lease_token])).length,0);
 await sql('select pause_email_delivery(120)');assert.equal((await sql('select * from claim_email_jobs()')).length,0);
});
