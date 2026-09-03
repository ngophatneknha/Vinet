import {importAccess} from '../route';
import {imageStore} from '@/lib/storage';
import {one,run,files,json,fail,assert,body,AppError,logStmt} from '@/lib/server';
import {CHUNK_BYTES,MAX_IMAGE_BYTES,verifyImage} from '@/lib/uploads';
export const dynamic='force-dynamic';

// Finalize already-staged private chunks in small batches, without re-uploading
// image bytes through the website. The same SHA-256 check gates readiness.
export async function POST(req:Request){try{
 const user=await importAccess(req),x=await body(req);
 assert(Array.isArray(x.assets)&&x.assets.length>0&&x.assets.length<=20,'Hoàn tất 1–20 ảnh mỗi yêu cầu.');
 for(const item of x.assets){assert(/^sha256_[a-f0-9]{64}$/.test(item.id),'Mã ảnh không hợp lệ.');assert(Number.isInteger(item.size)&&item.size>0&&item.size<=MAX_IMAGE_BYTES,'Kích thước ảnh không hợp lệ.')}
 const results=[];
 for(const item of x.assets){try{
  const a=await one('SELECT * FROM assets WHERE id=?',item.id);assert(a,'Nhập metadata trước khi tải ảnh.',404);
  if(a.ready){results.push({id:a.id,ok:true,skipped:true});continue}
  const combined=new Uint8Array(item.size),parts=Math.ceil(item.size/CHUNK_BYTES);
  for(let part=0;part<parts;part++){
   const data=await imageStore().get(`chunks/${a.id}/${part}`,{type:'arrayBuffer'});
   assert(data&&data.byteLength===Math.min(CHUNK_BYTES,item.size-part*CHUNK_BYTES),'Chưa tải đủ các phần ảnh.',409);
   combined.set(new Uint8Array(data),part*CHUNK_BYTES);
  }
  try{verifyImage(combined.buffer,a.id,a.format)}catch(e:any){throw new AppError(400,e.message)}
  await files().put(`images/${a.id}`,combined.buffer,{httpMetadata:{contentType:a.format==='png'?'image/png':'image/jpeg'}});
  await run('UPDATE assets SET ready=1,bytes=? WHERE id=?',item.size,a.id);
  await Promise.all(Array.from({length:parts},(_,part)=>imageStore().delete(`chunks/${a.id}/${part}`))).catch(()=>{});
  results.push({id:a.id,ok:true});
 }catch(e:any){results.push({id:item.id,ok:false,status:e instanceof AppError?e.status:500})}}
 await logStmt(user,'image_batch_finalize','raw25000',{completed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length}).run();
 return json({results});
}catch(e){return fail(e)}}
