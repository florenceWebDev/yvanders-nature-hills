import{NextRequest,NextResponse}from'next/server';
import{db}from'@/lib/supabase';
import{safeBookingReturn}from'@/lib/booking-draft';
export async function GET(req:NextRequest){
 const next=safeBookingReturn(req.nextUrl.searchParams.get('next'));
 const recovery=req.nextUrl.searchParams.get('reset')==='1'||req.nextUrl.searchParams.get('next')==='/account?reset=1';
 const account=new URL('/account',req.url);if(next)account.searchParams.set('next',next);if(recovery)account.searchParams.set('reset','1');
 const code=req.nextUrl.searchParams.get('code');if(code){const c=await db();const{error}=await c.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(!recovery&&next?new URL(next,req.url):account);}
 account.searchParams.set('error','verification');return NextResponse.redirect(account);
}
