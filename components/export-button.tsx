'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
export default function ExportButton({kind}:{kind:string}){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
 async function download(){setBusy(true);setStatus('');let writer:any;
 try{
  const name=`vinews_${kind}_${new Date().toISOString().slice(0,10)}.jsonl`;
  if('showSaveFilePicker' in window){const file=await (window as any).showSaveFilePicker({suggestedName:name,types:[{description:'JSON Lines',accept:{'application/x-ndjson':['.jsonl']}}]});writer=await file.createWritable()}
  const chunks:BlobPart[]=[];let after='',count=0;
  while(true){
   const response=await fetch(`/api/export?kind=${kind}&after=${encodeURIComponent(after)}`),result=await response.json();
   if(!response.ok)throw Error(result.error||'Không thể xuất dữ liệu.');
   if(!result.rows.length)break;
   const data=result.rows.map((r:any)=>JSON.stringify(r)).join('\n')+'\n';
   if(writer)await writer.write(data);else chunks.push(data);
   count+=result.rows.length;setStatus(`Đã xuất ${count.toLocaleString('vi')} bản ghi…`);
   if(!result.nextCursor)break;after=result.nextCursor;
  }
  if(writer)await writer.close();else{const url=URL.createObjectURL(new Blob(chunks,{type:'application/x-ndjson'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
  setStatus(`Đã xuất ${count.toLocaleString('vi')} bản ghi.`);
 }catch(e:any){await writer?.abort?.().catch(()=>{});setStatus(e.name==='AbortError'?'Đã hủy xuất.':e.message)}finally{setBusy(false)}
 }
 return <><Button onClick={download} disabled={busy}>{busy?'Đang xuất…':'Tải JSONL'}</Button><p className="muted" role="status">{status}</p></>;
}
