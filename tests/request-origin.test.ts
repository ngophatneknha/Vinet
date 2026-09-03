import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRequestOrigins,isAllowedRequestOrigin} from '../lib/request-origin';

const site='https://vinet-annotation.netlify.app';
const req=(origin?:string,url='http://localhost:3000/api/work',headers:Record<string,string>={})=>new Request(url,{method:'POST',headers:{...headers,...(origin===undefined?{}:{origin})}});
test('Netlify public browser requests work through an internal adapter URL',()=>{
 const origins=buildRequestOrigins({NETLIFY:'true',URL:site,DEPLOY_PRIME_URL:site,DEPLOY_URL:'https://deploy-id--vinet-annotation.netlify.app'});
 assert.equal(origins.length,2);
 assert.equal(isAllowedRequestOrigin(req(site),origins),true);
 assert.equal(isAllowedRequestOrigin(req(origins[1]),origins),true);
 assert.equal(isAllowedRequestOrigin(req(site,'https://internal-function.example/api/work'),origins),true);
});
test('foreign, malformed and spoofed origins remain blocked',()=>{
 for(const origin of ['https://evil.example','https://vinet-studio.netlify.app','http://localhost:3000','https://vinet-annotation.netlify.app.evil.example','http://vinet-annotation.netlify.app','https://vinet-annotation.netlify.app:444','null','','https://vinet-annotation.netlify.app/','https://user@vinet-annotation.netlify.app']){
  assert.equal(isAllowedRequestOrigin(req(origin,undefined,{host:'evil.example','x-forwarded-host':'evil.example','x-forwarded-proto':'https'}),[site]),false,origin);
 }
 assert.equal(isAllowedRequestOrigin(req('https://evil.example','https://evil.example/api/work'),[site]),false,'request URL cannot override configured origins');
});
test('local development and originless authenticated clients keep working',()=>{
 assert.equal(isAllowedRequestOrigin(req(undefined),[site]),true);
 assert.equal(isAllowedRequestOrigin(req('http://localhost:3000'),[]),true);
 assert.equal(isAllowedRequestOrigin(req('http://localhost:3001'),[]),false);
 assert.deepEqual(buildRequestOrigins({}),[]);
 assert.throws(()=>buildRequestOrigins({NETLIFY:'true'}));
 assert.throws(()=>buildRequestOrigins({URL:'javascript:alert(1)'}));
});
