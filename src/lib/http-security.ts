import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';

export class HttpError extends Error {
 constructor(public status:number,public code:string,message:string,public retryAfter?:number){super(message);}
}
export async function readJson(req:Request){
 const max=256*1024;
 if(Number(req.headers.get('content-length'))>max)throw new HttpError(413,'BODY_TOO_LARGE','Request is too large.');
 const reader=req.body?.getReader();if(!reader)throw new HttpError(400,'INVALID_JSON','Enter a JSON request.');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new HttpError(413,'BODY_TOO_LARGE','Request is too large.');}chunks.push(value);}}
 finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'INVALID_JSON','Enter a valid JSON request.');}
}
export function clientIdentity(req:NextRequest){
 // This header is supplied by the Netlify ingress, never X-Forwarded-For.
 const ip=req.headers.get('x-nf-client-connection-ip');
 if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(process.env.SITE_ID||'')&&ip&&isIP(ip))return isIP(ip)===6?new URL(`http://[${ip}]/`).hostname.toLowerCase():ip;
 if(process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1','[::1]'].includes(req.nextUrl.hostname))return 'local-development';
 throw new HttpError(503,'CLIENT_IDENTITY_UNAVAILABLE','Please try again shortly.');
}
export function rateKey(group:string,identity:string,secret=process.env.RATE_LIMIT_HMAC_SECRET){
 if(!secret||secret.length<32)throw new HttpError(503,'LIMITER_UNAVAILABLE','Please try again shortly.');
 return group+':'+createHmac('sha256',secret).update(identity).digest('hex');
}
type LimiterClient={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
export async function limit(client:LimiterClient,group:string,identity:string,count:number,seconds:number){
 try{
  const {data,error}=await client.rpc('consume_rate_limit',{p_key:rateKey(group,identity),p_limit:count,p_seconds:seconds});
  if(error||typeof data!=='number')throw new Error('Limiter unavailable');
  if(data>0)throw new HttpError(429,'RATE_LIMITED','Too many requests. Please try again later.',data);
 }catch(e){if(e instanceof HttpError)throw e;throw new HttpError(503,'LIMITER_UNAVAILABLE','Please try again shortly.');}
}
export function publicFailure(error:unknown){
 if(error instanceof HttpError)return NextResponse.json({error:error.message,code:error.code},{status:error.status,headers:error.retryAfter?{'Retry-After':String(error.retryAfter)}:undefined});
 if(error instanceof z.ZodError)return NextResponse.json({error:error.issues.map(i=>i.message).join('. '),code:'INVALID_INPUT'},{status:400});
 const message=error instanceof Error?error.message:'';
 if(/^Sign in/.test(message))return NextResponse.json({error:'Sign in to continue.',code:'AUTH_REQUIRED'},{status:401});
 if(/^Admin access/.test(message))return NextResponse.json({error:'Admin access required.',code:'ADMIN_REQUIRED'},{status:403});
 const safeMessages=['Verify your email to continue.','Enter your email','Enter a new password','Enter your email and password (at least 10 characters).','Booking not found','Receipt not found','Receipt link unavailable','Payment upload is closed','Payment upload is closed. If you paid, contact the campsite.','Complimentary bookings do not require payment proof','Invalid image. Upload an actual JPEG, PNG or WebP up to 10 MB.','Invalid request origin','Guest email is required','Online payment services are not ready. Please contact the campsite.','Unable to start upload','Upload not found','Configure secure storage, email sender, app URL and scheduled-job secret before enabling payments.'];
 if(safeMessages.includes(message))return NextResponse.json({error:message,code:'REQUEST_REJECTED'},{status:400});
 // Log a diagnostic identifier, never arbitrary provider strings, request bodies or credentials.
 const incident=crypto.randomUUID();console.error('API operation failed',{incident,type:error instanceof Error?error.name:'Unknown'});
 return NextResponse.json({error:'The request could not be completed. Please try again.',code:'INTERNAL_ERROR',incident},{status:500});
}
