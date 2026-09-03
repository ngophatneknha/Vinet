// Netlify's adapter may expose an internal request URL. Trust build metadata,
// never a caller-controlled Host or X-Forwarded-Host header, for the public URL.
export function buildRequestOrigins(env:Record<string,string|undefined>){
 const urls=[env.URL,env.DEPLOY_PRIME_URL,env.DEPLOY_URL].filter((s):s is string=>!!s);
 if(env.NETLIFY==='true'&&!urls.length)throw Error('Missing Netlify public URL metadata.');
 return [...new Set(urls.map(value=>{
  const u=new URL(value);
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid public site URL.');
  return u.origin;
 }))];
}

export function isAllowedRequestOrigin(req:Request,configuredOrigins:readonly string[]){
 const origin=req.headers.get('origin');
 if(origin===null)return true; // Non-browser imports retain their authenticated API path.
 try{
  const u=new URL(origin);
  if(!['https:','http:'].includes(u.protocol)||origin!==u.origin)return false;
  const allowed=configuredOrigins.length?configuredOrigins:[new URL(req.url).origin];
  return allowed.includes(origin);
 }catch{return false}
}
