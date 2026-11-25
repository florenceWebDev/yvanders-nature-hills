import{NextRequest,NextResponse}from'next/server';
import{timingSafeEqual}from'node:crypto';
import{service}from'@/lib/supabase';
export const maxDuration=300;
export async function GET(req:NextRequest){
 const expected=`Bearer ${process.env.CRON_SECRET||''}`,provided=req.headers.get('authorization')||'';
 if(!process.env.CRON_SECRET||expected.length!==provided.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return NextResponse.json({error:'Email service is not configured'},{status:503});
 const s=service();const{data:jobs,error}=await s.rpc('claim_email_jobs');if(error)return NextResponse.json({error:'Queue unavailable'},{status:503});let sent=0;
 for(const job of jobs||[]){try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[job.recipient],subject:job.subject,text:job.body+`\n\nView your booking: ${process.env.APP_URL}/account`,...(process.env.ADMIN_EMAIL?{bcc:[process.env.ADMIN_EMAIL]}:{})}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`Email provider returned ${response.status}`);
  const{error:updateError}=await s.from('email_jobs').update({status:'sent',last_error:null}).eq('id',job.id);if(updateError)throw new Error('Could not record email delivery');sent++;
 }catch(e){await s.from('email_jobs').update({status:'failed',last_error:e instanceof Error?e.message:'Delivery failed',available_at:new Date(Date.now()+Math.min(3600000,30000*2**job.attempts)).toISOString()}).eq('id',job.id);}}
 return NextResponse.json({processed:jobs?.length||0,sent});
}
