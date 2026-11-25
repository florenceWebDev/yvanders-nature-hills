// Run after migration: npx tsx --env-file=.env.local scripts/seed.ts
// Creates unpublished draft offerings only. It does not grant an admin role.
import{createClient}from'@supabase/supabase-js';
import{sampleOfferings}from'../src/lib/catalog';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Configure Supabase URL and service-role key in .env.local');
const db=createClient(url,key,{auth:{persistSession:false}});
for(const o of sampleOfferings){const{data:existing,error:readError}=await db.from('offerings').select('id').eq('slug',o.slug).maybeSingle();if(readError)throw readError;if(existing)continue;const{data:r,error:resourceError}=await db.from('resources').insert({name:o.name,capacity:1}).select().single();if(resourceError)throw resourceError;const{id,resource_id,...draft}=o;const{error}=await db.from('offerings').insert({...draft,resource_id:r.id,price:o.price||null,published:false});if(error)throw error;console.log(`Created unpublished draft: ${o.name}`);}
console.log('Review all drafts before publication. Camping/day-use rates are unset and MUST be configured.');
