import {member,files,one,assert,fail} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){try{
 await member();const {id}=await params;assert(/^sha256_[a-f0-9]{64}$/.test(id),'Mã ảnh không hợp lệ.');
 const a=await one('SELECT ready FROM assets WHERE id=?',id);assert(a?.ready,'Ảnh chưa tải lên.',404);
 const object=await files().get(`images/${id}`);assert(object,'Không tìm thấy ảnh.',404);
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
}catch(e){return fail(e)}}
