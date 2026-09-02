import {importAccess} from '../route';
import {imageStore} from '@/lib/storage';
import {files,one,run,json,fail,assert,body,AppError} from '@/lib/server';
import {CHUNK_BYTES,MAX_IMAGE_BYTES,verifyImage} from '@/lib/uploads';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
async function asset(req:Request,c:Context){await importAccess(req);const {id}=await c.params;assert(/^sha256_[a-f0-9]{64}$/.test(id),'Mã ảnh không hợp lệ.');const a=await one('SELECT * FROM assets WHERE id=?',id);assert(a,'Nhập metadata trước khi tải ảnh.',404);return a}
async function save(a:any,data:ArrayBuffer){
 try{verifyImage(data,a.id,a.format)}catch(e:any){throw new AppError(400,e.message)}
 await files().put(`images/${a.id}`,data,{httpMetadata:{contentType:a.format==='png'?'image/png':'image/jpeg'}});
 await run('UPDATE assets SET ready=1,bytes=? WHERE id=?',data.byteLength,a.id);
}
export async function PUT(req:Request,c:Context){try{
 const a=await asset(req,c);if(a.ready)return json({ok:true,skipped:true});
 const data=await req.arrayBuffer();assert(data.byteLength>0&&data.byteLength<=CHUNK_BYTES,'Mỗi phần tải lên tối đa 4 MB.',413);
 const rawPart=new URL(req.url).searchParams.get('part');
 if(rawPart===null){await save(a,data);return json({ok:true})}
 const part=Number(rawPart);assert(Number.isInteger(part)&&part>=0&&part<5,'Chỉ số phần tải không hợp lệ.');
 await imageStore().set(`chunks/${a.id}/${part}`,data);
 return json({ok:true,part});
}catch(e){return fail(e)}}
export async function POST(req:Request,c:Context){try{
 const a=await asset(req,c);if(a.ready)return json({ok:true,skipped:true});const x=await body(req);
 assert(Number.isInteger(x.size)&&x.size>0&&x.size<=MAX_IMAGE_BYTES,'Kích thước ảnh không hợp lệ.');
 assert(x.parts===Math.ceil(x.size/CHUNK_BYTES),'Số phần tải không hợp lệ.');
 const combined=new Uint8Array(x.size);
 for(let part=0;part<x.parts;part++){
  const data=await imageStore().get(`chunks/${a.id}/${part}`,{type:'arrayBuffer'});
  assert(data&&data.byteLength===Math.min(CHUNK_BYTES,x.size-part*CHUNK_BYTES),'Chưa tải đủ các phần ảnh.',409);
  combined.set(new Uint8Array(data),part*CHUNK_BYTES);
 }
 await save(a,combined.buffer);
 await Promise.all(Array.from({length:x.parts},(_,part)=>imageStore().delete(`chunks/${a.id}/${part}`))).catch(()=>{});
 return json({ok:true});
}catch(e){return fail(e)}}
