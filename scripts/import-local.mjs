// Administrative, resumable importer. Credentials are supplied only through env.
import {readFile,stat,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {resolve,relative,isAbsolute} from 'node:path';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import {getDatabase} from '@netlify/database';
import {getStore} from '@netlify/blobs';

const {values:o}=parseArgs({options:{manifest:{type:'string'},root:{type:'string'},site:{type:'string'},report:{type:'string'},workers:{type:'string',default:'12'},staged:{type:'string'},'verify-only':{type:'boolean',default:false}}});
const check=(ok,message)=>{if(!ok)throw Error(message)};
check(o.manifest&&o.root&&o.site&&o.report,'Require --manifest --root --site --report');
check(o.site==='3dae70d5-f7f6-4a65-bad0-cf96bad5c08c','This importer is scoped to vinet-annotation in the ngophat031 team');
check(process.env.NETLIFY_AUTH_TOKEN&&process.env.DATABASE_URL&&process.env.VINEWS_IMPORT_TOKEN,'Missing credentials in environment');
const root=resolve(o.root),started=new Date().toISOString();
const flags=JSON.parse(await readFile(new URL('../lib/inventory-flags.json',import.meta.url),'utf8'));
const articles=[],assets=new Map(),imageIds=new Set();let occurrences=0;
const input=createReadStream(o.manifest),lines=createInterface({input:o.manifest.endsWith('.gz')?input.pipe(createGunzip()):input,crlfDelay:Infinity});
for await(const line of lines){
 if(!line.trim())continue;const a=JSON.parse(line);
 check(typeof a.article_id==='string'&&a.article_id.length<150&&a.publisher&&a.headline&&a.article_url&&a.publish_date&&a.collection_timestamp,'Article metadata invalid');
 check(Array.isArray(a.images)&&a.images.length>0&&a.images.length<=200,'Image inventory invalid');
 for(const i of a.images){
  const format=i.format==='jpg'?'jpeg':i.format;
  check(typeof i.image_id==='string'&&!imageIds.has(i.image_id)&&/^sha256_[a-f0-9]{64}$/.test(i.asset_id)&&['jpeg','png'].includes(format)&&i.width>0&&i.height>0&&typeof i.is_lead_image==='boolean'&&i.image_url,'Image metadata invalid');
  imageIds.add(i.image_id);occurrences++;
  const path=resolve(root,i.local_path),rel=relative(root,path);check(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'Image leaves dataset root');
  const previous=assets.get(i.asset_id);check(!previous||previous.format===format,'Conflicting asset format');
  if(!previous)assets.set(i.asset_id,{id:i.asset_id,format,path,expectedBytes:i.file_size_bytes});
 }
 const inventory=flags[a.article_id];if(inventory){a.inventory_audit=inventory;a.inventory_incomplete=true}
 articles.push(a);
}
check(new Set(articles.map(a=>a.article_id)).size===articles.length,'Duplicate article id');
check(articles.length===25000&&assets.size===61456&&occurrences===64686,'Manifest does not match approved raw25000 inventory');
let expectedBytes=0;
for(const a of assets.values()){const s=await stat(a.path);check(s.isFile()&&s.size>0&&s.size<=20_000_000&&s.size===a.expectedBytes,'Local asset size mismatch: '+a.id);expectedBytes+=s.size}
check(expectedBytes===23991100389,'Dataset byte total mismatch');
console.log(JSON.stringify({phase:'validated',articles:articles.length,occurrences,assets:assets.size,bytes:expectedBytes}));

const pool=getDatabase({connectionString:process.env.DATABASE_URL}).pool;
const store=getStore({name:'vinews-images',siteID:o.site,token:process.env.NETLIFY_AUTH_TOKEN,consistency:'strong'});
const base='https://vinet-annotation.netlify.app';
const staged=new Set(o.staged?(await readFile(o.staged,'utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line).id):[]);
const progress={started,site_id:o.site,phase:'metadata',articles_expected:articles.length,images_expected:occurrences,assets_expected:assets.size,bytes_expected:expectedBytes,metadata_processed:0,uploaded_this_run:0,bytes_this_run:0,failed:[]};
let stopped=false;process.on('SIGINT',()=>{stopped=true});
const report=async()=>writeFile(o.report,JSON.stringify({...progress,updated:new Date().toISOString()},null,2));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function request(path,data,method='GET'){
 const headers={Authorization:'Bearer '+process.env.VINEWS_IMPORT_TOKEN};
 if(data&&!Buffer.isBuffer(data)){data=JSON.stringify(data);headers['Content-Type']='application/json'}else if(data)headers['Content-Type']='application/octet-stream';
 for(let attempt=0;;attempt++){
  try{
   const r=await fetch(base+path,{method,headers,body:data,signal:AbortSignal.timeout(100_000)});
   if(!r.ok){const e=Error('Import HTTP '+r.status);e.status=r.status;e.retry=[408,429,500,502,503,504].includes(r.status);throw e}
   return await r.json();
  }catch(e){if(attempt>=6||e.retry===false)throw e;await pause(Math.min(30_000,1000*2**attempt))}
 }
}
async function workers(items,count,fn){let index=0;await Promise.all(Array.from({length:count},async()=>{while(!stopped){const item=items[index++];if(!item)break;await fn(item)}}))}
try{
 const before=await pool.query('SELECT (SELECT count(*) FROM articles)::int AS articles,(SELECT count(*) FROM assets WHERE ready=1)::int AS ready');console.log(JSON.stringify({phase:'database',...before.rows[0]}));
 // The production API remains the only write path. Administrative DB access is read-only.
 if(!o['verify-only']){
  await request('/api/import');
  const imported=new Set((await pool.query('SELECT id FROM articles')).rows.map(r=>r.id));
  progress.metadata_processed=articles.filter(a=>imported.has(a.article_id)).length;
  const batches=[];let batch=[],bytes=0;
  for(const a of articles){if(imported.has(a.article_id))continue;const n=Buffer.byteLength(JSON.stringify(a));check(n<1_800_000,'Article exceeds API request limit');if(batch.length&&(batch.length>=25||bytes+n>1_800_000)){batches.push(batch);batch=[];bytes=0}batch.push(a);bytes+=n}if(batch.length)batches.push(batch);
  let lastPrint=0;
  await workers(batches,16,async group=>{await request('/api/import',{articles:group},'POST');progress.metadata_processed+=group.length;if(Date.now()-lastPrint>15_000||progress.metadata_processed===articles.length){lastPrint=Date.now();await report();console.log(JSON.stringify({phase:'metadata',processed:progress.metadata_processed,total:articles.length}))}});
 }
 const existing=await pool.query('SELECT id,format,ready,bytes FROM assets');const pending=[];let ready=0,readyBytes=0;
 for(const row of existing.rows){const local=assets.get(row.id);if(!local)continue;check(local.format===row.format,'Stored format mismatch');if(row.ready){check(row.bytes===local.expectedBytes,'Stored asset size mismatch');ready++;readyBytes+=row.bytes}else pending.push(local)}
 check(ready+pending.length===assets.size,'Metadata import incomplete');
 progress.phase=o['verify-only']?'verify':'images';progress.already_ready=ready;progress.already_ready_bytes=readyBytes;await report();console.log(JSON.stringify({phase:progress.phase,pending:pending.length,already_ready:ready}));
 let lastPrint=0;
 if(!o['verify-only'])await workers(pending,Math.min(64,Math.max(1,Number(o.workers))),async a=>{
  try{
   const data=await readFile(a.path);check('sha256_'+createHash('sha256').update(data).digest('hex')===a.id,'SHA-256 mismatch');
   const jpeg=data[0]===255&&data[1]===216&&data[2]===255,png=Buffer.from([137,80,78,71,13,10,26,10]).equals(data.subarray(0,8));check(a.format==='png'?png:jpeg,'Format mismatch');
   const path='/api/import/'+a.id,chunk=4_000_000;
   if(staged.has(a.id))await request(path,{size:data.length,parts:Math.ceil(data.length/chunk)},'POST');
   else if(data.length<=chunk)await request(path,data,'PUT');
   else{for(let start=0,part=0;start<data.length;start+=chunk,part++)await request(path+'?part='+part,data.subarray(start,start+chunk),'PUT');await request(path,{size:data.length,parts:Math.ceil(data.length/chunk)},'POST')}
   progress.uploaded_this_run++;progress.bytes_this_run+=data.length;
  }catch(e){progress.failed.push({id:a.id,error:e.status||e.code||e.message});if(progress.failed.length>=12)stopped=true}
  if(Date.now()-lastPrint>15_000){lastPrint=Date.now();await report();console.log(JSON.stringify({phase:'images',ready:ready+progress.uploaded_this_run,total:assets.size,GB:((readyBytes+progress.bytes_this_run)/1e9).toFixed(2),failed:progress.failed.length}))}
 });
 progress.phase='verify';await report();
 const cloud=new Set();for await(const page of store.list({prefix:'images/',paginate:true})){for(const blob of page.blobs)cloud.add(blob.key.slice(7))}
 const missing=[...assets.keys()].filter(id=>!cloud.has(id));
 const final=await pool.query("SELECT (SELECT count(*) FROM articles)::int AS articles,(SELECT count(*) FROM images)::int AS images,(SELECT count(*) FROM assets)::int AS assets,(SELECT count(*) FROM assets WHERE ready=1)::int AS ready_assets,(SELECT COALESCE(sum(bytes),0) FROM assets WHERE ready=1)::bigint AS ready_bytes,(SELECT count(*) FROM articles WHERE inventory_flag=1)::int AS inventory_flags,(SELECT count(*) FROM articles a WHERE NOT EXISTS(SELECT 1 FROM images i JOIN assets s ON s.id=i.asset_id WHERE i.article_id=a.id AND s.ready=0))::int AS articles_with_images");
 progress.final=final.rows[0];progress.missing_blob_count=missing.length;progress.missing_blob_ids=missing.slice(0,20);
 check(!stopped&&missing.length===0&&progress.failed.length===0&&progress.final.articles===25000&&progress.final.images===64686&&progress.final.assets===61456&&progress.final.ready_assets===61456&&Number(progress.final.ready_bytes)===expectedBytes,'Import incomplete; resume using the same command');
 progress.phase='complete';progress.completed=new Date().toISOString();await report();console.log(JSON.stringify({phase:'complete',...progress.final,missing_blobs:missing.length}));
}catch(e){stopped=true;progress.phase='incomplete';progress.error=e.code||e.message;await report();console.error('Import stopped:',e.code||e.message);process.exitCode=1}
finally{await pool.end()}
