import type {SupabaseClient} from '@supabase/supabase-js';

// Storage deletion cannot share the booking transaction. Lease and retry its durable jobs.
export async function cleanDeletedReceipts(s:SupabaseClient){
 let cleaned=0;let cleanupFailed=0;
 const cleanup=await s.rpc('claim_receipt_cleanup_jobs');
 if(cleanup.error)throw new Error('Receipt cleanup queue unavailable');
 for(const job of cleanup.data||[]){try{
  // Removing the first batch repeatedly avoids skipping objects as the list shrinks.
  let remaining=false;
  for(let batch=0;batch<10;batch++){
   const listed=await s.storage.from('receipts').list(job.prefix,{limit:100,offset:0});
   if(listed.error)throw new Error('Could not list receipt files');
   const files=(listed.data||[]).filter(file=>file.id).map(file=>job.prefix+'/'+file.name);
   if(!files.length){remaining=false;break;}
   const removed=await s.storage.from('receipts').remove(files);if(removed.error)throw new Error('Could not remove receipt files');
   remaining=true;
  }
  // Keep scanning until every previously issued upload URL has expired.
  const result=!remaining&&new Date(job.finish_after).getTime()<=Date.now()
   ?await s.from('receipt_cleanup_jobs').delete().eq('id',job.id)
   :await s.from('receipt_cleanup_jobs').update({locked_at:null,last_error:null,available_at:new Date(Date.now()+60000).toISOString()}).eq('id',job.id);
  if(result.error)throw new Error('Could not record receipt cleanup');cleaned++;
 }catch{cleanupFailed++;await s.from('receipt_cleanup_jobs').update({locked_at:null,last_error:'Receipt cleanup failed; retry scheduled',available_at:new Date(Date.now()+Math.min(3600000,30000*2**Math.min(job.attempts,7))).toISOString()}).eq('id',job.id);}}

 return {cleaned,cleanupFailed};
}
