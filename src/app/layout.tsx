import type{Metadata}from'next';
import{Header,Footer}from'@/components/shell';
import{catalog}from'@/lib/data';
import'./globals.css';
import {paletteStyle} from '@/lib/appearance';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:{default:'Yvander’s Nature Hills · A little closer to nature',template:'%s · Yvander’s Nature Hills'},description:'Discover cabins, camping, and places to gather at Yvander’s Nature Hills. Plan your nature escape and book directly with the campsite.'};
export default async function Layout({children}:{children:React.ReactNode}){const{settings}=await catalog();return <html lang="en"><body style={paletteStyle(settings.palette)}><a className="skip-link" href="#main">Skip to content</a><Header settings={settings}/>{children}<Footer settings={settings}/></body></html>;}
