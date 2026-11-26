import{NextRequest,NextResponse}from'next/server';
import{timingSafeEqual}from'node:crypto';
import {cleanDeletedReceipts} from '@/lib/receipt-cleanup';
import{service}from'@/lib/supabase';
export const maxDuration=300;
export async function GET(req:NextRequest){
 const expected=`Bearer ${process.env.CRON_SECRET||''}`,provided=req.headers.get('authorization')||'';
 if(!process.env.CRON_SECRET||expected.length!==provided.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return NextResponse.json({error:'Unauthorized'},{status:401});
 const s=service();let cleaned=0,cleanupFailed=0;try{({cleaned,cleanupFailed}=await cleanDeletedReceipts(s));}catch{return NextResponse.json({error:'Receipt cleanup queue unavailable'},{status:503});}
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return NextResponse.json({cleaned,cleanupFailed,email:'Email service is not configured'});
 const{data:jobs,error}=await s.rpc('claim_email_jobs');if(error)return NextResponse.json({error:'Queue unavailable'},{status:503});let sent=0;
 for(const job of jobs||[]){try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[job.recipient],subject:job.subject,text:job.body+`\n\n${job.audience==='admin'?'Review reservation':'View your booking'}: ${process.env.APP_URL}${job.audience==='admin'?`/admin?booking=${job.booking_id}`:'/account'}`}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`Email provider returned ${response.status}`);
  const{error:updateError}=await s.from('email_jobs').update({status:'sent',last_error:null}).eq('id',job.id);if(updateError)throw new Error('Could not record email delivery');sent++;
 }catch(e){await s.from('email_jobs').update({status:'failed',last_error:e instanceof Error?e.message:'Delivery failed',available_at:new Date(Date.now()+Math.min(3600000,30000*2**job.attempts)).toISOString()}).eq('id',job.id);}}
 return NextResponse.json({processed:jobs?.length||0,sent,cleaned,cleanupFailed});
}
