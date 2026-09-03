import {getAppUser} from '@/lib/auth';
import {database} from '@/lib/database';
import {storage} from '@/lib/storage';
import {bindMemberIdentity} from '@/lib/member-identity';
import {isAllowedRequestOrigin} from '@/lib/request-origin';
export const db=()=>database;
export const files=()=>storage;
export const config=()=>process.env as Record<string,string>;
export const now=()=>new Date().toISOString();
export const uid=()=>crypto.randomUUID();
export const stmt=(q:string,...v:any[])=>db().prepare(q).bind(...v);
export const one=(q:string,...v:any[])=>stmt(q,...v).first<any>();
export const all=async(q:string,...v:any[])=>(await stmt(q,...v).all<any>()).results;
export const run=(q:string,...v:any[])=>stmt(q,...v).run();
export const logStmt=(user:string,action:string,id:string,payload:any={})=>stmt('INSERT INTO audit VALUES (?,?,?,?,?,?)',uid(),user,action,id,JSON.stringify(payload),now());
export class AppError extends Error{constructor(public status:number,message:string){super(message)}}
export function assert(ok:any,message:string,status=400):asserts ok {if(!ok)throw new AppError(status,message)}
export async function ensureOwner(u:any){
 if(!u||u.email.toLowerCase()!==config().OWNER_EMAIL?.toLowerCase())return;
 if(await one("SELECT key FROM settings WHERE key='setup_consumed'"))return;
 await db().batch([
  stmt("INSERT INTO members(email,user_id,name,role,active,created) SELECT ?,?,?,'admin',1,? WHERE NOT EXISTS(SELECT 1 FROM settings WHERE key='setup_consumed') ON CONFLICT(email) DO NOTHING",u.email.toLowerCase(),u.userId,u.fullName||u.email,now()),
  stmt("INSERT INTO settings(key,value) VALUES('setup_consumed',?) ON CONFLICT(key) DO NOTHING",now()),
 ]);
}
export async function member(){
 const u=await getAppUser();assert(u,'Đăng nhập để tiếp tục.',401);
 await ensureOwner(u);
 const m=await one('SELECT * FROM members WHERE email=?',u.email.toLowerCase());
 assert(m&&m.active,'Tài khoản chưa được điều phối viên cấp quyền.',403);
 const bound=await bindMemberIdentity(db(),m.email,u.userId);
 assert(bound,'Danh tính tài khoản không khớp.',403);
 return bound;
}
export function permit(m:any,...roles:string[]){assert(roles.includes(m.role),'Bạn không có quyền thực hiện thao tác này.',403)}
export const json=(x:any,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function fail(e:any){if(!(e instanceof AppError))console.error('Workflow failure',{name:e?.name,code:e?.code});return json({error:e instanceof AppError?e.message:'Thao tác chưa hoàn tất. Hãy thử lại hoặc báo điều phối viên.'},e instanceof AppError?e.status:500)}
export async function body(req:Request){
 const text=await req.text();assert(text.length<=2000000,'Yêu cầu quá lớn.',413);
 assert(isAllowedRequestOrigin(req,JSON.parse(process.env.VINEWS_REQUEST_ORIGINS||'[]')),'Nguồn yêu cầu không hợp lệ.',403);
 assert(req.headers.get('content-type')?.includes('application/json'),'Yêu cầu JSON.');
 try{return JSON.parse(text)}catch{throw new AppError(400,'JSON không hợp lệ.')}
}
export async function article(id:string){
 const a=await one('SELECT * FROM articles WHERE id=?',id);assert(a,'Không tìm thấy bài.',404);
 const imgs=await all('SELECT i.*,s.ready FROM images i JOIN assets s ON s.id=i.asset_id WHERE article_id=? ORDER BY i.id',id);
 return {...a,payload:JSON.parse(a.payload),images:imgs.map(i=>({...i,payload:JSON.parse(i.payload)}))};
}
export async function pairView(id:string,m:any){
 const p=await one('SELECT * FROM pairs WHERE id=?',id);assert(p,'Không tìm thấy cặp.',404);
 const own=await one("SELECT * FROM annotations WHERE pair_id=? AND user_id=? AND state!='released'",id,m.user_id);
 assert(own||['admin','reviewer'].includes(m.role),'Cặp chưa được giao cho bạn.',403);
 const a=await article(p.article_id);
 const i=await one('SELECT i.*,s.ready FROM images i JOIN assets s ON s.id=i.asset_id WHERE i.id=?',p.image_id);
 const source=await one('SELECT payload,event_id FROM articles WHERE id=?',i.article_id);
 const third=!own&&['admin','reviewer'].includes(m.role)&&p.state==='review';
 const proposal=await one('SELECT strategy,reason,evidence FROM manual_pair_proposals WHERE pair_id=? AND created_by=?',id,m.user_id);
 return {...p,own_proposal:proposal?{...proposal,evidence:JSON.parse(proposal.evidence)}:null,article:a,image:{...i,payload:JSON.parse(i.payload)},source:JSON.parse(source.payload),own:own?{...own,payload:JSON.parse(own.payload)}:null,reviews:third?(await all("SELECT user_id,label,payload FROM annotations WHERE pair_id=? AND state='submitted'",id)).map(r=>({...r,payload:JSON.parse(r.payload)})):[]};
}
