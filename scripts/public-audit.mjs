// Read-only public surface audit. Prints counts and timings, never credential values or response bodies.
const base=new URL(process.argv[2]||'https://yvanders-nature-hills.netlify.app');
const paths=['/','/stays','/camping','/gatherings','/about','/gallery','/faq','/contact','/privacy','/account','/admin','/api/session','/api/admin','/api/bookings'];
const assets=new Set();const pages=[];let privileged=0,publicKeys=0,bytes=0,maps=0;
function inspect(body){
 for(const token of new Set(body.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[])){try{const p=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));if(p.role==='service_role')privileged++;else if(p.role==='anon')publicKeys++;}catch{}}
 privileged+=(body.match(/\bsb_secret_[A-Za-z0-9_-]{20,}|\bre_[A-Za-z0-9]{32,}/g)||[]).length;
}
for(const path of paths){const start=performance.now();const r=await fetch(new URL(path,base),{signal:AbortSignal.timeout(30000)});const body=await r.text();inspect(body);for(const m of body.matchAll(/<script[^>]+src="([^"]+)"/g)){const u=new URL(m[1],base);if(u.origin===base.origin)assets.add(u.href);}
 pages.push({path,status:r.status,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(body),cache:r.headers.get('cache-control'),frame:r.headers.get('x-frame-options'),nosniff:r.headers.get('x-content-type-options'),csp:!!r.headers.get('content-security-policy'),preview:body.includes('Design preview ·'),placeholder:/system-check-do-not-pay|YOUR_VERIFIED|lorem ipsum|TODO_PLACEHOLDER/i.test(body)});
}
for(const url of assets){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});const body=await r.text();bytes+=Buffer.byteLength(body);inspect(body);const map=await fetch(url+'.map',{method:'HEAD',signal:AbortSignal.timeout(30000)});if(map.ok&&/json|octet-stream/.test(map.headers.get('content-type')||''))maps++;}
console.log(JSON.stringify({base:base.origin,pages,clientAssets:assets.size,clientBytes:bytes,accessibleMaps:maps,privilegedCredentialMatches:privileged,expectedPublicKeyMatches:publicKeys,note:'Timings are individual unthrottled HTTP samples, not browser Core Web Vitals. Pattern scanning cannot prove absence of every secret.'},null,2));
