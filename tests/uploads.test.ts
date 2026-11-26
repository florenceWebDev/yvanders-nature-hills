import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadOriginal} from '../src/lib/uploads';
test('guest selection and staff proof kind survive both signed upload phases',async()=>{
 const original=globalThis.fetch;
 try{
  for(const admin of [false,true]){
   const calls:{url:string;body:Record<string,unknown>|null}[]=[];
   globalThis.fetch=async(input,init)=>{const url=String(input);const body=typeof init?.body==='string'?JSON.parse(init.body):null;calls.push({url,body});return new Response(JSON.stringify(url.endsWith('/prepare')?{url:'https://example.test/upload',id:'proof-id',ext:'png'}:{id:'proof-id'}),{status:200,headers:{'Content-Type':'application/json'}});};
   await uploadOriginal(new File([new Uint8Array([137,80,78,71])],'proof.png',{type:'image/png'}),'booking-id','PAY-123','chosen-option',admin);
   assert.equal(calls.length,3);assert.equal(calls[0].body?.kind,admin?'payment-proof':'receipt');assert.equal(calls[2].body?.kind,admin?'payment-proof':'receipt');assert.equal(calls[2].body?.option,'chosen-option');assert.equal(calls[2].body?.booking,'booking-id');
  }
 }finally{globalThis.fetch=original;}
});
test('failed signed transfer never finalizes proof',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({url:'https://example.test/upload'}),{status:calls===1?200:503});};await assert.rejects(uploadOriginal(new File(['proof'],'proof.png',{type:'image/png'}),'booking'),/could not finish/);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
