import{NextRequest,NextResponse}from'next/server';
import{db}from'@/lib/supabase';
export async function GET(req:NextRequest){const code=req.nextUrl.searchParams.get('code');if(code){const c=await db();const{error}=await c.auth.exchangeCodeForSession(code);if(!error){const next=req.nextUrl.searchParams.get('next')==='/account?reset=1'?'/account?reset=1':'/account';return NextResponse.redirect(new URL(next,req.url));}}return NextResponse.redirect(new URL('/account?error=verification',req.url));}
