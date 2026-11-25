export type Period='week'|'month'|'quarter'|'year';
export const campDate=(value:Date|string=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function addDays(day:string,n:number){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function periodRange(period:Period,anchor:string,offset=0){
 const d=new Date(`${anchor}T12:00:00Z`);let y=d.getUTCFullYear(),m=d.getUTCMonth();
 if(period==='week'){const from=addDays(anchor,-((d.getUTCDay()+6)%7)+offset*7);return{from,until:addDays(from,7)};}
 if(period==='year'){y+=offset;m=0;}else if(period==='quarter'){m=Math.floor(m/3)*3+offset*3;}else m+=offset;
 const start=new Date(Date.UTC(y,m,1,12)),end=new Date(Date.UTC(y,m+(period==='year'?12:period==='quarter'?3:1),1,12));
 return{from:start.toISOString().slice(0,10),until:end.toISOString().slice(0,10)};
}
export function overlapsDay(start:string,end:string,day:string){return new Date(start).getTime()<new Date(`${addDays(day,1)}T00:00:00+08:00`).getTime()&&new Date(end).getTime()>new Date(`${day}T00:00:00+08:00`).getTime();}
export const bookingStatuses=['awaiting_payment','pending_review','correction_requested','confirmed','expired','declined','cancelled'] as const;
