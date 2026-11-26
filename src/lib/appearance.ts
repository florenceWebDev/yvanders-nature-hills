import type {CSSProperties} from 'react';
import type {Settings} from './types';

export const paletteDefaults = {
 forest:'#173f35',deep:'#103329',gold:'#e4c496',cream:'#f7f6f0',white:'#ffffff',
 text:'#243c31',muted:'#53634e',line:'#dfe4d8',section:'#eef1e8',buttonText:'#ffffff',
 success:'#236341',successBg:'#e2efe5',warning:'#835f24',warningBg:'#fcf0d8',danger:'#8d5548',dangerBg:'#f1e9e6',
};
export type Palette = typeof paletteDefaults;
export type SiteImage = {src:string;alt:string};
export const imageSlots = {
 hero:{label:'Homepage hero',size:'2400 × 1350',src:'/images/hills.jpg',alt:'The green hills of Yvander’s Nature Hills'},
 introMain:{label:'Homepage welcome',size:'1200 × 1600',src:'/images/cabana.jpg',alt:'A hillside cabana tucked among greenery'},
 introInset:{label:'Homepage welcome inset',size:'1200 × 1600',src:'/images/tents.jpg',alt:'Tents glowing with warm lights at night'},
 experience:{label:'Homepage camping banner',size:'2400 × 1350',src:'/images/night.jpg',alt:'A warmly lit campsite beneath the evening sky'},
 gathering:{label:'Homepage gathering',size:'1600 × 1200',src:'/images/pavilion.jpg',alt:'The open pavilion at Yvander’s Nature Hills'},
 camping:{label:'Camping page',size:'1600 × 1200',src:'/images/tents.jpg',alt:'Tents at the campsite'},
 gatherings:{label:'Gatherings page',size:'1600 × 1200',src:'/images/pavilion.jpg',alt:'The gathering pavilion'},
 about:{label:'About page',size:'1600 × 1200',src:'/images/hills.jpg',alt:'Yvander’s campsite among green hills'},
 contact:{label:'Contact page',size:'1200 × 1600',src:'/images/grounds.jpg',alt:'Open grounds at Yvander’s Nature Hills'},
 account:{label:'Guest sign-in page',size:'1600 × 1200',src:'/images/tents.jpg',alt:'Tents under warm lights'},
 fallback:{label:'Accommodation fallback',size:'1600 × 1200',src:'/images/hills.jpg',alt:'The surrounding campsite landscape'},
};
export type ImageSlot = keyof typeof imageSlots;
export const galleryDefaults:SiteImage[] = ['hills','tents','cabana','grounds','pavilion','night'].map((p,i)=>({src:`/images/${p}.jpg`,alt:['A view of the green hills','An evening under canvas','A hillside cabana','Campsite grounds','The open pavilion','Warm campsite lights'][i]}));
export function siteImage(settings:Settings,key:ImageSlot):SiteImage{return settings.images?.[key]||imageSlots[key];}
export function siteGallery(settings:Settings){return settings.gallery??galleryDefaults;}
export function paletteStyle(palette:Partial<Palette>={}):CSSProperties{
 return Object.fromEntries(Object.entries({...paletteDefaults,...palette}).map(([k,v])=>[`--${k.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`,/^#[\da-f]{6}$/i.test(v)?v:paletteDefaults[k as keyof Palette]])) as CSSProperties;
}
export function contrast(a:string,b:string){
 const luminance=(hex:string)=>{const c=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
