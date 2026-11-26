// Run against the local preview: node scripts/smoke.mjs
import assert from 'node:assert/strict';
const origin=process.env.SMOKE_URL||'http://127.0.0.1:3000';
for(const path of ['/','/stays','/stays/yro-cabana','/camping','/gatherings','/about','/gallery','/faq','/contact','/privacy','/account','/admin']){
 const r=await fetch(origin+path);assert.equal(r.status,200,path);const html=await r.text();assert.ok(html.includes('Yvander'),path);const title=html.match(/<title>(.*?)<\/title>/)?.[1]||'';assert.ok(title,path+' has a title');assert.ok((title.match(/Nature Hills/g)||[]).length<=1,path+' avoids duplicate brand suffix');console.log(`PASS ${path}`);
}
let r=await fetch(origin+'/api/session');const session=await r.json();assert.equal(r.status,200);console.log('PASS session endpoint');
r=await fetch(origin+'/api/jobs');assert.equal(r.status,401);console.log('PASS cron rejects missing credentials');
r=await fetch(origin+'/api/hold',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.example'},body:'{}'});assert.equal(r.status,400);assert.match((await r.json()).error,/origin/);console.log('PASS cross-origin mutation denied');
if(!session.configured){for(const route of ['bookings','admin','admin/admins','admin/promos','admin/dashboard','admin/bookings','admin/booking']){r=await fetch(origin+'/api/'+route);assert.equal(r.status,503);assert.match((await r.json()).error,/not configured/);console.log(`PASS ${route} fails closed without services`);}
 for(const route of ['admin/admins/add','admin/admins/remove','admin/promo','admin/refund','bookings/delete','admin/bookings/delete']){r=await fetch(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:'{}'});assert.equal(r.status,503);assert.match((await r.json()).error,/not configured/);console.log(`PASS ${route} cannot mutate without services`);}}
r=await fetch(origin+'/not-a-real-page');assert.equal(r.status,404);console.log('PASS missing page is 404');
