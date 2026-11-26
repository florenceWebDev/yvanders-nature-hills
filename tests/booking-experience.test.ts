import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {parseDraft,safeBookingReturn} from '../src/lib/booking-draft';
import {searchSchema} from '../src/lib/validation';
const db=new PGlite();
const guest='10000000-0000-4000-8000-000000000001',staff='10000000-0000-4000-8000-000000000002',second='10000000-0000-4000-8000-000000000003';
const option='10000000-0000-4000-8000-000000000005';
async function identity(id:string,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);}
async function sql<T=Record<string,unknown>>(query:string,params:unknown[]=[]){return(await db.query<T>(query,params)).rows;}
async function offering(schedule='overnight',basis='night',kind='room'){
 await db.exec('reset role');const pool=crypto.randomUUID(),id=crypto.randomUUID();
 await sql('insert into resources(id,name,capacity) values($1,$2,1)',[pool,'Isolated pool']);
 await sql("insert into offerings(id,name,slug,kind,published,resource_id,max_guests,price,price_basis,schedule,slots) values($1::uuid,'Test stay',($1::uuid)::text,$2,true,$3,4,10000,$4,$5,$6)",[id,kind,pool,basis,schedule,JSON.stringify(schedule==='slots'?[{id:'day',label:'Legacy day',start:'08:00',end:'17:00'}]:[])]);
 await identity(guest);return id;
}
async function quote(id:string,arrival='2027-05-01',end='2027-05-03',time:string|null='09:15'){
 return(await sql<{q:{starts_at:string;ends_at:string;total:number;available:boolean}}>("select booking_quote($1,$2,$3,'',2,1,null,null,$4::time) q",[id,arrival,end,time]))[0].q;
}
async function hold(id:string,request=crypto.randomUUID(),manual:string|null=null,promo:string|null=null){
 return(await sql<{id:string;status:string;starts_at:string;ends_at:string;snapshot:Record<string,unknown>}>("select * from create_hold($1,'2027-05-01','2027-05-03','',2,1,'Test Guest','09123456789',$2,$3,$4,'09:15')",[id,request,manual,promo]))[0];
}
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`);
 for(const name of ['001_booking','002_administration','003_payment_options','004_appearance_deletion','005_payments_settings'])await db.exec((await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''));
 await db.exec(`insert into auth.users values('${guest}','guest@example.test',now()),('${staff}','staff@example.test',now()),('${second}','second@example.test',now());insert into admins values('${staff}'),('${second}');
 update site_content set value=value||'{"payment_ready":true,"payment_options":[{"id":"${option}","label":"GCash","method":"gcash","qr_url":"/images/qr.jpg","recipient":"Test camp","instructions":"Test only"}]}' where key='settings';`);
 const old=await offering();await identity(staff);
 await sql("select create_hold($1,'2027-04-01','2027-04-02','',2,1,'Legacy Guest','09123456789',$2,'legacy@example.test',null)",[old,crypto.randomUUID()]);
 const before=await sql('select id,starts_at,ends_at,snapshot from bookings');
 await db.exec('reset role');await db.exec(await readFile(new URL('../supabase/migrations/006_booking_experience.sql',import.meta.url),'utf8'));
 assert.deepEqual(await sql('select id,starts_at,ends_at,snapshot from bookings'),before);
});
after(()=>db.close());
test('every offering uses whole 24-hour days, with existing price bases and no fixed slot requirement',async()=>{
 for(const [kind,schedule,basis,total]of [['room','overnight','night',20000],['camping','overnight','guest',40000],['pavilion','slots','unit',10000],['day-use','slots','guest',40000]] as const){
  const id=await offering(schedule,String(basis),kind),q=await quote(id);
  assert.equal(new Date(q.ends_at).getTime()-new Date(q.starts_at).getTime(),48*3600000);assert.equal(q.total,total);assert.match(q.starts_at,/01:15/);
  await assert.rejects(quote(id,'2027-05-01','2027-05-03',null),/arrival time/);
  await assert.rejects(quote(id,'2027-05-01','2027-05-03','09:15:30'),/whole minutes/);
  await assert.rejects(quote(id,'2027-05-01','2027-05-01'),/1 to 60/);
  await assert.rejects(quote(id,'2027-05-01','2027-07-01'),/1 to 60/);
 }
});
test('holds snapshot timing, reject overlaps, permit exact boundaries and retain finished allocation',async()=>{
 const id=await offering();const b=await hold(id);assert.equal(b.snapshot.schedule_policy,'arrival_24h');
 assert.equal((await quote(id)).available,false);
 assert.equal((await quote(id,'2027-05-03','2027-05-04','09:15')).available,true);
 assert.equal((await quote(id,'2027-05-03','2027-05-04','09:14')).available,false);
 await db.exec('reset role');await sql("update bookings set status='finished' where id=$1",[b.id]);await identity(guest);
 assert.equal((await quote(id)).available,false);
 const vacant=await offering();await db.exec('reset role');await sql("insert into blackouts(resource_id,starts_at,ends_at,reason) select resource_id,'2027-05-01T09:00+08:00','2027-05-01T10:00+08:00','Test closure' from offerings where id=$1",[vacant]);await identity(guest);assert.equal((await quote(vacant)).available,false);
});
test('new booking alerts fan out once, include final promo totals, and cover manual bookings',async()=>{
 const id=await offering(),request=crypto.randomUUID(),b=await hold(id,request);await hold(id,request);
 await identity(staff);let jobs=await sql<{recipient:string;body:string}>("select recipient,body from email_jobs where booking_id=$1 and audience='admin'",[b.id]);
 assert.deepEqual(jobs.map(j=>j.recipient).sort(),['second@example.test','staff@example.test']);assert.ok(jobs.every(j=>j.body.includes('09:15')&&j.body.includes('Total PHP: 200')));
 await assert.rejects(sql("select queue_admin_booking_event($1,'fake','fake',null)",[b.id]),/permission denied/);
 const manual=await offering();await identity(staff);const m=await hold(manual,crypto.randomUUID(),'walkin@example.test');
 jobs=await sql("select recipient,body from email_jobs where booking_id=$1 and audience='admin'",[m.id]);assert.equal(jobs.length,2);
 const guestMail=await sql<{body:string}>("select body from email_jobs where booking_id=$1 and audience='guest'",[m.id]);assert.match(guestMail[0].body,/Arriving late does not extend/);assert.match(guestMail[0].body,/09:15/);
 const comp=await offering();await identity(staff);await sql("select save_promo($1)",[{code:'FREE24',enabled:true,kind:'percent',value:10000,min_subtotal:0,max_discount:null,offering_ids:[comp],booking_from:null,booking_until:null,stay_from:null,stay_until:null,usage_limit:null,customer_limit:null}]);
 await identity(guest);const complimentary=await hold(comp,crypto.randomUUID(),null,'FREE24');await identity(staff);
 const compJobs=await sql<{body:string}>("select body from email_jobs where booking_id=$1 and audience='admin'",[complimentary.id]);assert.equal(compJobs.length,2);assert.ok(compJobs.every(j=>j.body.includes('pending review')&&j.body.includes('Total PHP: 0')));
});
test('proof and verified-payment alerts are distinct, retry-safe and use current verified admins',async()=>{
 const id=await offering(),b=await hold(id),receipt=crypto.randomUUID(),path=`${guest}/${b.id}/${receipt}.png`;
 await db.exec('reset role');await sql('insert into storage.objects(bucket_id,name) values(\'receipts\',$1)',[path]);
 await identity('', 'service_role');for(let i=0;i<2;i++)await sql('select submit_selected_receipt($1,$2,$3,$4,$5,$6)',[b.id,path,'PAY-TEST',receipt,guest,option]);
 await identity(staff);let jobs=await sql<{subject:string}>("select subject from email_jobs where booking_id=$1 and audience='admin'",[b.id]);assert.equal(jobs.length,4);assert.equal(jobs.filter(j=>j.subject.includes('unverified')).length,2);
 const request=crypto.randomUUID();for(let i=0;i<2;i++)await sql("select record_payment($1,10000,'gcash',current_date,'PAY-TEST',$2,true,$3)",[b.id,request,receipt]);
 jobs=await sql("select subject from email_jobs where booking_id=$1 and audience='admin'",[b.id]);assert.equal(jobs.length,6);
 await db.exec('reset role');await sql('delete from admins where user_id=$1',[second]);await identity(staff);
 await sql("select record_payment($1,10000,'cash',current_date,'Cash balance',$2,false,null)",[b.id,crypto.randomUUID()]);
 jobs=await sql("select subject from email_jobs where booking_id=$1 and audience='admin'",[b.id]);assert.equal(jobs.length,7);
 await db.exec('reset role');await sql('insert into admins values($1)',[second]);await identity(guest);
 await assert.rejects(sql("select record_payment($1,1,'cash',current_date,'',$2,false,null)",[b.id,crypto.randomUUID()]),/Admin access/);
 assert.equal((await sql('select * from email_jobs')).length,0);
});
test('draft expiry and return destinations exclude unsafe redirects and preserve selection',()=>{
 const draft={version:1,id:crypto.randomUUID(),savedAt:1000,offering:crypto.randomUUID(),path:'/stays/test-cabana',values:{arrival:'2027-05-01',departure:'2027-05-03',arrival_time:'09:15',guests:2,units:1,promo:'WELCOME',name:'Fictional Guest',phone:'09123456789'}};
 assert.deepEqual(parseDraft(JSON.stringify(draft),2000),draft);
 for(const now of [999,86401000])assert.equal(parseDraft(JSON.stringify(draft),now),null);
 for(const url of ['https://evil.test','//evil.test','/stays/test\\evil','/admin','/stays/../admin','/stays/test#hash','/stays/test\n'])assert.equal(safeBookingReturn(url),null);
 assert.equal(safeBookingReturn('/stays/test-cabana?draft='+draft.id),'/stays/test-cabana?draft='+draft.id);
 assert.equal(parseDraft('broken'),null);
 for(const time of ['24:00','12:60','12:00:01',''])assert.equal(searchSchema.safeParse({offering:draft.offering,arrival:'2027-05-01',departure:'2027-05-03',arrival_time:time,guests:2,units:1}).success,false);
});
