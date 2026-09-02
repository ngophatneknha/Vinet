import {getStore} from '@netlify/blobs';
export function imageStore(){return getStore({name:'vinews-images',consistency:'strong'})}
export const storage={
 async get(key:string){
  const r=await imageStore().getWithMetadata(key,{type:'stream'});
  if(!r)return null;
  return {body:r.data,httpMetadata:{contentType:typeof r.metadata.contentType==='string'?r.metadata.contentType:'application/octet-stream'}};
 },
 async put(key:string,data:ArrayBuffer,options:{httpMetadata:{contentType:string}}){return imageStore().set(key,data,{metadata:{contentType:options.httpMetadata.contentType}})},
};
