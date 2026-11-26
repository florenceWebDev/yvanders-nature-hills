import type {SupabaseClient} from '@supabase/supabase-js';

// Only discard invalid image bytes; financial finalization errors preserve their objects.
export async function discardUnregisteredProof(client:SupabaseClient,path:string){
 const existing=await client.from('receipts').select('id').eq('object_path',path).maybeSingle();
 if(existing.error||existing.data)return false;
 const removed=await client.storage.from('receipts').remove([path]);
 return !removed.error;
}
