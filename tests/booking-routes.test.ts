import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextRequest} from 'next/server';
import * as validation from '../src/lib/validation';
import * as draft from '../src/lib/booking-draft';
import * as dates from '../src/lib/admin-dates';
const require=createRequire(import.meta.url);
// Run the actual handlers with isolated provider adapters; no live credentials or records.
async function handlers(path:string,adapters:Record<string,unknown>){
 const source=await readFile(new URL('../src/app/'+path,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports:Record<string,Function>={};
 new Function('require','exports',compiled)((name:string)=>name in adapters?adapters[name]:require(name),exports);
 return exports;
}
test('personal history isolates two admins and a guest while staff listing remains shared and ordered',async()=>{
 let user:{id:string;admin:boolean}|null=null;
 const records=[
  {id:'a',user_id:'admin-a',starts_at:'2027-06-01',created_at:'2026-11-01'},
  {id:'b',user_id:'admin-b',starts_at:'2027-02-01',created_at:'2026-11-03'},
  {id:'c',user_id:'guest',starts_at:'2027-03-01',created_at:'2026-11-02'},
  {id:'d',user_id:null,starts_at:'2027-04-01',created_at:'2026-11-04'},
 ];
 const client={from:(table:string)=>{
  assert.equal(table,'bookings');let rows=records.filter(r=>user?.admin||r.user_id===user?.id);const sorts:{key:string;ascending:boolean}[]=[];let offset=0,end=Infinity;
  const q={select:()=>q,eq:(key:string,value:unknown)=>{rows=rows.filter(r=>r[key as keyof typeof r]===value);return q;},order:(key:string,opts?:{ascending:boolean})=>{sorts.push({key,ascending:opts?.ascending!==false});return q;},limit:()=>q,range:(from:number,until:number)=>{offset=from;end=until+1;return q;},then:(resolve:Function)=>{
   rows.sort((a,b)=>{for(const {key,ascending}of sorts){const diff=String(a[key as keyof typeof a]).localeCompare(String(b[key as keyof typeof b]));if(diff)return ascending?diff:-diff;}return 0;});
   return Promise.resolve(resolve({data:rows.slice(offset,end),error:null,count:rows.length}));
  }};return q;
 }};
 const h=await handlers('api/[...path]/route.ts',{'@/lib/supabase':{requireUser:async(admin=false)=>{if(!user)throw new Error('Sign in to continue.');if(admin&&!user.admin)throw new Error('Admin access required.');return {client,user};}},'@/lib/validation':validation,'@/lib/admin-dates':dates,'@/lib/booking-draft':draft,'@/lib/proof-cleanup':{}});
 async function get(path:string){return h.GET(new NextRequest('https://camp.example/api/'+path),{params:Promise.resolve({path:path.split('?')[0].split('/')})});}
 for(const id of ['admin-a','admin-b','guest']){user={id,admin:id!=='guest'};const response=await get('bookings?user_id=admin-a');assert.equal(response.status,200);assert.deepEqual((await response.json()).map((r:{user_id:string})=>r.user_id),[id]);}
 user={id:'admin-a',admin:true};const all=await get('admin/bookings?order=newest');assert.deepEqual((await all.json()).bookings.map((r:{id:string})=>r.id),['d','b','c','a']);
 for(let i=0;i<205;i++)records.push({id:'extra-'+String(i).padStart(3,'0'),user_id:'guest',starts_at:'2027-07-01',created_at:'2026-11-05'});
 const first=await(await get('admin/bookings?order=newest&page=0')).json(),second=await(await get('admin/bookings?order=newest&page=1')).json(),last=await(await get('admin/bookings?order=newest&page=2')).json();
 assert.equal(first.total,209);assert.equal(first.bookings.length,100);assert.equal(second.bookings.length,100);assert.equal(last.bookings.length,9);assert.equal(first.bookings[0].id,'extra-204');assert.equal(new Set([...first.bookings,...second.bookings,...last.bookings].map(r=>r.id)).size,209);
 user={id:'guest',admin:false};assert.equal((await get('admin/bookings')).status,403);
 user=null;assert.equal((await get('bookings')).status,401);
});
test('signup and reset links carry safe booking returns; callbacks preserve recovery and reject external redirects',async()=>{
 let redirect='',exchangeError:unknown=null;
 const client={auth:{signUp:async(input:{options:{emailRedirectTo:string}})=>{redirect=input.options.emailRedirectTo;return {data:{session:null},error:null};},resetPasswordForEmail:async(_email:string,input:{redirectTo:string})=>{redirect=input.redirectTo;return {data:{},error:null};},exchangeCodeForSession:async()=>({error:exchangeError})}};
 const adapters={'@/lib/supabase':{db:async()=>client},'@/lib/validation':validation,'@/lib/admin-dates':dates,'@/lib/booking-draft':draft,'@/lib/proof-cleanup':{}};
 const api=await handlers('api/[...path]/route.ts',adapters),callback=await handlers('auth/callback/route.ts',adapters);
 const returnTo='/stays/test-cabana?draft=10000000-0000-4000-8000-000000000001';
 async function auth(action:string,next=returnTo){const r=await api.POST(new NextRequest('https://camp.example/api/auth',{method:'POST',headers:{origin:'https://camp.example',host:'camp.example','content-type':'application/json'},body:JSON.stringify({action,email:'fictional@example.test',password:'FictionalPassword123',returnTo:next})}),{params:Promise.resolve({path:['auth']})});assert.equal(r.status,200);return new URL(redirect);}
 let url=await auth('signup');assert.equal(url.searchParams.get('next'),returnTo);url.searchParams.set('code','fictional');let r=await callback.GET(new NextRequest(url));assert.equal(r.headers.get('location'),'https://camp.example'+returnTo);
 url=await auth('reset');assert.equal(url.searchParams.get('reset'),'1');url.searchParams.set('code','fictional');r=await callback.GET(new NextRequest(url));let target=new URL(r.headers.get('location')!);assert.equal(target.pathname,'/account');assert.equal(target.searchParams.get('reset'),'1');assert.equal(target.searchParams.get('next'),returnTo);
 url=await auth('signup','https://evil.example');assert.equal(url.searchParams.has('next'),false);
 exchangeError=new Error('Expired');r=await callback.GET(new NextRequest('https://camp.example/auth/callback?code=expired&next='+encodeURIComponent(returnTo)));target=new URL(r.headers.get('location')!);assert.equal(target.pathname,'/account');assert.equal(target.searchParams.get('error'),'verification');assert.equal(target.searchParams.get('next'),returnTo);
});
test('worker sends distinct staff links without BCC, and failed sends remain retryable',async()=>{
 const saved={...process.env},originalFetch=globalThis.fetch;
 try{
  process.env.CRON_SECRET='fictional-test';process.env.RESEND_API_KEY='fictional-key';process.env.EMAIL_FROM='Yvander’s Nature Hills <bookings@example.test>';process.env.APP_URL='https://camp.example';process.env.ADMIN_EMAIL='legacy@example.test';
  const jobs=[{id:'one',booking_id:'booking-a',audience:'admin',recipient:'staff@example.test',subject:'New booking',body:'Test',attempts:1},{id:'two',booking_id:'booking-b',audience:'guest',recipient:'guest@example.test',subject:'Confirmation',body:'Test',attempts:1}];
  const updates:{status:string;id?:string}[]=[];
  const service={rpc:async()=>({data:jobs,error:null}),from:()=>({update:(value:{status:string})=>({eq:async(_key:string,id:string)=>{updates.push({...value,id});return {error:null};}})})};
  const h=await handlers('api/jobs/route.ts',{'@/lib/supabase':{service:()=>service},'@/lib/receipt-cleanup':{cleanDeletedReceipts:async()=>({cleaned:0,cleanupFailed:0})}});
  const bodies:{to:string[];bcc?:string[];text:string}[]=[];globalThis.fetch=async(_url,init)=>{bodies.push(JSON.parse(String(init?.body)));return new Response(null,{status:bodies.length===1?200:503});};
  assert.equal((await h.GET(new NextRequest('https://camp.example/api/jobs'))).status,401);
  const response=await h.GET(new NextRequest('https://camp.example/api/jobs',{headers:{authorization:'Bearer fictional-test'}}));assert.equal((await response.json()).sent,1);
  assert.ok(bodies.every(b=>!b.bcc));assert.match(bodies[0].text,/\/admin\?booking=booking-a/);assert.match(bodies[1].text,/\/account/);assert.deepEqual(updates.map(u=>u.status),['sent','failed']);
 }finally{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});
