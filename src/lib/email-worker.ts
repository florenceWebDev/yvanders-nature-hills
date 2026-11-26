import type {SupabaseClient} from '@supabase/supabase-js';

export function retryDelay(response:Response,attempts:number,now=Date.now()){
 const retry=response.headers.get('retry-after');
 const seconds=retry===null?NaN:Number(retry);
 const header=Number.isFinite(seconds)?seconds*1000:retry?Date.parse(retry)-now:0;
 const reset=Number(response.headers.get('ratelimit-reset')||0)*1000;
 return Math.max(1000,Number.isFinite(header)?header:0,Number.isFinite(reset)?reset:0,Math.min(3600000,30000*2**Math.min(attempts,7)));
}
type Job={id:string;lease_token:string;booking_id:string;audience:string;recipient:string;subject:string;body:string;attempts:number};
export async function deliverEmails(s:SupabaseClient,jobs:Job[],deadline:number,config:{key:string;from:string;origin:string}){
 let sent=0,processed=0,deferred=0;let waitUntil=Date.now();
 const update=(job:Job,value:Record<string,unknown>)=>s.from('email_jobs').update(value).eq('id',job.id).eq('lease_token',job.lease_token).eq('status','sending').select('id');
 for(const job of jobs){
  if(Date.now()+16000>=deadline||Date.now()<waitUntil){
   const result=await update(job,{status:'queued',locked_at:null,lease_token:null,attempts:job.attempts-1,available_at:new Date(Math.max(Date.now()+1000,waitUntil)).toISOString()});
   if(result.error)throw new Error('Could not release email lease');deferred++;continue;
  }
  try{
   let acquired=false;
   while(Date.now()+16000<deadline){
    const pace=await s.rpc('consume_rate_limit',{p_key:'email-provider',p_limit:1,p_seconds:1});
    if(pace.error||typeof pace.data!=='number')throw new Error('Email pacing unavailable');
    if(pace.data===0){acquired=true;break;}
    await new Promise(resolve=>setTimeout(resolve,Math.min(1000,pace.data*1000)));
   }
   if(!acquired){const released=await update(job,{status:'queued',lease_token:null,locked_at:null,attempts:job.attempts-1});if(released.error)throw new Error('Could not release email lease');deferred++;continue;}
   processed++;
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({from:config.from,to:[job.recipient],subject:job.subject,text:job.body+`\n\n${job.audience==='admin'?'Review reservation':'View your booking'}: ${config.origin}${job.audience==='admin'?`/admin?booking=${job.booking_id}`:'/account'}`}),signal:AbortSignal.timeout(12000)});
   if(!response.ok){
    let delay=retryDelay(response,job.attempts);
    if(response.status===429){
     const body=await response.json().catch(()=>({}));const now=new Date();
     if(body.name==='daily_quota_exceeded')delay=Math.max(delay,Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1)-Date.now());
     if(body.name==='monthly_quota_exceeded')delay=Math.max(delay,Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)-Date.now());
     waitUntil=Date.now()+delay;
     const paused=await s.rpc('pause_email_delivery',{p_seconds:Math.ceil(delay/1000)});if(paused.error)throw new Error('Could not record provider cooldown');
    }
    const result=await update(job,{status:'failed',lease_token:null,locked_at:null,last_error:`Email provider returned ${response.status}`,available_at:new Date(Date.now()+delay).toISOString()});
    if(result.error)throw new Error('Could not record email retry');continue;
   }
   const result=await update(job,{status:'sent',last_error:null,lease_token:null,locked_at:null});
   if(result.error)throw new Error('Could not record email delivery');if(result.data?.length)sent++;
  }catch{
   const result=await update(job,{status:'failed',lease_token:null,locked_at:null,last_error:'Delivery failed; retry scheduled',available_at:new Date(Date.now()+Math.min(3600000,30000*2**Math.min(job.attempts,7))).toISOString()});
   if(result.error)throw new Error('Could not record email retry');
  }
 }
 return {processed,sent,deferred};
}
