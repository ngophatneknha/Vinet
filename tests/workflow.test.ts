import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createDatabase,postgresSQL,type QueryPool} from '../lib/database';
import {CLAIM_RAW,CLAIM_PAIR,RECONCILE_PAIR} from '../lib/workflow-sql';
import {agreement,validateAnnotation} from '../lib/rules';
import {verifyImage,CHUNK_BYTES} from '../lib/uploads';

test('PostgreSQL migration, claims, constraints and transactions',async()=>{
 const pg=new PGlite();
 const sql=await readFile(new URL('../db/migrations/0000_black_vargas.sql',import.meta.url),'utf8');await pg.exec(sql);
 const query=async(q:string,v:any[]=[])=>{const r=await pg.query(q,v);return {...r,rowCount:r.affectedRows}};
 const pool={query,connect:async()=>({query,release(){}})} as QueryPool;
 const db=createDatabase(()=>pool),stmt=(q:string,...v:any[])=>db.prepare(q).bind(...v);
 try{
  await stmt("INSERT INTO articles(id,publisher,headline,payload) VALUES('a','test','Synthetic article','{}'),('b','test','Second article','{}')").run();
  await stmt("INSERT INTO assets(id,format) VALUES('asset','png')").run();
  await stmt("INSERT INTO images(id,article_id,asset_id,payload) VALUES('ia','a','asset','{}'),('ib','b','asset','{}')").run();
  assert.equal(await stmt(CLAIM_RAW,'alice').first(),null,'missing images cannot be claimed');
  await stmt("UPDATE assets SET ready=1").run();
  const a=await stmt(CLAIM_RAW,'alice').first(),b=await stmt(CLAIM_RAW,'bob').first();
  assert.notEqual(a.id,b.id);assert.equal(await stmt(CLAIM_RAW,'carol').first(),null);
  await assert.rejects(db.batch([stmt("UPDATE articles SET headline='should rollback' WHERE id='a'"),stmt("INSERT INTO articles(id,publisher,headline,payload) VALUES('a','test','duplicate','{}')")]));
  assert.equal((await stmt("SELECT headline FROM articles WHERE id='a'").first()).headline,'Synthetic article');
  await stmt("INSERT INTO batches(id,name,created) VALUES('pilot','Pilot','2026-09-03')").run();
  await stmt("INSERT INTO pairs(id,article_id,image_id,batch_id,created) VALUES('pair','a','ib','pilot','2026-09-03')").run();
  assert.equal((await stmt(CLAIM_PAIR,'ann1','alice','2026-09-03','alice').first()).pair_id,'pair');
  assert.equal(await stmt(CLAIM_PAIR,'ann-again','alice','2026-09-03','alice').first(),null,'same user cannot take second slot');
  assert.equal((await stmt(CLAIM_PAIR,'ann2','bob','2026-09-03','bob').first()).pair_id,'pair');
  assert.equal(await stmt(CLAIM_PAIR,'ann3','carol','2026-09-03','carol').first(),null,'only two slots');
  await db.batch([stmt("SELECT id FROM pairs WHERE id='pair' FOR UPDATE"),stmt("UPDATE annotations SET state='submitted',label='matched' WHERE id='ann1' AND state='draft'"),stmt(RECONCILE_PAIR,'pair')]);
  assert.equal((await stmt("SELECT state FROM pairs WHERE id='pair'").first()).state,'open');
  await db.batch([stmt("SELECT id FROM pairs WHERE id='pair' FOR UPDATE"),stmt("UPDATE annotations SET state='submitted',label='out_of_context' WHERE id='ann2' AND state='draft'"),stmt(RECONCILE_PAIR,'pair')]);
  assert.equal((await stmt("SELECT state FROM pairs WHERE id='pair'").first()).state,'review');
  assert.equal((await stmt("UPDATE annotations SET label='invalid' WHERE id='ann1' AND state='draft'").run()).meta.changes,0,'submitted result cannot be overwritten');
  await stmt("INSERT INTO adjudications VALUES('decision','pair','pair','carol','out_of_context','Evidence checked','{}','2026-09-03')").run();
  await assert.rejects(stmt("INSERT INTO adjudications VALUES('decision2','pair','pair','dave','matched','Overwrite attempt','{}','2026-09-03')").run());
  const count=await stmt('SELECT COUNT(*) n FROM annotations').first();assert.equal(count.n,2,'Postgres count normalized to number');
 }finally{await pg.close()}
});

test('parameter placeholders do not rewrite quoted question marks',()=>{
 assert.equal(postgresSQL("SELECT '?' text, ? value, 'it''s ?' text2, ? other"),"SELECT '?' text, $1 value, 'it''s ?' text2, $2 other");
});
test('complete questions, evidence and label consistency',()=>{
 const review={label:'matched',reason:'Verified evidence from the original source',evidence:['https://example.test/source'],answers:[true,true,true,true,true,false].map(yes=>({yes,uncertainty:0}))};
 assert.equal(validateAnnotation(review).difficulty,'easy');
 assert.throws(()=>validateAnnotation({...review,evidence:[]}));
 assert.throws(()=>validateAnnotation({...review,answers:review.answers.slice(1)}));
 assert.throws(()=>validateAnnotation({...review,label:'out_of_context'}));
 assert.equal(agreement([]).kappa,null);assert.equal(agreement([{a:'matched',b:'matched'},{a:'out_of_context',b:'out_of_context'}]).kappa,1);
});
test('large image chunk reassembly preserves exact SHA-256',()=>{
 const bytes=new Uint8Array(9_500_000);bytes.set([137,80,78,71,13,10,26,10]);bytes[8]=123;
 const id='sha256_'+createHash('sha256').update(bytes).digest('hex');
 const reconstructed=new Uint8Array(bytes.length);
 for(let i=0;i<Math.ceil(bytes.length/CHUNK_BYTES);i++)reconstructed.set(bytes.slice(i*CHUNK_BYTES,(i+1)*CHUNK_BYTES),i*CHUNK_BYTES);
 assert.doesNotThrow(()=>verifyImage(reconstructed.buffer,id,'png'));
 reconstructed[8]=124;assert.throws(()=>verifyImage(reconstructed.buffer,id,'png'));
 assert.throws(()=>verifyImage(bytes.buffer,id,'jpeg'));
});
