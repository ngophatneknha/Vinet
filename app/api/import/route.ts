import {db,stmt,one,all,member,permit,json,fail,body,assert,config,logStmt} from '@/lib/server';
import inventoryFlags from '@/lib/inventory-flags.json';
export const dynamic='force-dynamic';
async function access(req:Request){
 const expected=config().IMPORT_TOKEN,received=req.headers.get('authorization')?.replace(/^Bearer /,'');
 if(expected&&received){
  const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const a=await hash(expected),b=await hash(received);let delta=0;for(let i=0;i<a.length;i++)delta|=a[i]^b[i];assert(delta===0,'Khóa nhập dữ liệu không hợp lệ.',403);return 'importer';
 }
 const m=await member();permit(m,'admin');return m.user_id;
}
export {access as importAccess};
export async function GET(req:Request){try{await access(req);const u=new URL(req.url),after=u.searchParams.get('after')||'';return json(await all('SELECT id,format FROM assets WHERE ready=0 AND id>? ORDER BY id LIMIT 500',after))}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 const user=await access(req),x=await body(req);
 assert(Array.isArray(x.articles)&&x.articles.length>0&&x.articles.length<=25,'Nhập 1–25 bài mỗi yêu cầu.');
 let count=0;
 for(const a of x.articles){
  assert(typeof a.article_id==='string'&&a.article_id.length<150&&a.publisher&&a.headline&&a.article_url&&a.publish_date&&a.collection_timestamp,'Thiếu trường bắt buộc của bài.');
  assert(Array.isArray(a.images)&&a.images.length>0&&a.images.length<=200,'Bài cần từ 1 đến 200 ảnh.');
  const old=await one('SELECT id,status FROM articles WHERE id=?',a.article_id);if(old&&!x.repair)continue;
  if(old){
   const m=await member();permit(m,'admin');
   assert(['pending','review'].includes(old.status),'Chỉ bổ sung ảnh cho bài chưa giao hoặc đang chờ kiểm định.');
  }
  const {images,...payload}=a;
  const inventory=(inventoryFlags as Record<string,unknown>)[a.article_id];
  if(inventory){payload.inventory_audit=inventory;payload.inventory_incomplete=true;}
  const qs=old?[]:[stmt('INSERT INTO articles(id,publisher,headline,topic,date,payload,inventory_flag) VALUES(?,?,?,?,?,?,?)',a.article_id,a.publisher,a.headline,a.category_normalized||a.category||null,a.publish_date,JSON.stringify(payload),inventory||a.inventory_incomplete?1:0)];
  for(const i of images){
   assert(typeof i.image_id==='string'&&/^sha256_[a-f0-9]{64}$/.test(i.asset_id)&&['jpeg','jpg','png'].includes(String(i.format).toLowerCase())&&i.width>0&&i.height>0&&typeof i.is_lead_image==='boolean'&&i.image_url,'Metadata ảnh không hợp lệ.');
   if(old){const existing=await one('SELECT article_id,asset_id FROM images WHERE id=?',i.image_id);if(existing){assert(existing.article_id===a.article_id&&existing.asset_id===i.asset_id,'Ảnh đã có thuộc bài khác hoặc đã thay đổi.');continue}}
   qs.push(stmt('INSERT INTO assets(id,format) VALUES(?,?) ON CONFLICT(id) DO NOTHING',i.asset_id,i.format==='jpg'?'jpeg':i.format));
   qs.push(stmt('INSERT INTO images(id,article_id,asset_id,payload) VALUES(?,?,?,?)',i.image_id,a.article_id,i.asset_id,JSON.stringify(i)));
  }
  if(qs.length)await db().batch([...qs,logStmt(user,old?'inventory_append':'article_import',a.article_id)]);count++;
 }
 await logStmt(user,'metadata_import','dataset',{created:count}).run();return json({created:count});
}catch(e){return fail(e)}}
