import 'server-only';
import {NextRequest} from 'next/server';
import {service} from './supabase';
import {clientIdentity,limit} from './http-security';
export async function userLimit(user:string,route:string,write=false){
 const specific=route==='receipt'?['receipt-links',60]:route.startsWith('upload/')?[route,10]:[write?'writes':'reads',write?30:120];
 await limit(service(),String(specific[0]),user,Number(specific[1]),60);
}
export async function anonymousLimit(req:NextRequest,group:string,count:number,seconds:number){await limit(service(),group,clientIdentity(req),count,seconds);}
export async function recoveryLimit(email:string){await limit(service(),'recovery-email',email.trim().toLowerCase(),3,3600);}
