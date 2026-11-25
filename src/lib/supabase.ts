import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
export const configured=()=>!!(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export async function db(){
 if(!configured())throw new Error('Booking services are not configured yet. Please contact the campsite.');
 const jar=await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>jar.getAll(),setAll(items){try{items.forEach(({name,value,options})=>jar.set(name,value,{...options,httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'}));}catch{/* Server components cannot refresh cookies; API routes can. */}}}});
}
export function service(){if(!configured()||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Secure storage service is not configured.');return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function requireUser(admin=false){const client=await db();const {data:{user},error}=await client.auth.getUser();if(error||!user)throw new Error('Sign in to continue.');if(!user.email_confirmed_at)throw new Error('Verify your email to continue.');if(admin){const{data}=await client.rpc('is_admin');if(!data)throw new Error('Admin access required.');}return{client,user};}
