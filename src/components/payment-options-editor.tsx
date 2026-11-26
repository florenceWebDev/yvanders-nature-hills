'use client';
import type {PaymentOption} from '@/lib/types';
import {uploadOriginal} from '@/lib/uploads';
type Props={options:PaymentOption[];onChange:(options:PaymentOption[])=>void;disabled:boolean;onBusy:(busy:boolean)=>void;onError:(error:string)=>void};
export function PaymentOptionsEditor({options,onChange,disabled,onBusy,onError}:Props){
 function update(id:string,patch:Partial<PaymentOption>){onChange(options.map(o=>o.id===id?{...o,...patch}:o));}
 function move(index:number,direction:number){const next=[...options];[next[index],next[index+direction]]=[next[index+direction],next[index]];onChange(next);}
 return <fieldset disabled={disabled} className="payment-editor"><legend>Payment options ({options.length}/3)</legend>
 {options.map((option,index)=><section className="payment-editor-card" key={option.id}>
 <h3>Payment option {index+1}</h3>
 <label>Payment method<select required value={option.method||''} onChange={e=>update(option.id,{method:e.target.value as PaymentOption['method']})}><option value="">Choose method</option><option value="gcash">GCash</option><option value="bank">Bank transfer</option><option value="other">Other online payment</option></select></label>
 <label>Payment label<input value={option.label} maxLength={100} required onChange={e=>update(option.id,{label:e.target.value})}/></label>
 {option.qr_url&&<img className="payment-qr" src={option.qr_url} alt={(option.label||'Payment option')+' QR preview'}/>}
 <label>{option.qr_url?'Replace QR image':'Upload QR image'}<input type="file" accept="image/jpeg,image/png,image/webp" required={!option.qr_url} onChange={async e=>{
 const input=e.currentTarget,file=input.files?.[0];if(!file)return;onBusy(true);onError('');
 try{const result=await uploadOriginal(file);update(option.id,{qr_url:result.url});}catch(error){onError(error instanceof Error?error.message:'Upload failed. Please retry.');}finally{onBusy(false);input.value='';}
 }}/><small>JPEG, PNG, or WebP · Up to 10 MB. Upload the complete QR image.</small></label>
 <label>Recipient name<input value={option.recipient} required maxLength={200} onChange={e=>update(option.id,{recipient:e.target.value})}/></label>
 <label>Payment instructions<textarea value={option.instructions} maxLength={4000} rows={3} onChange={e=>update(option.id,{instructions:e.target.value})}/></label>
 <div className="button-row"><button type="button" className="button button-outline" disabled={index===0} onClick={()=>move(index,-1)}>Move up</button><button type="button" className="button button-outline" disabled={index===options.length-1} onClick={()=>move(index,1)}>Move down</button><button type="button" className="text-link" onClick={()=>onChange(options.filter(o=>o.id!==option.id))}>Remove option</button></div>
 </section>)}
 <button type="button" className="button button-outline" disabled={options.length>=3} onClick={()=>onChange([...options,{id:crypto.randomUUID(),label:'',qr_url:'',recipient:'',instructions:''}])}>Add payment option</button>
 <p className="small">Changes take effect after saving. Existing reservations keep their original payment instructions.</p>
 </fieldset>;
}
