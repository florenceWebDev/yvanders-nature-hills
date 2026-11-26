import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {HttpError,clientIdentity,rateKey,limit,readJson,publicFailure} from '../src/lib/http-security';
import {retryDelay,deliverEmails} from '../src/lib/email-worker';
import type {SupabaseClient} from '@supabase/supabase-js';
import {proxy} from '../src/proxy';
import {readSession} from '../src/lib/session-state';

test('JSON limits count streamed bytes even with a forged content length',async()=>{
 assert.deepEqual(await readJson(new Request('https://fictional.test',{method:'POST',body:'{"ok":true}'})),{ok:true});
 for(const headers of [{} as Record<string,string>,{'content-length':'1'},{'content-length':'300000'}])await assert.rejects(readJson(new Request('https://fictional.test',{method:'POST',headers,body:'x'.repeat(262145)})),(e:unknown)=>e instanceof HttpError&&e.status===413);
 await assert.rejects(readJson(new Request('https://fictional.test',{method:'POST',body:'broken'})),(e:unknown)=>e instanceof HttpError&&e.code==='INVALID_JSON');
});
test('session throttling and service failures remain errors instead of becoming setup or signed-out state',async()=>{
 const original=globalThis.fetch;
 try{
  for(const status of [429,503]){globalThis.fetch=async()=>new Response(JSON.stringify({error:'Please try again later.',code:'RATE_LIMITED'}),{status});await assert.rejects(readSession(),/try again later/);}
  const state={configured:true,user:{id:'fictional',email:'fictional@example.test'},admin:false};globalThis.fetch=async()=>new Response(JSON.stringify(state));assert.deepEqual(await readSession(),state);
 }finally{globalThis.fetch=original;}
});
test('IP identity ignores forwarded headers, requires trusted hosting, and normalizes IPv6',()=>{
 const saved=process.env.SITE_ID;
 try{
  delete process.env.SITE_ID;
  assert.throws(()=>clientIdentity(new NextRequest('https://fictional.test',{headers:{'x-forwarded-for':'192.0.2.1','x-nf-client-connection-ip':'192.0.2.2'}})),/shortly/);
  process.env.SITE_ID='10000000-0000-4000-8000-000000000001';
  const request=(ip:string)=>new NextRequest('https://fictional.test',{headers:{'x-nf-client-connection-ip':ip,'x-forwarded-for':'192.0.2.99'}});
  assert.equal(clientIdentity(request('192.0.2.1')),'192.0.2.1');
  assert.equal(clientIdentity(request('2001:0db8:0:0::1')),clientIdentity(request('2001:db8::1')));
  assert.throws(()=>clientIdentity(request('192.0.2.1, 192.0.2.2')),/shortly/);
 }finally{if(saved===undefined)delete process.env.SITE_ID;else process.env.SITE_ID=saved;}
});
test('rate keys conceal identity, shared counters return Retry-After, and outages fail closed',async()=>{
 const saved=process.env.RATE_LIMIT_HMAC_SECRET;process.env.RATE_LIMIT_HMAC_SECRET='fictional-test-secret-32-characters-long';
 try{
  assert.ok(!rateKey('login','fictional@example.test').includes('example'));
  assert.notEqual(rateKey('login','user'),rateKey('upload','user'));
  await limit({rpc:async()=>({data:0,error:null})},'test','user',1,60);
  let error:unknown;try{await limit({rpc:async()=>({data:42,error:null})},'test','user',1,60);}catch(e){error=e;}
  const response=publicFailure(error);assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'42');
  await assert.rejects(limit({rpc:async()=>({data:null,error:{message:'private provider detail'}})},'test','user',1,60),(e:unknown)=>e instanceof HttpError&&e.status===503&&!e.message.includes('private'));
  delete process.env.RATE_LIMIT_HMAC_SECRET;await assert.rejects(limit({rpc:async()=>{throw Error('must not call');}},'test','user',1,60),(e:unknown)=>e instanceof HttpError&&e.status===503);
 }finally{if(saved===undefined)delete process.env.RATE_LIMIT_HMAC_SECRET;else process.env.RATE_LIMIT_HMAC_SECRET=saved;}
});
test('unexpected provider messages stay private while explicit business errors remain actionable',async()=>{
 const response=publicFailure(new Error('The provider leaked a fictional credential'));assert.equal(response.status,500);assert.doesNotMatch(await response.text(),/fictional credential/);
 assert.equal(publicFailure(new HttpError(403,'ADMIN_REQUIRED','Admin access required.')).status,403);
 assert.equal(publicFailure(new Error('Invalid request origin')).status,400);
});
test('production CSP uses distinct nonces, keeps dynamic HTML private and excludes unsafe eval',()=>{
 const saved=process.env.NODE_ENV;Object.assign(process.env,{NODE_ENV:'production'});
 try{
  const a=proxy(new NextRequest('https://fictional.test/')),b=proxy(new NextRequest('https://fictional.test/'));
  const policy=a.headers.get('content-security-policy')!;assert.match(policy,/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);assert.doesNotMatch(policy,/unsafe-eval/);assert.notEqual(policy,b.headers.get('content-security-policy'));assert.equal(a.headers.get('cache-control'),'private, no-store');assert.match(policy,/frame-ancestors 'none'/);
 }finally{if(saved===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Object.assign(process.env,{NODE_ENV:saved});}
});
test('provider retry dates and quota cooldowns release unsent leases without consuming attempts',async()=>{
 const now=Date.now();assert.ok(retryDelay(new Response(null,{headers:{'retry-after':'120'}}),1,now)>=120000);
 assert.ok(retryDelay(new Response(null,{headers:{'retry-after':new Date(now+300000).toUTCString()}}),1,now)>290000);
 const original=globalThis.fetch;const updates:{id:string;value:Record<string,unknown>;token?:string}[]=[];const pauses:number[]=[];
 const client={rpc:async(name:string,args:{p_seconds?:number})=>{if(name==='pause_email_delivery')pauses.push(args.p_seconds!);return{data:0,error:null};},from:()=>({update:(value:Record<string,unknown>)=>{let id='',token='';const q={eq:(key:string,val:string)=>{if(key==='id')id=val;if(key==='lease_token')token=val;return q;},select:async()=>{updates.push({id,value,token});return{data:[{id}],error:null};}};return q;}})} as unknown as SupabaseClient;
 const jobs=['a','b'].map(id=>({id,lease_token:'lease-'+id,booking_id:'booking',audience:'guest',recipient:'fictional@example.test',subject:'Test',body:'Test',attempts:1}));
 try{
  let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({name:'daily_quota_exceeded'}),{status:429,headers:{'retry-after':'120'}});};
  const result=await deliverEmails(client,jobs,Date.now()+40000,{key:'fictional',from:'fictional@example.test',origin:'https://fictional.test'});
  assert.equal(calls,1);assert.equal(result.deferred,1);assert.ok(pauses[0]>=120);assert.equal(updates[0].value.status,'failed');assert.equal(updates[1].value.status,'queued');assert.equal(updates[1].value.attempts,0);assert.equal(updates[0].token,'lease-a');
  updates.length=0;calls=0;await deliverEmails(client,jobs,Date.now(),{key:'fictional',from:'fictional@example.test',origin:'https://fictional.test'});assert.equal(calls,0);assert.equal(updates.length,2);
 }finally{globalThis.fetch=original;}
});
