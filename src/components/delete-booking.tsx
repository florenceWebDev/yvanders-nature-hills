'use client';
import {useState} from 'react';
import {post} from './booking-form';

export function DeleteBooking({id,reference,admin=false,onDeleted,disabled=false}:{id:string;reference:string;admin?:boolean;onDeleted:()=>Promise<void>;disabled?:boolean}){
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div>{!confirm?<button type="button" className="text-link" disabled={disabled} onClick={()=>setConfirm(true)}>{admin?'Delete reservation permanently':'Delete booking'}</button>:<div className="delete-confirmation" role="group" aria-label="Confirm permanent deletion">
  <p>Permanently delete <strong>{reference}</strong>? This cannot be undone. {admin?'Booking details, receipts, payment and refund entries will be erased. Historical report totals will change.':'Your unpaid hold will be released.'}</p>
  <div className="button-row"><button type="button" className="button danger-button" disabled={busy||disabled} onClick={async()=>{setBusy(true);setError('');try{await post(admin?'admin/bookings/delete':'bookings/delete',{booking:id});await onDeleted();}catch(e){setError(e instanceof Error?e.message:'Deletion failed. Please retry.');}finally{setBusy(false);}}}>{busy?'Deleting…':'Confirm permanent deletion'}</button><button type="button" className="button button-outline" disabled={busy} onClick={()=>{setConfirm(false);setError('');}}>Keep booking</button></div>
  {error&&<p role="alert">{error}</p>}
 </div>}</div>;
}
