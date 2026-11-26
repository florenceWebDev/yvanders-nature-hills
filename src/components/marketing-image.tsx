import Image,{type ImageProps} from 'next/image';
export function optimizableImage(src:string){
 if(src.startsWith('/images/'))return true;
 try{const url=new URL(src);return url.origin===new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'https://unconfigured.invalid').origin&&url.pathname.startsWith('/storage/v1/object/public/marketing/')&&!url.search;}
 catch{return false;}
}
export function MarketingImage(props:Omit<ImageProps,'width'|'height'> & {width?:number;height?:number}){
 return <Image width={1600} height={1200} sizes="(max-width: 800px) 100vw, 50vw" {...props} unoptimized={typeof props.src!=='string'||!optimizableImage(props.src)}/>;
}
