import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createDatabase,type QueryPool} from '../lib/database';
import {bindMemberIdentity} from '../lib/member-identity';

test('migrated login keeps review ownership and rejects a different subject',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(await readFile(new URL('../db/migrations/0000_black_vargas.sql',import.meta.url),'utf8'));
  await pg.exec("INSERT INTO members VALUES('existing@example.test','existing-id','Existing','admin',1,'2026-09-03')");
  await pg.exec(await readFile(new URL('../db/migrations/0001_identity_subject.sql',import.meta.url),'utf8'));
  const query=async(q:string,v:any[]=[])=>{const r=await pg.query(q,v);return {...r,rowCount:r.affectedRows}};
  const db=createDatabase(()=>({query,connect:async()=>({query,release(){}})}) as QueryPool);
  assert.equal((await bindMemberIdentity(db,'existing@example.test','existing-id'))?.user_id,'existing-id');
  assert.equal(await bindMemberIdentity(db,'existing@example.test','impostor'),null);
  await pg.exec("INSERT INTO members(email,user_id,name,role,active,created) VALUES('moved@example.test','legacy-id','Moved','annotator',1,'2026-09-03')");
  await pg.exec("INSERT INTO articles(id,publisher,headline,payload,lease_user) VALUES('article','test','Test','{}','legacy-id'); INSERT INTO raw_reviews VALUES('review','article','legacy-id','draft',NULL,'{}','2026-09-03')");
  assert.equal((await bindMemberIdentity(db,'moved@example.test','new-subject'))?.user_id,'legacy-id');
  assert.equal((await pg.query<{user_id:string}>('SELECT user_id FROM raw_reviews')).rows[0].user_id,'legacy-id');
  assert.equal(await bindMemberIdentity(db,'moved@example.test','other-subject'),null);
  await pg.exec("UPDATE members SET active=0 WHERE email='moved@example.test'");
  assert.equal(await bindMemberIdentity(db,'moved@example.test','new-subject'),null);
  assert.equal(await bindMemberIdentity(db,'unlisted@example.test','new-person'),null);
 }finally{await pg.close()}
});
