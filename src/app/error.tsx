'use client';
export default function Error({reset}:{reset:()=>void}){return <main id="main" className="section empty-state"><h1>A little pause in the journey.</h1><p>We couldn’t load this page. Please try again.</p><button className="button" onClick={reset}>Try again</button></main>;}
