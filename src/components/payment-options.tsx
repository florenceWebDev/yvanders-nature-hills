import {paymentOptions,methodLabel} from '@/lib/payments';
import type {Settings} from '@/lib/types';
export function PaymentOptions({payment,selected}:{payment:Settings;selected?:string}){
 const options=paymentOptions(payment).filter(o=>o.id===selected);
 return <div className="payment-options">{options.map(option=><section className="payment-option" key={option.id}>
  <h4>{option.label}</h4><img className="payment-qr" src={option.qr_url} alt={option.label+' payment QR for '+option.recipient}/>
  <p><strong>Recipient: {option.recipient}</strong></p><p className="preserve">{option.instructions}</p>
  <a className="text-link underline" href={option.qr_url} download target="_blank" rel="noreferrer">Open / save {option.label} QR</a>
 </section>)}</div>;
}

export function PaymentChoice({payment,selected,onChange}:{payment:Settings;selected:string;onChange:(id:string)=>void}){return <><label>Payment method<select value={selected} onChange={e=>onChange(e.target.value)} required><option value="">Choose how to pay</option>{paymentOptions(payment).map(o=><option key={o.id} value={o.id}>{o.method?methodLabel(o.method)+' · ':''}{o.label}</option>)}</select></label><PaymentOptions payment={payment} selected={selected}/></>;}
