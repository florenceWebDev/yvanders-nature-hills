import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {cleanDeletedReceipts} from '../src/lib/receipt-cleanup';

function fixture({past=false,fail=false}={}){
 const job={id:'cleanup-job',prefix:'fictional-owner/fictional-booking',finish_after:new Date(Date.now()+(past?-1:1)*3600000).toISOString(),attempts:1};
 let files=['receipt.png'];let deleted=false;let update:Record<string,unknown>={};
 const client={rpc:async()=>({data:[job],error:null}),storage:{from:()=>({
  list:async()=>({data:files.map(name=>({id:name,name})),error:fail?{message:'Unavailable'}:null}),
  remove:async(paths:string[])=>{assert.ok(paths.every(path=>path.startsWith(job.prefix+'/')));files=[];return{error:null};},
 })},from:(table:string)=>{assert.equal(table,'receipt_cleanup_jobs');return{
  delete:()=>({eq:async()=>{deleted=true;return{error:null};}}),
  update:(value:Record<string,unknown>)=>({eq:async()=>{update=value;return{error:null};}}),
 };}} as unknown as SupabaseClient;
 return{client,job,get files(){return files;},set files(value:string[]){files=value;},get deleted(){return deleted;},get update(){return update;}};
}
test('cleanup erases files but retains the job to catch a late signed upload',async()=>{
 const f=fixture();assert.deepEqual(await cleanDeletedReceipts(f.client),{cleaned:1,cleanupFailed:0});assert.deepEqual(f.files,[]);assert.equal(f.deleted,false);
 f.files=['late-upload.png'];await cleanDeletedReceipts(f.client);assert.deepEqual(f.files,[]);assert.equal(f.deleted,false);assert.equal(f.update.locked_at,null);
});
test('cleanup finishes only after the upload grace window and an empty scan',async()=>{
 const f=fixture({past:true});await cleanDeletedReceipts(f.client);assert.deepEqual(f.files,[]);assert.equal(f.deleted,true);
});
test('storage failure preserves the cleanup job and schedules a retry',async()=>{
 const f=fixture({fail:true});assert.deepEqual(await cleanDeletedReceipts(f.client),{cleaned:0,cleanupFailed:1});assert.equal(f.deleted,false);assert.equal(f.update.locked_at,null);assert.ok(Date.parse(f.update.available_at as string)>Date.now());assert.deepEqual(f.files,['receipt.png']);
});
