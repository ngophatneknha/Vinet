import {getDatabase} from '@netlify/database';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// The deployment build applies versioned migrations before publishing code.
const db=getDatabase(process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:{});
const client=await db.pool.connect();
try{
 await client.query('BEGIN');
 await client.query("SELECT pg_advisory_xact_lock(7216631)");
 await client.query('CREATE TABLE IF NOT EXISTS vinews_migrations (tag text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
 const journal=JSON.parse(await readFile(new URL('../db/migrations/meta/_journal.json',import.meta.url),'utf8'));
 for(const entry of journal.entries){
  const sql=await readFile(new URL(`../db/migrations/${entry.tag}.sql`,import.meta.url),'utf8');
  const hash=createHash('sha256').update(sql).digest('hex');
  const prior=await client.query('SELECT sha256 FROM vinews_migrations WHERE tag=$1',[entry.tag]);
  if(prior.rows.length){if(prior.rows[0].sha256!==hash)throw Error('Applied migration changed: '+entry.tag);continue}
  for(const query of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await client.query(query);
  await client.query('INSERT INTO vinews_migrations(tag,sha256) VALUES($1,$2)',[entry.tag,hash]);
  console.log('Applied migration:',entry.tag);
 }
 await client.query('COMMIT');
}catch(e){await client.query('ROLLBACK');throw e}
finally{client.release();await db.pool.end()}
