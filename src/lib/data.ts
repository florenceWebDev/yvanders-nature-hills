import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {configured} from './supabase';
import {defaults,sampleOfferings} from './catalog';
import {siteImage} from './appearance';
import {paymentOptions} from './payments';
import type{Offering,Settings}from './types';
export async function catalog():Promise<{offerings:Offering[];settings:Settings;preview:boolean;error?:string}>{
 if(!configured())return{offerings:sampleOfferings,settings:defaults,preview:true};
 const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}});
 const [a,b]=await Promise.all([c.from('offerings').select('*').eq('published',true).order('name'),c.from('site_content').select('value').eq('key','settings').single()]);
 if(a.error||b.error)return{offerings:[],settings:defaults,preview:false,error:'Availability is temporarily unavailable. Please try again later.'};
 const settings={...defaults,...b.data?.value,payment_options:paymentOptions(b.data?.value||{})}as Settings;
 return{offerings:(a.data||[]).map(o=>({...o,images:o.images?.length?o.images:[siteImage(settings,'fallback').src]}))as Offering[],settings,preview:false};
}
