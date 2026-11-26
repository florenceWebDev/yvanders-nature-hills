export type SessionState={configured:boolean;user:{id:string;email:string}|null;admin:boolean};
export async function readSession(signal?:AbortSignal):Promise<SessionState>{
 const response=await fetch('/api/session',{signal,cache:'no-store'});const data=await response.json();
 if(!response.ok)throw new Error(data.error||'Unable to check your account. Please try again.');
 return data;
}
