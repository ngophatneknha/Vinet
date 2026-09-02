import {getDatabase} from '@netlify/database';

type QueryResult={rows:any[];rowCount?:number|null;fields?:{name:string;dataTypeID:number}[]};
export type QueryClient={query:(sql:string,values?:any[])=>Promise<QueryResult>;release?:()=>void};
export type QueryPool=QueryClient&{connect:()=>Promise<QueryClient>};

// Preserve parameterization while migrating the existing workflow queries to PostgreSQL.
export function postgresSQL(input:string){
 let result='',quote=false,index=0;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==="'"){result+=c;if(quote&&input[i+1]==="'"){result+="'";i++;continue}quote=!quote;continue}
  result+=c==='?'&&!quote?`$${++index}`:c;
 }
 return result;
}
function normalize(r:QueryResult){
 const numeric=(r.fields||[]).filter(f=>[20,1700].includes(f.dataTypeID)).map(f=>f.name);
 const rows=r.rows.map(row=>{const copy={...row};for(const k of numeric)if(typeof copy[k]==='string'&&Number.isSafeInteger(Number(copy[k])))copy[k]=Number(copy[k]);return copy});
 return {results:rows,meta:{changes:r.rowCount||0}};
}
export class PreparedStatement {
 constructor(readonly pool:()=>QueryPool,readonly query:string,readonly values:any[]=[]){ }
 bind(...values:any[]){return new PreparedStatement(this.pool,this.query,values)}
 async execute(client:QueryClient=this.pool()){return normalize(await client.query(postgresSQL(this.query),this.values))}
 async first<T=any>(){return (await this.execute()).results[0] as T||null}
 async all<T=any>(){const r=await this.execute();return {...r,results:r.results as T[]}}
 async run(){return this.execute()}
}
export function createDatabase(pool:()=>QueryPool){return {
 prepare:(sql:string)=>new PreparedStatement(pool,sql),
 async batch(statements:PreparedStatement[]){
  for(let attempt=0;;attempt++){
   const client=await pool().connect();
   try{
    await client.query('BEGIN');
    const results=[];for(const s of statements)results.push(await s.execute(client));
    await client.query('COMMIT');return results;
   }catch(e:any){await client.query('ROLLBACK').catch(()=>{});if(attempt<2&&['40001','40P01'].includes(e.code))continue;throw e}
   finally{client.release?.()}
  }
 }
}}
let pool:QueryPool|undefined;
export const database=createDatabase(()=>{
 pool??=getDatabase(process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:{}).pool as unknown as QueryPool;
 return pool;
});
