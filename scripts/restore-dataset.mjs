import {readFile} from 'node:fs/promises';
import {getDatabase} from '@netlify/database';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

// Opt-in, one-time restore into a new site's empty database during a build.
// The source package stays in a private Blob store, outside Git and public assets.
const expected=process.env.VINEWS_RESTORE_SHA256;
if(!expected){console.log('Dataset restore not requested.');process.exit(0);}
if(!/^[a-f0-9]{64}$/.test(expected))throw Error('Invalid restore digest');
const db=getDatabase(process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:{});
const client=await db.pool.connect();
const order=['members','settings','articles','assets','images','raw_reviews','batches','pairs','annotations','adjudications','audit'];
try{
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(7216632)');
 const prior=await client.query("SELECT value FROM settings WHERE key='dataset_migration_sha256'");
 if(prior.rows.length){
  if(prior.rows[0].value!==expected)throw Error('A different dataset has already been restored');
  console.log('Dataset already restored; keeping current progress.');
 }else{
  const ready=JSON.parse(await readFile('.netlify/migration-restore/ready_5000.json','utf8'));
  if(!ready||ready.destination_site_id!==process.env.SITE_ID||ready.package_sha256!==expected||ready.uploaded_assets!==ready.assets||ready.articles!==5000)throw Error('Image upload has not completed for this site');
  const archive=await readFile('.netlify/migration-restore/restore_5000.json.gz');
  if(createHash('sha256').update(archive).digest('hex')!==expected)throw Error('Restore package checksum mismatch');
  const data=JSON.parse(gunzipSync(archive));
  if(data.version!==1||data.destination_site_id!==process.env.SITE_ID||data.tables.articles.length!==5000||data.tables.assets.length!==ready.assets)throw Error('Wrong dataset or destination');
  if(Object.keys(data.tables).sort().join()!==[...order].sort().join())throw Error('Unexpected tables in restore package');
  for(const table of order){
   const count=await client.query(`SELECT COUNT(*) AS n FROM "${table}"`);
   if(Number(count.rows[0].n)!==0)throw Error('Refusing to overwrite existing data: '+table);
  }
  for(const table of order){
   const rows=data.tables[table];
   for(let start=0;start<rows.length;start+=250){
    await client.query(`INSERT INTO "${table}" SELECT * FROM json_populate_recordset(NULL::"${table}",$1::json)`,[JSON.stringify(rows.slice(start,start+250))]);
   }
   const count=await client.query(`SELECT COUNT(*) AS n FROM "${table}"`);
   if(Number(count.rows[0].n)!==rows.length)throw Error('Restored row count mismatch: '+table);
   console.log('Restored',table,rows.length);
  }
  await client.query("INSERT INTO settings(key,value) VALUES('dataset_migration_sha256',$1)",[expected]);
 }
 await client.query('COMMIT');
}catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
finally{client.release();await db.pool.end();}
