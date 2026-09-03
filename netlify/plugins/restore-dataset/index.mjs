import {getStore} from '@netlify/blobs';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Netlify supplies the Blobs context to plugins, not to build.command children.
// Only the dataset is staged locally; no token is written or added to site env.
export async function onPreBuild(){
 const expected=process.env.VINEWS_RESTORE_SHA256;
 if(!expected)return;
 const store=getStore({name:'vinews-migration',consistency:'strong'});
 const ready=await store.get('ready_5000.json',{type:'json'});
 if(!ready||ready.package_sha256!==expected||ready.destination_site_id!==process.env.SITE_ID||ready.uploaded_assets!==ready.assets)throw Error('Restore package not ready for this site');
 const data=await store.get('restore_5000.json.gz',{type:'arrayBuffer'});
 if(!data||createHash('sha256').update(Buffer.from(data)).digest('hex')!==expected)throw Error('Restore package checksum mismatch');
 await mkdir('.netlify/migration-restore',{recursive:true});
 await writeFile('.netlify/migration-restore/ready_5000.json',JSON.stringify(ready));
 await writeFile('.netlify/migration-restore/restore_5000.json.gz',Buffer.from(data));
 console.log('Private dataset fetched for one-time restore.');
}
async function cleanup(){
 await rm('.netlify/migration-restore/ready_5000.json',{force:true});
 await rm('.netlify/migration-restore/restore_5000.json.gz',{force:true});
}
export const onPostBuild=cleanup;
export const onError=cleanup;
