import 'server-only';
import {cache} from 'react';
import {unstable_cache} from 'next/cache';
import {createClient} from '@supabase/supabase-js';
import {configured} from './supabase';
import {defaults,sampleOfferings} from './catalog';
import {siteImage} from './appearance';
import {paymentOptions} from './payments';
import type{Offering,Settings}from './types';
const publicCatalog=unstable_cache(async function publicCatalog(url:string,key:string){
 const c=createClient(url,key,{auth:{persistSession:false}});
 const [a,b]=await Promise.all([c.from('offerings').select('*').eq('published',true).order('name'),c.from('site_content').select('value').eq('key','settings').single()]);
 if(a.error||b.error)throw new Error('Public catalog unavailable');
 const settings={...defaults,...b.data?.value,payment_options:paymentOptions(b.data?.value||{})}as Settings;
 return{offerings:(a.data||[]).map(o=>({...o,images:o.images?.length?o.images:[siteImage(settings,'fallback').src]}))as Offering[],settings,preview:false};
},['catalog-v2'],{tags:['public-catalog'],revalidate:30});
export const catalog=cache(async function catalog():Promise<{offerings:Offering[];settings:Settings;preview:boolean;error?:string}>{
 if(!configured())return{offerings:sampleOfferings,settings:defaults,preview:true};
 try{return await publicCatalog(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);}
 catch{return{offerings:[],settings:defaults,preview:false,error:'Availability is temporarily unavailable. Please try again later.'};}
});
