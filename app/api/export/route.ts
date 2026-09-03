import {member,permit,all,json,fail,logStmt} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const m=await member();permit(m,'admin');const url=new URL(req.url),kind=url.searchParams.get('kind')||'pairs',after=url.searchParams.get('after')||'';
 if(!['pairs','raw','audit'].includes(kind))return json({error:'Loại xuất không hợp lệ'},400);
 if(!after)await logStmt(m.user_id,'export',kind).run();
 const exported:any[]=[];let bytes=0;
  const table=kind==='pairs'?'pairs':kind==='raw'?'articles':'audit';
  const rows=await all(`SELECT * FROM ${table} WHERE id>? ORDER BY id LIMIT 25`,after);
  if(!rows.length)return json({rows:[],nextCursor:null});
  for(const r of rows){
   if(kind==='pairs'){
    const proposal=await all('SELECT * FROM manual_pair_proposals WHERE pair_id=?',r.id);
    r.construction=proposal.length?{kind:'manual_hard_negative_candidate',...proposal[0],evidence:JSON.parse(proposal[0].evidence)}:null;
    r.annotations=(await all('SELECT * FROM annotations WHERE pair_id=?',r.id)).map(a=>({...a,payload:JSON.parse(a.payload)}));
    r.adjudications=(await all("SELECT * FROM adjudications WHERE entity_type='pair' AND entity_id=?",r.id)).map(a=>({...a,payload:JSON.parse(a.payload)}));
    const source=await all('SELECT a.payload,a.event_id,i.payload image_payload FROM articles a JOIN images i ON i.id=? WHERE a.id=?',r.image_id,r.article_id);
    r.context=source.map(a=>({article:JSON.parse(a.payload),image:JSON.parse(a.image_payload),event_id:a.event_id}));
    r.image_source=(await all('SELECT a.id,a.event_id,a.payload FROM articles a JOIN images i ON i.article_id=a.id WHERE i.id=?',r.image_id)).map(a=>({article_id:a.id,event_id:a.event_id,article:JSON.parse(a.payload)}));
    r.benchmark_eligible=r.state==='approved'&&['matched','out_of_context'].includes(r.final_label);
    r.guideline='V2';r.split=null;r.test_reviewed=false;
   }
   if(kind==='raw'){
    r.payload=JSON.parse(r.payload);r.images=(await all('SELECT * FROM images WHERE article_id=?',r.id)).map(a=>({...a,payload:JSON.parse(a.payload)}));
    r.reviews=(await all('SELECT * FROM raw_reviews WHERE article_id=?',r.id)).map(a=>({...a,payload:JSON.parse(a.payload)}));
    r.adjudications=(await all("SELECT * FROM adjudications WHERE entity_type='raw' AND entity_id=?",r.id)).map(a=>({...a,payload:JSON.parse(a.payload)}));
   }
   const size=new TextEncoder().encode(JSON.stringify(r)).length;
   if(exported.length&&bytes+size>2000000)break;
   bytes+=size;exported.push(r);
  }
 return json({rows:exported,nextCursor:exported.length?exported[exported.length-1].id:null});
}catch(e){return fail(e)}}
