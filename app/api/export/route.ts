import {member,permit,all,json,fail,logStmt} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const m=await member();permit(m,'admin');const kind=new URL(req.url).searchParams.get('kind')||'pairs';
 if(!['pairs','raw','audit'].includes(kind))return json({error:'Loại xuất không hợp lệ'},400);
 await logStmt(m.user_id,'export',kind).run();
 const encoder=new TextEncoder();let after='';
 const stream=new ReadableStream({async pull(controller){try{
  const table=kind==='pairs'?'pairs':kind==='raw'?'articles':'audit';
  const rows=await all(`SELECT * FROM ${table} WHERE id>? ORDER BY id LIMIT 100`,after);
  if(!rows.length){controller.close();return}
  for(const r of rows){
   if(kind==='pairs'){
    r.annotations=(await all('SELECT * FROM annotations WHERE pair_id=?',r.id)).map(a=>({...a,payload:JSON.parse(a.payload)}));
    r.adjudications=(await all("SELECT * FROM adjudications WHERE entity_type='pair' AND entity_id=?",r.id)).map(a=>({...a,payload:JSON.parse(a.payload)}));
    const source=await all('SELECT a.payload,a.event_id,i.payload image_payload FROM articles a JOIN images i ON i.id=? WHERE a.id=?',r.image_id,r.article_id);
    r.context=source.map(a=>({article:JSON.parse(a.payload),image:JSON.parse(a.image_payload),event_id:a.event_id}));
    r.benchmark_eligible=r.state==='approved'&&['matched','out_of_context'].includes(r.final_label);
    r.guideline='V2';r.split=null;r.test_reviewed=false;
   }
   if(kind==='raw'){
    r.payload=JSON.parse(r.payload);r.images=(await all('SELECT * FROM images WHERE article_id=?',r.id)).map(a=>({...a,payload:JSON.parse(a.payload)}));
    r.reviews=(await all('SELECT * FROM raw_reviews WHERE article_id=?',r.id)).map(a=>({...a,payload:JSON.parse(a.payload)}));
    r.adjudications=(await all("SELECT * FROM adjudications WHERE entity_type='raw' AND entity_id=?",r.id)).map(a=>({...a,payload:JSON.parse(a.payload)}));
   }
   controller.enqueue(encoder.encode(JSON.stringify(r)+'\n'));
  }after=rows[rows.length-1].id;
 }catch(e){controller.error(e)}}});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Content-Disposition':`attachment; filename="vinews_${kind}_${new Date().toISOString().slice(0,10)}.jsonl"`,'Cache-Control':'no-store'}});
}catch(e){return fail(e)}}
