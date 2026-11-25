// One-off owner-authorized cleanup. Run without --apply for a read-only preflight.
// Uses the existing service environment; never prints credentials, guest fields or storage paths.
import {createClient} from '@supabase/supabase-js';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
const fixture='7f2b063d-e6b1-4c1d-8838-170c80206418';
const slug='system-check-do-not-pay';
const resource='6e05e963-eda7-4160-8c01-6b9b94a14d3c';
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const must=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
const image=client.storage.from('marketing').getPublicUrl('system-check/do-not-pay.png').data.publicUrl;
const manifestPath='.env-check/system-check-cleanup.json';
const offering=must(await client.from('offerings').select('id,slug,name,resource_id').eq('id',fixture).maybeSingle());
const bookings=must(await client.from('bookings').select('id,offering_name,snapshot').eq('offering_id',fixture));
if(offering&&(offering.slug!==slug||offering.name!=='System check — do not pay'||offering.resource_id!==resource))throw new Error('Fixture identity changed; cleanup stopped');
if(bookings.some(b=>b.offering_name!=='System check — do not pay'||b.snapshot?.payment?.qr_url!==image))throw new Error('A booking cannot be confirmed as fictional; cleanup stopped');
if(must(await client.from('blackouts').select('id').eq('resource_id',resource)).length)throw new Error('Unexpected resource dependency; cleanup stopped');
let manifest=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath,'utf8')):{fixture,bookings:[],receipts:[]};
if(manifest.fixture!==fixture)throw new Error('Cleanup manifest belongs to a different fixture');
manifest.bookings=[...new Set([...manifest.bookings,...bookings.map(b=>b.id)])];
// A resume must never widen the original fixture scope.
if(manifest.bookings.length){
 const remaining=must(await client.from('bookings').select('id,offering_id').in('id',manifest.bookings));
 if(remaining.some(b=>b.offering_id!==fixture))throw new Error('Manifest booking scope changed');
 const receipts=must(await client.from('receipts').select('object_path').in('booking_id',manifest.bookings));
 manifest.receipts=[...new Set([...manifest.receipts,...receipts.map(r=>r.object_path)])];
 if(manifest.receipts.some(path=>!manifest.bookings.some(id=>path.split('/')[1]===id)))throw new Error('Receipt path is outside the test bookings');
}
console.log({mode:process.argv.includes('--apply')?'apply':'preflight',fixturePresent:!!offering,testBookings:bookings.length,testReceiptFiles:manifest.receipts.length});
if(!process.argv.includes('--apply'))process.exit(0);
mkdirSync('.env-check',{recursive:true});writeFileSync(manifestPath,JSON.stringify(manifest));
// Stop new public holds first. Each later operation is scoped and safe to retry.
if(offering)must(await client.from('offerings').update({published:false}).eq('id',fixture).eq('slug',slug));
const settings=must(await client.from('site_content').select('value').eq('key','settings').single()).value;
const testText=value=>typeof value==='string'&&/system.check|do not pay|do not send money/i.test(value);
const next={...settings};
if(testText(next.tagline))next.tagline='A little closer to nature.';
if(testText(next.intro))next.intro='Open skies, green hills, and time to slow down. Discover a stay at Yvander’s Nature Hills.';
if(testText(next.cancellation_policy))next.cancellation_policy='Contact the campsite to request changes or cancellation. Refunds are reviewed and processed manually.';
if(Array.isArray(next.faq))next.faq=next.faq.filter(f=>!testText(f.question)&&!testText(f.answer));
if(next.qr_url===image){next.qr_url='';next.payment_recipient='';next.payment_instructions='';next.payment_ready=false;}
if(Array.isArray(next.payment_options)){next.payment_options=next.payment_options.filter(p=>p.qr_url!==image);if(!next.payment_options.length)next.payment_ready=false;}
const updated=must(await client.from('site_content').update({value:next}).eq('key','settings').eq('value',JSON.stringify(settings)).select('key'));
if(updated.length!==1)throw new Error('Settings changed concurrently; retry cleanup');
// Storage goes first so interrupted runs retain metadata and the private retry manifest.
if(manifest.receipts.length)must(await client.storage.from('receipts').remove(manifest.receipts));
must(await client.storage.from('marketing').remove(['system-check/do-not-pay.png']));
if(manifest.bookings.length){
 for(const table of ['email_jobs','promo_redemptions','payment_entries','receipts'])must(await client.from(table).delete().in('booking_id',manifest.bookings));
 must(await client.from('audit_events').delete().in('record_id',[fixture,...manifest.bookings]));
 must(await client.from('bookings').delete().eq('offering_id',fixture).in('id',manifest.bookings));
}
if(offering)must(await client.from('offerings').delete().eq('id',fixture).eq('slug',slug));
const shared=must(await client.from('offerings').select('id').eq('resource_id',resource));
if(!shared.length)must(await client.from('resources').delete().eq('id',resource).eq('name','SYSTEM CHECK — virtual capacity only'));
if(must(await client.from('offerings').select('id').eq('id',fixture)).length||must(await client.from('bookings').select('id').eq('offering_id',fixture)).length)throw new Error('Cleanup verification failed');
console.log({removed:true,fixtureBookingsRemaining:0,sharedResourcesPreserved:true,paymentSettingsRequireRealConfiguration:true});
