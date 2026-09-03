import type {createDatabase} from './database';

import {NEGATIVE_STRATEGIES} from './manual-pair-options';
export function validateManualPair(x:any){
 if(!x||!['article_id','image_id','batch'].every(k=>typeof x[k]==='string'&&x[k].length>0&&x[k].length<=200))throw Error('Chọn bài văn bản, ảnh và đợt gán nhãn.');
 if(!Object.hasOwn(NEGATIVE_STRATEGIES,x.strategy))throw Error('Chọn chiến lược N3–N7.');
 if(typeof x.reason!=='string'||x.reason.trim().length<10||x.reason.length>10000)throw Error('Nêu điểm giống và điểm khác từ 10 đến 10.000 ký tự.');
 if(!Array.isArray(x.evidence)||!x.evidence.length||x.evidence.length>20||x.evidence.some((u:any)=>typeof u!=='string'||u.length>2000||!/^https?:\/\/\S+$/i.test(u)))throw Error('Thêm ít nhất một URL bằng chứng http/https hợp lệ.');
}

// The proposal stays separate from pairs so independent readers never receive its hint.
export async function createManualPair(db:ReturnType<typeof createDatabase>,x:any,user:string){
 validateManualPair(x);
 const id=crypto.randomUUID(),time=new Date().toISOString(),stmt=(q:string,...v:any[])=>db.prepare(q).bind(...v);
 const result=await db.batch([
  stmt('SELECT id FROM articles WHERE id=? OR id=(SELECT article_id FROM images WHERE id=?) ORDER BY id FOR UPDATE',x.article_id,x.image_id),
  stmt('SELECT id FROM images WHERE id=? FOR UPDATE',x.image_id),
  stmt('SELECT id FROM assets WHERE id=(SELECT asset_id FROM images WHERE id=?) FOR UPDATE',x.image_id),
  stmt('SELECT id FROM batches WHERE id=? FOR UPDATE',x.batch),
  stmt(`INSERT INTO pairs(id,article_id,image_id,batch_id,created)
   SELECT ?,a.id,i.id,b.id,? FROM articles a JOIN images i ON i.id=? JOIN articles source ON source.id=i.article_id JOIN assets s ON s.id=i.asset_id JOIN batches b ON b.id=?
   WHERE a.id=? AND a.status='approved' AND source.status='approved' AND i.decision='keep' AND s.ready=1 AND b.active=1
   AND a.id!=source.id AND NULLIF(TRIM(a.event_id),'') IS NOT NULL AND NULLIF(TRIM(source.event_id),'') IS NOT NULL AND a.event_id!=source.event_id
   AND NOT EXISTS(SELECT 1 FROM images same WHERE same.article_id=a.id AND same.asset_id=i.asset_id)
   ON CONFLICT(article_id,image_id) DO NOTHING`,id,time,x.image_id,x.batch,x.article_id),
  stmt('INSERT INTO manual_pair_proposals(pair_id,created_by,strategy,reason,evidence,created) SELECT id,?,?,?,?,? FROM pairs WHERE id=?',user,x.strategy,x.reason.trim(),JSON.stringify(x.evidence),time,id),
  stmt("INSERT INTO annotations(id,pair_id,user_id,slot,state,payload,updated) SELECT ?,id,?,1,'draft','{}',? FROM pairs WHERE id=?",crypto.randomUUID(),user,time,id),
  stmt("INSERT INTO audit(id,user_id,action,entity_id,payload,created) SELECT ?,?,'manual_pair_create',id,?,? FROM pairs WHERE id=?",crypto.randomUUID(),user,JSON.stringify({strategy:x.strategy}),time,id),
 ]);
 return result[4].meta.changes?id:null;
}
