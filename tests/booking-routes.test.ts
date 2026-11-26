import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextRequest} from 'next/server';
import * as validation from '../src/lib/validation';
import * as draft from '../src/lib/booking-draft';
import * as dates from '../src/lib/admin-dates';
import * as httpSecurity from '../src/lib/http-security';
import * as emailWorker from '../src/lib/email-worker';
const require=createRequire(import.meta.url);
// Run the actual handlers with isolated provider adapters; no live credentials or records.
async function handlers(path:string,adapters:Record<string,unknown>){
 const source=await readFile(new URL('../src/app/'+path,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports:Record<string,Function>={};
 adapters={'@/lib/http-security':httpSecurity,'@/lib/rate-limit':{userLimit:async()=>{},anonymousLimit:async()=>{},recoveryLimit:async()=>{}},'@/lib/email-worker':emailWorker,...adapters};
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
 for(const id of ['admin-a','admin-b','guest']){user={id,admin:id!=='guest'};const response=await get('bookings?user_id=admin-a');assert.equal(response.status,200);assert.deepEqual((await response.json()).bookings.map((r:{user_id:string})=>r.user_id),[id]);}
 user={id:'admin-a',admin:true};const all=await get('admin/bookings?order=newest');assert.deepEqual((await all.json()).bookings.map((r:{id:string})=>r.id),['d','b','c','a']);
 for(let i=0;i<205;i++)records.push({id:'extra-'+String(i).padStart(3,'0'),user_id:'guest',starts_at:'2027-07-01',created_at:'2026-11-05'});
 const first=await(await get('admin/bookings?order=newest&page=0')).json(),second=await(await get('admin/bookings?order=newest&page=1')).json(),last=await(await get('admin/bookings?order=newest&page=2')).json();
 assert.equal(first.total,209);assert.equal(first.bookings.length,100);assert.equal(second.bookings.length,100);assert.equal(last.bookings.length,9);assert.equal(first.bookings[0].id,'extra-204');assert.equal(new Set([...first.bookings,...second.bookings,...last.bookings].map(r=>r.id)).size,209);
 // Guest history must reach records beyond the former 500-row cap.
 for(let i=205;i<605;i++)records.push({id:'extra-'+String(i).padStart(3,'0'),user_id:'guest',starts_at:'2027-07-01',created_at:'2026-11-05'});
 user={id:'guest',admin:false};const history=[];
 for(let page=0;page<13;page++){const r=await(await get('bookings?page='+page)).json();assert.equal(r.total,606);history.push(...r.bookings);}
 assert.equal(history.length,606);assert.equal(new Set(history.map(r=>r.id)).size,606);assert.ok(history.every(r=>r.user_id==='guest'));
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
  let claimed=false;const service={rpc:async(name:string)=>{const data=name==='claim_email_jobs'?(claimed?[]:jobs):0;if(name==='claim_email_jobs')claimed=true;return{data,error:null};},from:()=>({update:(value:{status:string})=>{let id='';const q={eq:(key:string,val:string)=>{if(key==='id')id=val;return q;},select:async()=>{updates.push({...value,id});return {data:[{id}],error:null};}};return q;}})};
  const h=await handlers('api/jobs/route.ts',{'@/lib/supabase':{service:()=>service},'@/lib/receipt-cleanup':{cleanDeletedReceipts:async()=>({cleaned:0,cleanupFailed:0})}});
  const bodies:{to:string[];bcc?:string[];text:string}[]=[];globalThis.fetch=async(_url,init)=>{bodies.push(JSON.parse(String(init?.body)));return new Response(null,{status:bodies.length===1?200:503});};
  assert.equal((await h.GET(new NextRequest('https://camp.example/api/jobs'))).status,401);
  const response=await h.GET(new NextRequest('https://camp.example/api/jobs',{headers:{authorization:'Bearer fictional-test'}}));assert.equal((await response.json()).sent,1);
  assert.ok(bodies.every(b=>!b.bcc));assert.match(bodies[0].text,/\/admin\?booking=booking-a/);assert.match(bodies[1].text,/\/account/);assert.deepEqual(updates.map(u=>u.status),['sent','failed']);
 }finally{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});

test('availability is one service RPC and actor-aware quoting ignores forged identity fields',async()=>{
 const calls:{name:string;args:Record<string,unknown>}[]=[];const limits:string[]=[];let adminChecked=false;
 const actor='10000000-0000-4000-8000-000000000001',offering='20000000-0000-4000-8000-000000000001';
 const h=await handlers('api/[...path]/route.ts',{'@/lib/supabase':{service:()=>({rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return{data:name==='public_availability'?[{id:offering,available:true}]:{available:true},error:null};}}),requireUser:async(admin:boolean)=>{adminChecked=admin;return{user:{id:actor}};}},'@/lib/validation':validation,'@/lib/admin-dates':dates,'@/lib/booking-draft':draft,'@/lib/proof-cleanup':{},'@/lib/rate-limit':{anonymousLimit:async(_req:unknown,group:string)=>limits.push(group),userLimit:async()=>{}}});
 const selection={arrival:'2027-05-01',departure:'2027-05-03',arrival_time:'09:00',guests:2};
 async function post(path:string,body:unknown){return h.POST(new NextRequest('https://camp.example/api/'+path,{method:'POST',headers:{origin:'https://camp.example',host:'camp.example','content-type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({path:path.split('/')})});}
 let response=await post('availability',selection);assert.equal(response.status,200);assert.equal(calls.length,1);assert.equal(calls[0].name,'public_availability');assert.deepEqual(await response.json(),[{id:offering,available:true}]);
 response=await post('quote',{...selection,offering,units:1,manual_email:'fictional@example.test',p_actor:'forged',actor:'forged'});assert.equal(response.status,200);assert.equal(adminChecked,true);assert.equal(calls[1].name,'quote_for_actor');assert.equal(calls[1].args.p_actor,actor);assert.deepEqual(limits,['quotes','quotes']);
});

test('protected reads fail closed on limiter failure and return retry headers before accessing records',async()=>{
 let read=false;
 const h=await handlers('api/[...path]/route.ts',{'@/lib/supabase':{requireUser:async()=>({user:{id:'fictional'},client:{from:()=>{read=true;throw Error('Must not read');}}})},'@/lib/validation':validation,'@/lib/admin-dates':dates,'@/lib/booking-draft':draft,'@/lib/proof-cleanup':{},'@/lib/rate-limit':{userLimit:async()=>{throw new httpSecurity.HttpError(429,'RATE_LIMITED','Try again later.',12);}}});
 const response=await h.GET(new NextRequest('https://camp.example/api/bookings'),{params:Promise.resolve({path:['bookings']})});assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'12');assert.equal(read,false);
});
