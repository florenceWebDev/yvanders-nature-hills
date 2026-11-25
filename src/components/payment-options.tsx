import {paymentOptions} from '@/lib/payments';
import type {Settings} from '@/lib/types';
export function PaymentOptions({payment}:{payment:Settings}){
 const options=paymentOptions(payment);
 return <div className="payment-options">{options.map(option=><section className="payment-option" key={option.id}>
  <h4>{option.label}</h4><img className="payment-qr" src={option.qr_url} alt={option.label+' payment QR for '+option.recipient}/>
  <p><strong>Recipient: {option.recipient}</strong></p><p className="preserve">{option.instructions}</p>
  <a className="text-link underline" href={option.qr_url} download target="_blank" rel="noreferrer">Open / save {option.label} QR</a>
 </section>)}</div>;
}
