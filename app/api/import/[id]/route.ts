import {importAccess} from '../route';
import {files,one,run,json,fail,assert} from '@/lib/server';
export const dynamic='force-dynamic';
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){try{
 await importAccess(req);const {id}=await params;assert(/^sha256_[a-f0-9]{64}$/.test(id),'Mã ảnh không hợp lệ.');
 const a=await one('SELECT * FROM assets WHERE id=?',id);assert(a,'Nhập metadata trước khi tải ảnh.',404);
 if(a.ready)return json({ok:true,skipped:true});
 assert(Number(req.headers.get('content-length')||0)<=20000000,'Ảnh vượt 20 MB.',413);
 const data=await req.arrayBuffer();assert(data.byteLength>0&&data.byteLength<=20000000,'Kích thước ảnh không hợp lệ.',413);
 const bytes=new Uint8Array(data),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 assert((a.format==='jpeg'&&jpeg)||(a.format==='png'&&png),'Định dạng ảnh không khớp.');
 const hex=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');assert(id===`sha256_${hex}`,'Nội dung ảnh không khớp SHA-256.');
 await files().put(`images/${id}`,data,{httpMetadata:{contentType:a.format==='png'?'image/png':'image/jpeg'}});
 await run('UPDATE assets SET ready=1,bytes=? WHERE id=?',data.byteLength,id);return json({ok:true});
}catch(e){return fail(e)}}
