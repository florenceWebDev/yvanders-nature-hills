import type {PaymentOption,Settings} from './types';
// Existing booking snapshots remain readable after the settings migration.
export function paymentOptions(settings:Pick<Settings,'payment_options'|'qr_url'|'payment_recipient'|'payment_instructions'>):PaymentOption[]{
 if(Array.isArray(settings.payment_options))return settings.payment_options;
 return settings.qr_url&&settings.payment_recipient?[{id:'00000000-0000-4000-8000-000000000001',label:'QR payment',qr_url:settings.qr_url,recipient:settings.payment_recipient,instructions:settings.payment_instructions||''}]:[];
}
