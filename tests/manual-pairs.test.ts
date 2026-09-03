import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createDatabase,type QueryPool} from '../lib/database';
import {createManualPair,validateManualPair} from '../lib/manual-pairs';
import {CLAIM_PAIR,RECONCILE_PAIR} from '../lib/workflow-sql';

const input={article_id:'a',image_id:'ib',batch:'pilot',strategy:'N5',reason:'Same place but photographed in a different year.',evidence:['https://example.test/original']};
test('manual candidates require strategy, reason and valid source evidence',()=>{
 validateManualPair(input);
 for(const change of [{strategy:'N1'},{strategy:'toString'},{reason:'short'},{evidence:[]},{evidence:['javascript:alert(1)']},{article_id:''}])assert.throws(()=>validateManualPair({...input,...change}));
});
test('manual construction preserves two independent votes, provenance and atomic rejection',async()=>{
 const pg=new PGlite();
 for(const file of ['0000_black_vargas.sql','0001_identity_subject.sql','0002_manual_hard_negatives.sql'])await pg.exec(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
 const query=async(q:string,v:any[]=[])=>{const r=await pg.query(q,v);return {...r,rowCount:r.affectedRows}};
 const db=createDatabase(()=>({query,connect:async()=>({query,release(){}})}) as QueryPool),stmt=(q:string,...v:any[])=>db.prepare(q).bind(...v);
 try{
  await pg.exec(`INSERT INTO articles(id,publisher,headline,payload,status,event_id) VALUES('a','test','Article A','{}','approved','event-a'),('b','test','Article B','{}','approved','event-b');
   INSERT INTO assets(id,format,ready) VALUES('sa','png',1),('sb','png',1);
   INSERT INTO images(id,article_id,asset_id,payload,decision) VALUES('ia','a','sa','{}','keep'),('ib','b','sb','{}','keep');
   INSERT INTO batches(id,name,created) VALUES('pilot','Pilot','2026-09-03');`);
  for(const [invalidate,restore] of [
   ["UPDATE articles SET event_id='event-a' WHERE id='b'","UPDATE articles SET event_id='event-b' WHERE id='b'"],
   ["UPDATE articles SET event_id=NULL WHERE id='b'","UPDATE articles SET event_id='event-b' WHERE id='b'"],
   ["UPDATE articles SET status='review' WHERE id='b'","UPDATE articles SET status='approved' WHERE id='b'"],
   ["UPDATE assets SET ready=0 WHERE id='sb'","UPDATE assets SET ready=1 WHERE id='sb'"],
   ["UPDATE images SET decision='reject' WHERE id='ib'","UPDATE images SET decision='keep' WHERE id='ib'"],
   ["UPDATE images SET asset_id='sa' WHERE id='ib'","UPDATE images SET asset_id='sb' WHERE id='ib'"],
   ["UPDATE batches SET active=0","UPDATE batches SET active=1"],
  ]){await pg.exec(invalidate);assert.equal(await createManualPair(db,input,'alice'),null,invalidate);await pg.exec(restore)}
  assert.equal(await createManualPair(db,{...input,image_id:'ia'},'alice'),null,'same article rejected');
  for(const table of ['pairs','annotations','manual_pair_proposals','audit'])assert.equal((await stmt(`SELECT COUNT(*) n FROM ${table}`).first()).n,0,'rejected request leaves no partial data');
  // Failure at the final write must roll back the pair, proposal and reserved vote.
  await pg.exec("ALTER TABLE audit ADD CONSTRAINT reject_manual_test CHECK(action!='manual_pair_create')");
  await assert.rejects(createManualPair(db,input,'alice'));
  assert.equal((await stmt('SELECT COUNT(*) n FROM pairs').first()).n,0);
  await pg.exec('ALTER TABLE audit DROP CONSTRAINT reject_manual_test');
  const id=await createManualPair(db,input,'alice');assert.ok(id);
  const p=await stmt('SELECT * FROM pairs WHERE id=?',id).first();assert.equal(p.state,'open');assert.equal(p.final_label,null);
  const own=await stmt('SELECT * FROM annotations WHERE pair_id=?',id).first();assert.equal(own.user_id,'alice');assert.equal(own.slot,1);assert.equal(own.label,null);assert.equal(own.difficulty,null);
  assert.equal(await createManualPair(db,input,'bob'),null,'duplicate cannot overwrite or allocate extra vote');
  assert.equal((await stmt('SELECT COUNT(*) n FROM annotations').first()).n,1);
  assert.equal(await stmt(CLAIM_PAIR,'again','alice','today','alice').first(),null);
  assert.equal((await stmt(CLAIM_PAIR,'second','bob','today','bob').first()).pair_id,id);
  assert.equal(await stmt('SELECT * FROM manual_pair_proposals WHERE pair_id=? AND created_by=?',id,'bob').first(),null,'second annotator cannot retrieve the author hint');
  const proposal=await stmt('SELECT * FROM manual_pair_proposals WHERE pair_id=?',id).first();assert.equal(proposal.strategy,'N5');assert.deepEqual(JSON.parse(proposal.evidence),input.evidence);
  await stmt("UPDATE annotations SET state='submitted',label='out_of_context' WHERE user_id='alice'").run();await stmt(RECONCILE_PAIR,id).run();assert.equal((await stmt('SELECT state FROM pairs WHERE id=?',id).first()).state,'open');
  await stmt("UPDATE annotations SET state='submitted',label='ambiguous' WHERE user_id='bob'").run();await stmt(RECONCILE_PAIR,id).run();assert.equal((await stmt('SELECT state FROM pairs WHERE id=?',id).first()).state,'review');
 }finally{await pg.close()}
});
