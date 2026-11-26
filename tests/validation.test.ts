import {paymentOptions} from '../src/lib/payments';
import{test}from'node:test';
import assert from'node:assert/strict';
import{searchSchema,holdSchema,reviewSchema,offeringSchema,settingsSchema,imageSignature}from'../src/lib/validation';
const id='a3e06473-5aa1-4278-9e63-fc6df11f946a';
test('booking inputs reject forged amounts and enforce valid counts',()=>{const parsed=holdSchema.parse({offering:id,arrival:'2027-02-01',arrival_time:'14:30',departure:'2027-02-03',guests:2,units:1,name:'Test Guest',phone:'09123456789',request:id,total:1,status:'confirmed'});assert.equal('total'in parsed,false);assert.equal('status'in parsed,false);assert.equal(searchSchema.safeParse({...parsed,guests:-1}).success,false);assert.equal(searchSchema.safeParse({...parsed,units:0}).success,false);});
test('admin decisions restrict actions and money to integer centavos',()=>{assert.equal(reviewSchema.safeParse({booking:id,action:'grant_admin'}).success,false);assert.equal(reviewSchema.safeParse({booking:id,action:'confirm',paid:1.5}).success,false);assert.equal(reviewSchema.safeParse({booking:id,action:'confirm',paid:-1}).success,false);});
test('publishing configuration rejects missing schedules and unsafe images',()=>{const offering={slug:'test-stay',name:'Test stay',kind:'room',description:'',images:['/images/cabana.jpg'],amenities:[],published:false,allocation_basis:'unit',max_guests:2,capacity:1,price:300000,price_basis:'night',deposit_percent:50,schedule:'overnight',check_in:'14:00',check_out:'12:00',slots:[]};assert.equal(offeringSchema.safeParse(offering).success,true);for(const change of[{images:['javascript:alert(1)']},{images:['/images/../secret']},{deposit_percent:101},{price:0},{capacity:0},{schedule:'slots',slots:[]}])assert.equal(offeringSchema.safeParse({...offering,...change}).success,false);});
test('payment settings allow zero to three complete, unique options',()=>{
 const s={tagline:'Nature',intro:'',contact:'',email:'',address:'',payment_options:[],payment_ready:false,cancellation_policy:''};
 const option={id,label:'GCash',qr_url:'https://example.com/qr.png',recipient:'Campsite',instructions:'Use the booking reference.'};
 assert.equal(settingsSchema.safeParse(s).success,true);
 assert.equal(settingsSchema.safeParse({...s,payment_ready:true}).success,false);
 for(let count=1;count<=3;count++)assert.equal(settingsSchema.safeParse({...s,payment_ready:true,payment_options:Array.from({length:count},()=>({...option,id:crypto.randomUUID()}))}).success,true);
 for(const options of [[option,option],Array.from({length:4},()=>({...option,id:crypto.randomUUID()})),[{...option,label:' '}],[{...option,recipient:''}],[{...option,qr_url:'javascript:alert(1)'}]])assert.equal(settingsSchema.safeParse({...s,payment_options:options}).success,false);
});

test('receipt file checks use signatures instead of submitted MIME type',()=>{assert.deepEqual(imageSignature(new Uint8Array([255,216,255,224])),{mime:'image/jpeg',ext:'jpg'});assert.deepEqual(imageSignature(new Uint8Array([137,80,78,71,13,10,26,10])),{mime:'image/png',ext:'png'});assert.equal(imageSignature(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),null);assert.equal(imageSignature(new Uint8Array()),null);});

test('legacy payment snapshots render without overriding an explicit empty configuration',()=>{
 const legacy={qr_url:'https://example.test/qr.png',payment_recipient:'Original camp',payment_instructions:'Original instructions'};
 assert.equal(paymentOptions(legacy)[0].recipient,'Original camp');
 assert.deepEqual(paymentOptions({...legacy,payment_options:[]}),[]);
 assert.deepEqual(paymentOptions({}),[]);
});


test('appearance input accepts legacy settings and rejects CSS and image injection',()=>{
 const settings={tagline:'Nature',intro:'',contact:'',email:'',address:'',payment_options:[],payment_ready:false,cancellation_policy:''};
 assert.equal(settingsSchema.safeParse(settings).success,true);
 assert.equal(settingsSchema.safeParse({...settings,palette:{forest:'#123456'},logo:{src:'/images/cabana.jpg',alt:'Camp'},gallery:[]}).success,true);
 for(const patch of [{palette:{forest:'red;display:none'}},{palette:{invalid:'#123456'}},{images:{hero:{src:'javascript:alert(1)',alt:'Camp'}}},{gallery:[{src:'/images/hills.jpg',alt:''}]}])assert.equal(settingsSchema.safeParse({...settings,...patch}).success,false);
});

import {paymentSummary} from '../src/lib/payments';
import {recordPaymentSchema,paymentSettingsSchema,websiteSettingsSchema} from '../src/lib/validation';
test('net payment summary reopens refunds and keeps complimentary status explicit',()=>{
 assert.equal(paymentSummary({total:10000,paid:5000}).balance,5000);
 assert.equal(paymentSummary({total:10000,paid:10000}).label,'Fully paid');
 assert.equal(paymentSummary({total:10000,paid:10000,refunded:2000}).balance,2000);
 assert.equal(paymentSummary({total:0,paid:0}).label,'No payment required');
});
test('online payments require proof and settings sections reject unrelated fields',()=>{
 const value={booking:crypto.randomUUID(),amount:100,method:'cash',day:'2026-11-26',reference:'',request:crypto.randomUUID()};
 assert.ok(recordPaymentSchema.safeParse(value).success);
 assert.equal(recordPaymentSchema.safeParse({...value,method:'gcash',reference:'PAY-123'}).success,false);
 assert.ok(recordPaymentSchema.safeParse({...value,method:'gcash',reference:'PAY-123',receipt:crypto.randomUUID()}).success);
 assert.equal(paymentSettingsSchema.safeParse({payment_options:[],payment_ready:false,tagline:'Wrong section'}).success,false);
 assert.equal(websiteSettingsSchema.safeParse({payment_ready:false}).success,false);
});
