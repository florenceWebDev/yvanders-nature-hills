import{catalog}from'@/lib/data';
import{Listings}from'@/components/listings';
import{PreviewNotice}from'@/components/shell';
export const metadata={title:'Find your stay'};
export default async function Stays({searchParams}:{searchParams:Promise<{arrival?:string;departure?:string;guests?:string}>}){const{offerings,preview,error}=await catalog();return <main id="main"><section className="page-heading"><div className="eyebrow">YOUR HILLSIDE HOME</div><h1>A stay for every<br/><em>kind of escape.</em></h1><p>Find your space, bring your people, and make yourself at home.</p></section>{preview&&<PreviewNotice/>}<section className="section listing-section">{error?<p role="alert">{error}</p>:<Listings offerings={offerings} preview={preview} initial={await searchParams}/>}</section></main>;}
