import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {cleanDeletedReceipts} from '@/lib/receipt-cleanup';
import {deliverEmails} from '@/lib/email-worker';
import {service} from '@/lib/supabase';
export const maxDuration=60;
export async function GET(req:NextRequest){
 const expected=Buffer.from('Bearer '+(process.env.CRON_SECRET||'')),provided=Buffer.from(req.headers.get('authorization')||'');
 if(!process.env.CRON_SECRET||expected.length!==provided.length||!timingSafeEqual(expected,provided))return NextResponse.json({error:'Unauthorized'},{status:401});
 const started=Date.now(),deadline=started+40000;
 try{
  const s=service(3000);const maintenance=await s.rpc('clean_abuse_history');if(maintenance.error)throw new Error('Maintenance unavailable');
  const cleanup=await cleanDeletedReceipts(s,started+10000);
  if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return NextResponse.json({...cleanup,email:'Email service is not configured'});
  const result={processed:0,sent:0,deferred:0};
  // Claim small batches just in time: preserve throughput without leasing a large
  // backlog that a slow provider would force this invocation to release.
  for(let batch=0;batch<4&&Date.now()+16000<deadline;batch++){
   const {data:jobs,error}=await s.rpc('claim_email_jobs');if(error)throw new Error('Queue unavailable');if(!jobs?.length)break;
   const delivered=await deliverEmails(s,jobs,deadline,{key:process.env.RESEND_API_KEY,from:process.env.EMAIL_FROM,origin:process.env.APP_URL||''});
   result.processed+=delivered.processed;result.sent+=delivered.sent;result.deferred+=delivered.deferred;
   if(delivered.deferred)break;
  }
  const health=await s.rpc('worker_health');
  console.info('Worker completed',{...result,...cleanup,health:health.error?null:health.data,elapsedMs:Date.now()-started});
  return NextResponse.json({...result,...cleanup,health:health.error?null:health.data});
 }catch{return NextResponse.json({error:'Worker unavailable; durable jobs will retry'},{status:503});}
}
