import {getChatGPTUser} from '@/app/chatgpt-auth';
import {agreement,validateAnnotation,LABELS,RAW_LABELS} from '@/lib/rules';
import {db,stmt,one,all,run,now,uid,member,permit,json,fail,body,assert,AppError,logStmt,article,pairView,config,ensureOwner} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const url=new URL(req.url),action=url.searchParams.get('action')||'stats';
 if(action==='session'){
  const u=await getChatGPTUser();if(!u)return json({user:null});await ensureOwner(u);
  const m=await one('SELECT email,name,role,active FROM members WHERE email=?',u.email.toLowerCase());
  const setup=!(await one("SELECT key FROM settings WHERE key='setup_consumed'"));
  return json({user:u,member:m?.active?m:null,setup});
 }
 const m=await member();
 if(action==='stats'){
  const groups=await all('SELECT status,COUNT(*) n FROM articles GROUP BY status');
  const sources=await all('SELECT publisher,COUNT(*) n,SUM(status=\'approved\') done FROM articles GROUP BY publisher ORDER BY n DESC');
  const counts=await one('SELECT COUNT(*) n,SUM(ready) ready FROM assets');
  const ps=await all('SELECT state,COUNT(*) n FROM pairs GROUP BY state');
  const quality=agreement(await all("SELECT a.label a,b.label b FROM annotations a JOIN annotations b ON a.pair_id=b.pair_id AND a.slot=1 AND b.slot=2 WHERE a.state='submitted' AND b.state='submitted'"));
  const mine=await one("SELECT COUNT(*) n,SUM(state='submitted') done FROM annotations WHERE user_id=? AND state!='released'",m.user_id);
  return json({groups,sources,assets:counts,pairs:ps,quality,mine,inventory:await one('SELECT COUNT(*) n FROM articles WHERE inventory_flag=1'),batches:await all('SELECT * FROM batches ORDER BY created DESC')});
 }
 if(action==='articles'){
  permit(m,'admin','reviewer');const page=Math.max(0,Number(url.searchParams.get('page'))||0),q=(url.searchParams.get('q')||'').slice(0,200),status=url.searchParams.get('status')||'';
  return json(await all('SELECT id,publisher,headline,status,event_id,inventory_flag,lease_user FROM articles WHERE (headline LIKE ? OR id=?) AND (?=\'\' OR status=?) ORDER BY id LIMIT 50 OFFSET ?',`%${q}%`,q,status,status,page*50));
 }
 if(action==='article'){
  const id=url.searchParams.get('id')||'',a=await article(id);
  assert(['admin','reviewer'].includes(m.role)||a.lease_user===m.user_id,'Bài chưa được giao cho bạn.',403);
  const reviews=await all('SELECT * FROM raw_reviews WHERE article_id=? AND (user_id=? OR ?=1)',id,m.user_id,['admin','reviewer'].includes(m.role)&&a.status!=='in_progress'?1:0);
  return json({...a,reviews:reviews.map(r=>({...r,payload:JSON.parse(r.payload)}))});
 }
 if(action==='pair')return json(await pairView(url.searchParams.get('id')||'',m));
 if(action==='queue'){
  permit(m,'admin','reviewer');return json({raw:await all("SELECT id,headline,publisher FROM articles a WHERE status='review' AND NOT EXISTS(SELECT 1 FROM raw_reviews r WHERE r.article_id=a.id AND r.user_id=? AND r.state='submitted') LIMIT 100",m.user_id),pairs:await all("SELECT p.id,a.headline FROM pairs p JOIN articles a ON a.id=p.article_id WHERE p.state='review' AND NOT EXISTS(SELECT 1 FROM annotations n WHERE n.pair_id=p.id AND n.user_id=? AND n.state='submitted') LIMIT 100",m.user_id)});
 }
 if(action==='members'){permit(m,'admin');return json(await all("SELECT m.*, (SELECT COUNT(*) FROM raw_reviews r WHERE r.user_id=m.user_id AND r.state='submitted') raw_done, (SELECT COUNT(*) FROM annotations a WHERE a.user_id=m.user_id AND a.state='submitted') pair_done FROM members m ORDER BY created"))}
 if(action==='audit'){permit(m,'admin');return json(await all('SELECT * FROM audit ORDER BY created DESC LIMIT 100'))}
 if(action==='assignments'){permit(m,'admin');return json({raw:await all("SELECT a.id,a.headline,m.email FROM articles a LEFT JOIN members m ON m.user_id=a.lease_user WHERE a.status='in_progress' LIMIT 200"),pairs:await all("SELECT a.id,a.pair_id,m.email FROM annotations a LEFT JOIN members m ON m.user_id=a.user_id WHERE a.state='draft' LIMIT 200")})}
 throw new AppError(404,'Không có thao tác này.');
}catch(e){return fail(e)}}

function rawValidate(a:any,x:any){
 assert(Object.hasOwn(RAW_LABELS,x.decision),'Chọn kết luận cho bài.');
 assert(typeof x.reason==='string'&&x.reason.length<=10000,'Lý do không hợp lệ.');
 assert(Array.isArray(x.images)&&x.images.length===a.images.length,'Duyệt tất cả ảnh trong bài.');
 const ids=new Set(x.images.map((i:any)=>i.id));assert(ids.size===a.images.length&&a.images.every((i:any)=>ids.has(i.id)),'Danh sách ảnh không khớp.');
 for(const i of x.images){assert(['keep','reject','review'].includes(i.decision),'Mỗi ảnh cần có quyết định.');assert(typeof i.caption==='string'&&i.caption.length<=10000,'Caption không hợp lệ.');assert(['news','illustration','archive','graphic','other'].includes(i.type),'Chọn loại ảnh.');assert(typeof i.reason==='string'&&(i.decision==='keep'||i.reason.trim().length>=5),'Ảnh bị loại/cần xem lại phải có lý do.');}
 assert(x.decision==='approved'||x.reason.trim().length>=10,'Ghi lý do loại hoặc cần kiểm tra.');
 if(x.decision==='approved'){
  assert(!a.inventory_flag,'Bài đang thiếu kho ảnh; chuyển kiểm định để bổ sung trước khi duyệt.');
  assert(x.images.some((i:any)=>i.decision==='keep')&&!x.images.some((i:any)=>i.decision==='review'),'Bài đạt cần ít nhất một ảnh giữ và không có ảnh chưa rõ.');
 }
}
export async function POST(req:Request){try{
 const x=await body(req),action=x.action;
 if(action==='setup'){
  const u=await getChatGPTUser();assert(u,'Đăng nhập trước khi kích hoạt.',401);
  assert(config().SETUP_CODE&&x.code===config().SETUP_CODE,'Mã kích hoạt không hợp lệ.',403);
  assert(!(await one("SELECT key FROM settings WHERE key='setup_consumed'")),'Đã có quản trị viên.',409);
  await db().batch([stmt("INSERT INTO members(email,user_id,name,role,active,created) SELECT ?,?,?,'admin',1,? WHERE NOT EXISTS(SELECT 1 FROM settings WHERE key='setup_consumed')",u.email.toLowerCase(),u.userId,u.fullName||u.email,now()),stmt("INSERT INTO settings VALUES ('setup_consumed',?)",now()),logStmt(u.userId,'bootstrap','owner')]);
  return json({ok:true});
 }
 const m=await member();
 if(action==='raw_claim'){
  let a=await one("SELECT id FROM articles WHERE lease_user=? AND status='in_progress' LIMIT 1",m.user_id);
  if(!a)a=await stmt("UPDATE articles SET status='in_progress',lease_user=? WHERE id=(SELECT a.id FROM articles a WHERE status='pending' AND EXISTS(SELECT 1 FROM images WHERE article_id=a.id) AND NOT EXISTS(SELECT 1 FROM images i JOIN assets s ON s.id=i.asset_id WHERE i.article_id=a.id AND s.ready=0) ORDER BY inventory_flag,id LIMIT 1) AND status='pending' RETURNING id",m.user_id).first();
  if(a)await logStmt(m.user_id,'raw_claim',a.id).run();return json(a?await article(a.id):null);
 }
 if(action==='raw_save'||action==='raw_submit'){
  const a=await article(x.id);assert(a.status==='in_progress'&&a.lease_user===m.user_id,'Nhiệm vụ đã thay đổi hoặc chưa được giao cho bạn.',409);
  assert(a.images.every((i:any)=>i.ready),'Chưa có đủ ảnh trong kho dùng chung.',409);
  if(action==='raw_submit')rawValidate(a,x.review);
  const state=action==='raw_submit'?'submitted':'draft',p=JSON.stringify(x.review);assert(p.length<500000,'Nội dung quá lớn.');
  const guard="EXISTS(SELECT 1 FROM articles WHERE id=? AND status='in_progress' AND lease_user=?)";
  const qs=[stmt(`INSERT INTO raw_reviews(id,article_id,user_id,state,decision,payload,updated) SELECT ?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT(article_id,user_id) DO UPDATE SET state=excluded.state,decision=excluded.decision,payload=excluded.payload,updated=excluded.updated WHERE raw_reviews.state='draft'`,uid(),a.id,m.user_id,state,x.review.decision||null,p,now(),a.id,m.user_id)];
  if(state==='submitted'){
   for(const i of x.review.images)qs.push(stmt(`UPDATE images SET decision=? WHERE id=? AND article_id=? AND ${guard}`,i.decision,i.id,a.id,a.id,m.user_id));
   qs.push(stmt("UPDATE articles SET status=?,lease_user=NULL WHERE id=? AND status='in_progress' AND lease_user=?",x.review.decision,a.id,m.user_id));
  }
  qs.push(logStmt(m.user_id,action,a.id,{decision:x.review.decision}));const results=await db().batch(qs);assert(results[0].meta.changes,'Bản này đã gửi; không thể ghi đè.',409);return json({ok:true});
 }
 if(action==='pair_claim'){
  let own=await one("SELECT pair_id FROM annotations WHERE user_id=? AND state='draft' ORDER BY updated LIMIT 1",m.user_id);
  if(!own){for(let i=0;i<3;i++){
   try{own=await stmt("INSERT INTO annotations(id,pair_id,user_id,slot,state,payload,updated) SELECT ?,p.id,?,s.slot,'draft','{}',? FROM pairs p JOIN batches b ON b.id=p.batch_id CROSS JOIN (SELECT 1 slot UNION ALL SELECT 2) s WHERE p.state='open' AND b.active=1 AND NOT EXISTS(SELECT 1 FROM annotations a WHERE a.pair_id=p.id AND a.state!='released' AND (a.slot=s.slot OR a.user_id=?)) ORDER BY p.created,p.id,s.slot LIMIT 1 RETURNING pair_id",uid(),m.user_id,now(),m.user_id).first();break}catch(e){if(i===2)throw e}
  }}
  if(own)await logStmt(m.user_id,'pair_claim',own.pair_id).run();return json(own?await pairView(own.pair_id,m):null);
 }
 if(action==='pair_save'||action==='pair_submit'){
  const own=await one("SELECT * FROM annotations WHERE pair_id=? AND user_id=? AND state='draft'",x.id,m.user_id);assert(own,'Không có bản nháp được giao.',409);
  let difficulty=null;if(action==='pair_submit'){try{difficulty=validateAnnotation(x.review).difficulty}catch(e:any){throw new AppError(400,e.message)}}
  const state=action==='pair_submit'?'submitted':'draft',p=JSON.stringify(x.review);assert(p.length<100000,'Nội dung quá lớn.');
  const results=await db().batch([
   stmt("UPDATE annotations SET state=?,payload=?,label=?,difficulty=?,updated=? WHERE id=? AND state='draft'",state,p,x.review.label||null,difficulty,now(),own.id),
   stmt("UPDATE pairs SET state=CASE WHEN (SELECT COUNT(*) FROM annotations WHERE pair_id=pairs.id AND state='submitted')<2 THEN 'open' WHEN (SELECT COUNT(DISTINCT label) FROM annotations WHERE pair_id=pairs.id AND state='submitted')=1 AND (SELECT label FROM annotations WHERE pair_id=pairs.id AND state='submitted' LIMIT 1) IN ('matched','out_of_context') THEN 'approved' ELSE 'review' END,final_label=CASE WHEN (SELECT COUNT(*) FROM annotations WHERE pair_id=pairs.id AND state='submitted')=2 AND (SELECT COUNT(DISTINCT label) FROM annotations WHERE pair_id=pairs.id AND state='submitted')=1 AND (SELECT label FROM annotations WHERE pair_id=pairs.id AND state='submitted' LIMIT 1) IN ('matched','out_of_context') THEN (SELECT label FROM annotations WHERE pair_id=pairs.id AND state='submitted' LIMIT 1) ELSE NULL END WHERE id=? AND state='open'",x.id),logStmt(m.user_id,action,x.id)]);
  assert(results[0].meta.changes,'Bản này đã gửi hoặc đã thu hồi.',409);return json({ok:true});
 }
 if(action==='adjudicate'){
  permit(m,'admin','reviewer');assert(['raw','pair'].includes(x.kind),'Loại kiểm định không hợp lệ.');assert(typeof x.reason==='string'&&x.reason.trim().length>=10&&x.reason.length<10000,'Ghi lý do kiểm định từ 10 ký tự.');
  const qs=[];
  if(x.kind==='pair'){
   const p=await pairView(x.id,m);assert(p.state==='review'&&!p.own,'Người kiểm định phải là người thứ ba và cặp đang chờ kiểm định.',409);
   assert(p.reviews.length===2,'Chưa đủ hai lượt gán nhãn.');assert(Object.hasOwn(LABELS,x.decision),'Nhãn không hợp lệ.');
   qs.push(stmt("UPDATE pairs SET state='approved',final_label=? WHERE id=? AND state='review'",x.decision,x.id));
  }else{
   const a=await article(x.id);assert(a.status==='review','Bài không trong hàng đợi kiểm định.',409);
   assert(!(await one("SELECT id FROM raw_reviews WHERE article_id=? AND user_id=? AND state='submitted'",x.id,m.user_id)),'Cần người kiểm định khác người duyệt ban đầu.',403);
   assert(['approved','rejected'].includes(x.decision),'Kiểm định kết thúc bằng Đạt hoặc Không đạt.');
   assert(a.images.every((i:any)=>i.ready),'Ảnh chưa tải đủ.');
   if(a.inventory_flag&&x.inventoryResolved){
    const audit=a.payload.inventory_audit;
    assert(audit&&a.images.length>=audit.retained_images+audit.other_original_images_confirmed_in_live_page,'Chưa bổ sung đủ số ảnh đã được phát hiện trong lần rà soát.');
   }
   rawValidate({...a,inventory_flag:x.inventoryResolved?0:a.inventory_flag},x.review);
   assert(x.decision===x.review.decision,'Kết luận không nhất quán.');
   for(const i of x.review.images)qs.push(stmt('UPDATE images SET decision=? WHERE id=? AND article_id=?',i.decision,i.id,x.id));
   qs.push(stmt("UPDATE articles SET status=?,inventory_flag=CASE WHEN ?=1 THEN 0 ELSE inventory_flag END WHERE id=? AND status='review'",x.decision,x.inventoryResolved?1:0,x.id));
  }
  qs.unshift(stmt('INSERT INTO adjudications(id,entity_type,entity_id,user_id,decision,reason,payload,created) VALUES (?,?,?,?,?,?,?,?)',uid(),x.kind,x.id,m.user_id,x.decision,x.reason,JSON.stringify(x.review||{}),now()));
  qs.push(logStmt(m.user_id,'adjudicate_'+x.kind,x.id,{decision:x.decision,reason:x.reason,inventoryResolved:!!x.inventoryResolved}));await db().batch(qs);return json({ok:true});
 }
 permit(m,'admin');
 if(action==='member'){
  const email=String(x.email||'').trim().toLowerCase();assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Email không hợp lệ.');assert(['admin','reviewer','annotator'].includes(x.role),'Vai trò không hợp lệ.');assert(typeof x.name==='string'&&x.name.length>0&&x.name.length<=100,'Nhập tên.');assert(email!==m.email||x.active&&x.role==='admin','Không thể tự thu hồi quyền quản trị của mình.');
  await db().batch([stmt('INSERT INTO members(email,name,role,active,created) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,active=excluded.active',email,x.name,x.role,x.active?1:0,now()),logStmt(m.user_id,'member_update',email,{role:x.role,active:!!x.active})]);return json({ok:true});
 }
 if(action==='batch'){
  assert(typeof x.name==='string'&&x.name.length>0&&x.name.length<100,'Nhập tên đợt.');assert(['pilot','main'].includes(x.kind),'Loại đợt không hợp lệ.');const id=x.id||uid();
  await db().batch([stmt("INSERT INTO batches(id,name,guideline,kind,active,created) VALUES(?,?,'V2',?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,active=excluded.active",id,x.name,x.kind,x.active?1:0,now()),logStmt(m.user_id,'batch_update',id)]);return json({id});
 }
 if(action==='event'){
  assert(typeof x.event==='string'&&x.event.trim().length>=3&&x.event.length<=200,'Nhập mã sự kiện có ít nhất 3 ký tự.');
  assert(!(await one('SELECT p.id FROM pairs p LEFT JOIN images i ON i.id=p.image_id WHERE p.article_id=? OR i.article_id=? LIMIT 1',x.id,x.id)),'Bài đã có cặp: không sửa sự kiện để tránh thay đổi bằng chứng.',409);
  const result=await db().batch([stmt("UPDATE articles SET event_id=? WHERE id=? AND status='approved' AND NOT EXISTS(SELECT 1 FROM pairs p LEFT JOIN images i ON i.id=p.image_id WHERE p.article_id=articles.id OR i.article_id=articles.id)",x.event.trim(),x.id),logStmt(m.user_id,'event_set',x.id,{event:x.event})]);assert(result[0].meta.changes,'Bài chưa được duyệt hoặc đã có cặp.',409);return json({ok:true});
 }
 if(action==='create_pairs'){
  assert(Array.isArray(x.rows)&&x.rows.length>0&&x.rows.length<=100,'Nhập từ 1 đến 100 cặp một lần.');const batch=await one('SELECT id FROM batches WHERE id=?',x.batch);assert(batch,'Chọn đợt hợp lệ.');
  const qs=[];for(const r of x.rows){const a=await one('SELECT status,event_id FROM articles WHERE id=?',r.article_id),i=await one('SELECT i.decision,a.status,a.event_id,s.ready FROM images i JOIN articles a ON a.id=i.article_id JOIN assets s ON s.id=i.asset_id WHERE i.id=?',r.image_id);assert(a?.status==='approved'&&a.event_id&&i?.decision==='keep'&&i.status==='approved'&&i.event_id&&i.ready,'Cả bài và ảnh phải được duyệt, có mã sự kiện và ảnh đã tải đủ.');qs.push(stmt('INSERT INTO pairs(id,article_id,image_id,batch_id,created) VALUES(?,?,?,?,?) ON CONFLICT(article_id,image_id) DO NOTHING',uid(),r.article_id,r.image_id,x.batch,now()));}
  const result=await db().batch([...qs,logStmt(m.user_id,'pairs_create',x.batch,{count:x.rows.length})]);return json({created:result.slice(0,-1).reduce((s,r)=>s+r.meta.changes,0)});
 }
 if(action==='release'){
  assert(['raw','pair'].includes(x.kind),'Loại nhiệm vụ không hợp lệ.');assert(typeof x.reason==='string'&&x.reason.trim().length>=5,'Ghi lý do thu hồi.');
  const q=x.kind==='raw'?stmt("UPDATE articles SET status='pending',lease_user=NULL WHERE id=? AND status='in_progress'",x.id):stmt("UPDATE annotations SET state='released',updated=? WHERE id=? AND state='draft'",now(),x.id);
  await db().batch([q,logStmt(m.user_id,'release_'+x.kind,x.id,{reason:x.reason})]);return json({ok:true});
 }
 throw new AppError(404,'Không có thao tác này.');
}catch(e){return fail(e)}}
