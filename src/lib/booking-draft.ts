import {z} from 'zod';

export const arrivalPolicy='Your reservation ends at your selected arrival time on your departure date. Arriving late does not extend your reservation.';
const draftSchema=z.object({version:z.literal(1),id:z.uuid(),savedAt:z.number(),offering:z.uuid(),path:z.string(),values:z.record(z.string(),z.union([z.string(),z.number()]))});
export type BookingDraft=z.infer<typeof draftSchema>;
const key='ynh-booking-draft-v1';
export function safeBookingReturn(value:unknown):string|null{
 if(typeof value!=='string'||value.length>2048||!/^\/stays\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\?|$)/.test(value)||/[\\\u0000-\u0020]/.test(value))return null;
 try{const u=new URL(value,'https://booking.invalid');if(u.origin!=='https://booking.invalid'||u.hash)return null;return u.pathname+u.search;}catch{return null;}
}
export function parseDraft(raw:string|null,now=Date.now()):BookingDraft|null{
 try{const parsed=draftSchema.safeParse(JSON.parse(raw||'null'));if(!parsed.success)return null;const d=parsed.data;return now>=d.savedAt&&now-d.savedAt<86400000&&safeBookingReturn(d.path)===d.path?d:null;}catch{return null;}
}
export function saveBookingDraft(offering:string,path:string,values:BookingDraft['values']){
 const draft:BookingDraft={version:1,id:crypto.randomUUID(),savedAt:Date.now(),offering,path,values};
 localStorage.setItem(key,JSON.stringify(draft));
 return `${path}?draft=${draft.id}`;
}
export function readBookingDraft(){try{const raw=localStorage.getItem(key),draft=parseDraft(raw);if(raw&&!draft)localStorage.removeItem(key);return draft;}catch{return null;}}
export function clearBookingDraft(){try{localStorage.removeItem(key);}catch{/* Storage can be unavailable. */}}
