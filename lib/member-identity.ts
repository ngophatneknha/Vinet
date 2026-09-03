import type {createDatabase} from './database';

// Workflow IDs remain stable when the Identity instance changes between sites.
// Only a verified session matching an active member email may bind a subject.
export async function bindMemberIdentity(database:ReturnType<typeof createDatabase>, email:string, subject:string){
 const q=(sql:string,...values:any[])=>database.prepare(sql).bind(...values);
 await q('UPDATE members SET auth_subject=?,user_id=COALESCE(user_id,?) WHERE email=? AND active=1 AND auth_subject IS NULL',subject,subject,email).run();
 const member=await q('SELECT * FROM members WHERE email=? AND active=1',email).first<any>();
 return member?.auth_subject===subject ? member : null;
}
