'use client';
import {useEffect,useState} from 'react';
import {adminGet} from './admin-dashboard';
import {localTime} from '@/lib/catalog';
import {post} from './booking-form';
type Row={id:string;subject?:string;recipient?:string;status?:string;attempts?:number;last_error?:string;action?:string;created_at:string;record_id?:string};
export function AdminActivity({preview,revision,run}:{preview:boolean;revision:number;run:(task:()=>Promise<unknown>)=>Promise<void>}){
 return <><Log kind="emails" preview={preview} revision={revision} run={run}/><Log kind="activity" preview={preview} revision={revision} run={run}/></>;
}
function Log({kind,preview,revision,run}:{kind:'emails'|'activity';preview:boolean;revision:number;run:(task:()=>Promise<unknown>)=>Promise<void>}){
 const [page,setPage]=useState(0),[data,setData]=useState<{rows:Row[];total:number}>({rows:[],total:0}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const c=new AbortController();if(preview)return;setBusy(true);setError('');adminGet<typeof data>(`admin/${kind}?page=${page}`,c.signal).then(setData).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setBusy(false);});return()=>c.abort();},[kind,page,preview,revision]);
 return <section className="panel"><h2>{kind==='emails'?'Email delivery':'Activity log'}</h2>{kind==='emails'&&<p className="small muted">Delivery failures retry up to eight attempts. Provider throttling delays the queue; exhausted jobs require a staff retry.</p>}{error?<p role="alert" className="notice">{error}</p>:busy?<p role="status">Loading…</p>:<>{data.rows.map(row=><div className="audit-row" key={row.id}><strong>{row.subject||row.action?.replaceAll('_',' ')}</strong><span>{row.recipient||localTime(row.created_at)}</span>{row.status&&<span>{row.status} · {row.attempts} attempts</span>}<small>{row.last_error||row.record_id}</small>{row.status==='failed'&&<button className="text-link" disabled={preview} onClick={()=>run(()=>post('admin/email/retry',{id:row.id})).catch(()=>{})}>Retry</button>}</div>)}{!data.rows.length&&<p>No records on this page.</p>}</>}<nav className="button-row" aria-label={`${kind} pages`}><button className="button button-outline" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Previous page</button><span>Page {page+1} · {data.total} records</span><button className="button button-outline" disabled={busy||(page+1)*100>=data.total} onClick={()=>setPage(p=>p+1)}>Next page</button></nav></section>;
}
