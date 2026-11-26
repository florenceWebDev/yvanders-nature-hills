import type {PaymentOption,Settings} from './types';
// Existing booking snapshots remain readable after the settings migration.
export function paymentOptions(settings:Pick<Settings,'payment_options'|'qr_url'|'payment_recipient'|'payment_instructions'>):PaymentOption[]{
 if(Array.isArray(settings.payment_options))return settings.payment_options;
 return settings.qr_url&&settings.payment_recipient?[{id:'00000000-0000-4000-8000-000000000001',label:'QR payment',qr_url:settings.qr_url,recipient:settings.payment_recipient,instructions:settings.payment_instructions||''}]:[];
}

export const paymentMethods=[['cash','Cash'],['gcash','GCash'],['bank','Bank transfer'],['other','Other']] as const;
export function paymentSummary(b:{total:number;paid:number;refunded?:number}){const refunded=b.refunded||0,net=b.paid-refunded,balance=Math.max(0,b.total-net);return{refunded,net,balance,label:b.total===0?'No payment required':balance===0?'Fully paid':net>0?'Partially paid':'Unpaid'};}
export function methodLabel(method:string){return paymentMethods.find(([id])=>id===method)?.[1]||'Unspecified';}
