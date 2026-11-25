// Upload original files directly to scoped Supabase signed URLs. This avoids
// the hosting function's request-body limit and preserves payment evidence.
export async function uploadOriginal(file:File,booking?:string,reference?:string){
 if(file.size===0||file.size>10*1024*1024)throw new Error('Choose an image up to 10 MB.');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG, or WebP image.');
 const request=async(endpoint:string,body:unknown)=>{const r=await fetch(`/api/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Upload failed');return d;};
 const signed=await request('upload/prepare',{kind:booking?'receipt':'marketing',booking,mime:file.type,size:file.size});
 const uploaded=await fetch(signed.url,{method:'PUT',headers:{'Content-Type':file.type,'x-upsert':'false'},body:file});
 if(!uploaded.ok)throw new Error('The upload could not finish. Your booking is unchanged; please retry.');
 return request('upload/complete',{kind:booking?'receipt':'marketing',booking,reference,id:signed.id,ext:signed.ext});
}
