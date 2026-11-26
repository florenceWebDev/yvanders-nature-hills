'use client';
import {useState} from 'react';
import {contrast,galleryDefaults,imageSlots,paletteDefaults,paletteStyle,siteImage} from '@/lib/appearance';
import type {ImageSlot,Palette,SiteImage} from '@/lib/appearance';
import type {Settings} from '@/lib/types';
import {uploadOriginal} from '@/lib/uploads';

type Props={value:Settings;onChange:(value:Settings)=>void;disabled:boolean;onBusy:(busy:boolean)=>void;onError:(message:string)=>void};
export function AppearanceEditor({value,onChange,disabled,onBusy,onError}:Props){
 const [uploading,setUploading]=useState(false);
 const palette={...paletteDefaults,...value.palette};
 const gallery=value.gallery??galleryDefaults;
 const update=(patch:Partial<Settings>)=>onChange({...value,...patch});
 async function upload(file:File|undefined,done:(src:string)=>void){
  if(!file)return;setUploading(true);onBusy(true);onError('');
  try{done((await uploadOriginal(file)).url);}catch(e){onError(e instanceof Error?e.message:'Upload failed. Please retry.');}
  finally{setUploading(false);onBusy(false);}
 }
 function imageControl(label:string,size:string,image:SiteImage,change:(image:SiteImage)=>void,reset:()=>void){return <div className="appearance-image">
  <h4>{label}</h4><p className="small">Recommended: {size} px · JPEG, PNG or WebP · Up to 10 MB</p>
  {image.src&&<img src={image.src} alt={image.alt} loading="lazy"/>}
  <label>Replace image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(e.target.files?.[0],src=>change({...image,src}));e.target.value='';}}/></label>
  <label>Image description<input value={image.alt} maxLength={300} onChange={e=>change({...image,alt:e.target.value})}/></label>
  <button className="text-link" type="button" onClick={reset}>Reset to original</button>
 </div>;}
 return <fieldset disabled={disabled||uploading} className="appearance-editor"><legend>Website appearance</legend>
  <h3>Logo</h3><p>Recommended: transparent PNG, 1200 × 400 px. Shown in the header and footer without cropping.</p>
  {imageControl('Site logo','1200 × 400',value.logo||{src:'',alt:'Yvander’s Nature Hills'},logo=>update({logo}),()=>update({logo:undefined}))}
  <h3>Website colors</h3><p>Choose each color role. Preview before saving; changes apply to the public website and staff workspace.</p>
  <div className="palette-grid">{Object.entries(palette).map(([key,color])=><label key={key}>{({forest:'Primary brand',deep:'Deep brand',gold:'Accent',cream:'Page background',white:'Surface',text:'Body text',muted:'Secondary text',line:'Borders',section:'Section background',buttonText:'Button text',success:'Success text',successBg:'Success background',warning:'Warning text',warningBg:'Warning background',danger:'Danger text',dangerBg:'Danger background'} as Record<string,string>)[key]}
   <div className="color-input"><input aria-label={`${key} color picker`} type="color" value={color} onChange={e=>update({palette:{...palette,[key]:e.target.value}})}/><input aria-label={`${key} hex color`} value={color} pattern="#[0-9a-fA-F]{6}" maxLength={7} required onChange={e=>update({palette:{...palette,[key]:e.target.value}})}/></div>
  </label>)}</div>
  <button type="button" className="text-link" onClick={()=>update({palette:{...paletteDefaults}})}>Reset original palette</button>
  <div className="appearance-preview" style={paletteStyle(palette)}><h3>Your time in the hills</h3><p>A preview of your website colors.</p><span className="button">Plan your escape</span> <span className="badge badge-confirmed">Confirmed</span> <span className="badge badge-pending_review">Awaiting review</span> <span className="badge badge-cancelled">Cancelled</span></div>
  <ul className="small">{([['Body text','text','cream'],['Secondary text','muted','white'],['Button','buttonText','forest'],['Header and footer','buttonText','deep'],['Accent on deep background','gold','deep'],['Success','success','successBg'],['Warning','warning','warningBg'],['Danger','danger','dangerBg']] as [string,keyof Palette,keyof Palette][]).map(([label,a,b])=>{
   const valid=/^#[\da-f]{6}$/i.test(palette[a])&&/^#[\da-f]{6}$/i.test(palette[b]);const ratio=valid?contrast(palette[a],palette[b]):0;
   return <li key={label}>{label}: {valid?`${ratio.toFixed(1)}:1 contrast${ratio<4.5?' — choose more contrasting colors for readable text':''}`:'enter valid hex colors'}</li>;
  })}</ul>
  <h3>Page images</h3><div className="appearance-image-grid">{(Object.keys(imageSlots) as ImageSlot[]).map(key=><div key={key}>{imageControl(imageSlots[key].label,imageSlots[key].size,siteImage(value,key),image=>update({images:{...value.images,[key]:image}}),()=>{const images={...value.images};delete images[key];update({images});})}</div>)}</div>
  <h3>Website gallery</h3><p>The homepage shows the first four gallery images. Recommended: 1600 × 1200 px.</p>
  <div className="appearance-image-grid">{gallery.map((image,i)=><div className="appearance-image" key={i}>
   {imageControl(`Gallery image ${i+1}`,'1600 × 1200',image,next=>update({gallery:gallery.map((g,j)=>i===j?next:g)}),()=>update({gallery:gallery.map((g,j)=>i===j?(galleryDefaults[i]||galleryDefaults[0]):g)}))}
   <div className="button-row"><button type="button" className="text-link" disabled={i===0} onClick={()=>{const next=[...gallery];[next[i-1],next[i]]=[next[i],next[i-1]];update({gallery:next});}}>Move up</button><button type="button" className="text-link" disabled={i===gallery.length-1} onClick={()=>{const next=[...gallery];[next[i+1],next[i]]=[next[i],next[i+1]];update({gallery:next});}}>Move down</button><button type="button" className="text-link" onClick={()=>update({gallery:gallery.filter((_,j)=>j!==i)})}>Remove</button></div>
  </div>)}</div>
  <label>Add gallery image ({gallery.length}/20)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={gallery.length>=20} onChange={e=>{void upload(e.target.files?.[0],src=>update({gallery:[...gallery,{src,alt:'Campsite gallery photo'}]}));e.target.value='';}}/></label>
  <button type="button" className="text-link" onClick={()=>update({gallery:[...galleryDefaults]})}>Reset original gallery</button>
 </fieldset>;
}
