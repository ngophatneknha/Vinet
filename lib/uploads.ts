import {createHash} from 'node:crypto';
export const CHUNK_BYTES=4_000_000;
export const MAX_IMAGE_BYTES=20_000_000;
export function verifyImage(data:ArrayBuffer,id:string,format:string){
 if(data.byteLength===0||data.byteLength>MAX_IMAGE_BYTES)throw Error('Kích thước ảnh không hợp lệ.');
 const b=new Uint8Array(data),jpeg=b[0]===255&&b[1]===216&&b[2]===255,png=[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);
 if(!((format==='jpeg'&&jpeg)||(format==='png'&&png)))throw Error('Định dạng ảnh không khớp.');
 if(id!=='sha256_'+createHash('sha256').update(b).digest('hex'))throw Error('Nội dung ảnh không khớp SHA-256.');
}
