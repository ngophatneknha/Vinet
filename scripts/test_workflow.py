"""Run only against the isolated local Worker on port 3001; never production."""
import concurrent.futures, hashlib, io, json, urllib.request, urllib.error, uuid
from PIL import Image

BASE='http://127.0.0.1:3001'
suffix=uuid.uuid4().hex[:8]
OWNER=('test-owner@example.test','test_owner')
users={n:(f'{n}-{suffix}@example.test',f'{n}_{suffix}') for n in ['alice','bob','carol','outsider']}
checks=[]
def call(path='/api/work',data=None,user=OWNER,method=None,expected=200,headers=None):
 h={}
 if user:h.update({'oai-authenticated-user-email':user[0],'oai-authenticated-user-id':user[1]})
 if isinstance(data,dict):data=json.dumps(data).encode();h['Content-Type']='application/json'
 if headers:h.update(headers)
 request=urllib.request.Request(BASE+path,data=data,headers=h,method=method)
 try:
  with urllib.request.urlopen(request,timeout=45) as r: status=r.status; body=r.read(); ct=r.headers.get('Content-Type','')
 except urllib.error.HTTPError as e:status=e.code;body=e.read();ct=e.headers.get('Content-Type','')
 assert status==expected,(path,status,expected,body[:800])
 return json.loads(body) if 'application/json' in ct else body
def action(a,user=OWNER,expected=200,**kw):return call(data={'action':a,**kw},user=user,expected=expected)
def passed(s):checks.append(s);print('PASS',s,flush=True)

call('/api/work?action=session')
call('/api/work?action=stats',user=None,expected=401)
call('/api/work?action=stats',user=users['outsider'],expected=403)
call(data={'action':'raw_claim'},headers={'Origin':'https://untrusted.invalid'},expected=403)
passed('anonymous, nonmember and cross-origin requests are blocked')
for n in ['alice','bob','carol']:action('member',email=users[n][0],name=n,role='reviewer' if n=='carol' else 'annotator',active=True)
action('member',user=users['alice'],expected=403,email='bad@example.test',name='Bad',role='admin',active=True)
call('/api/export?kind=raw',user=users['alice'],expected=403)
passed('annotator cannot manage users or export the dataset')

out=io.BytesIO();Image.new('RGB',(400,300),(72,123,99)).save(out,format='PNG');binary=out.getvalue();asset='sha256_'+hashlib.sha256(binary).hexdigest()
rows=[]
for n in range(4):
 aid=f'test_{suffix}_{n}';iid=f'test_image_{suffix}_{n}'
 rows.append({'article_id':aid,'publisher':'Integration test','headline':f'Fixture {n}', 'article_url':'https://example.test/article','publish_date':'2026-01-01','collection_timestamp':'2026-09-02T00:00:00Z','body_text':'Synthetic fixture for workflow validation only.','inventory_incomplete':n==3,'images':[{'image_id':iid,'asset_id':asset,'format':'png','width':400,'height':300,'is_lead_image':True,'image_url':'https://example.test/image.png','caption':'Test fixture'}]})
call('/api/import',{'articles':rows})
assert action('raw_claim',user=users['alice']) is None
call('/api/import/'+asset,b'bad',method='PUT',expected=400)
call('/api/import/'+asset,binary,method='PUT')
assert call('/api/media/'+asset)==binary
call('/api/media/'+asset,user=None,expected=401)
passed('raw tasks wait for uploads; invalid image rejected; private image read verified')

with concurrent.futures.ThreadPoolExecutor(2) as pool:
 tasks=list(pool.map(lambda n:action('raw_claim',user=users[n]),['alice','bob']))
assert tasks[0]['id']!=tasks[1]['id']
passed('concurrent raw claims receive different articles')
def raw_review(a,decision='approved'):
 return {'decision':decision,'reason':'Verified synthetic test fixture evidence','images':[{'id':i['id'],'decision':'keep','caption':'Corrected fixture caption','type':'news','reason':''} for i in a['images']]}
for name,a in zip(['alice','bob'],tasks):
 action('raw_submit',user=users[name],id=a['id'],review={'decision':'approved','images':[],'reason':''},expected=400)
 action('raw_save',user=users[name],id=a['id'],review=raw_review(a))
 read=call('/api/work?action=article&id='+a['id'],user=users[name]);assert read['reviews'][0]['state']=='draft'
 action('raw_submit',user=users[name],id=a['id'],review=raw_review(a))
 action('raw_submit',user=users[name],id=a['id'],review=raw_review(a),expected=409)
 action('event',id=a['id'],event='test_event_'+a['id'])
passed('raw validation, draft persistence and immutable submission')

batch=action('batch',name='Integration test '+suffix,kind='pilot',active=True)['id']
action('create_pairs',batch=batch,rows=[{'article_id':tasks[0]['id'],'image_id':tasks[1]['images'][0]['id']}])
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 pairs=list(pool.map(lambda n:action('pair_claim',user=users[n]),['alice','bob']))
assert pairs[0]['id']==pairs[1]['id'];pid=pairs[0]['id']
assert all(p['reviews']==[] for p in pairs)
assert action('pair_claim',user=users['carol']) is None
passed('two distinct slots, third claimant cannot take occupied pair, blind views')

def annotation(label):
 return {'label':label,'reason':'Evidence confirms the synthetic event relationship.','evidence':['https://example.test/evidence'],'answers':[{'yes':True,'uncertainty':0},{'yes':True,'uncertainty':1},{'yes':label=='matched','uncertainty':1},{'yes':True,'uncertainty':0},{'yes':True,'uncertainty':0},{'yes':False,'uncertainty':0}]}
action('pair_submit',user=users['alice'],id=pid,review={'label':'matched'},expected=400)
action('pair_save',user=users['alice'],id=pid,review=annotation('matched'))
assert call('/api/work?action=pair&id='+pid,user=users['alice'])['own']['payload']['label']=='matched'
assert call('/api/work?action=pair&id='+pid,user=users['bob'])['reviews']==[]
action('pair_submit',user=users['alice'],id=pid,review=annotation('matched'))
action('pair_submit',user=users['alice'],id=pid,review=annotation('matched'),expected=409)
action('pair_submit',user=users['bob'],id=pid,review=annotation('out_of_context'))
p=call('/api/work?action=pair&id='+pid,user=users['carol']);assert p['state']=='review' and len(p['reviews'])==2
action('adjudicate',user=users['alice'],id=pid,kind='pair',decision='matched',reason='A sufficiently long reason',expected=403)
action('adjudicate',user=users['carol'],id=pid,kind='pair',decision='out_of_context',reason='Third reviewer verified conflicting event evidence.')
action('adjudicate',user=users['carol'],id=pid,kind='pair',decision='matched',reason='Trying to overwrite a locked result',expected=409)
passed('pair draft, validation, blind submission, conflict routing and third-person adjudication')
exported=call('/api/export?kind=pairs').decode()
record=next(json.loads(s) for s in exported.splitlines() if json.loads(s)['id']==pid)
assert record['final_label']=='out_of_context' and len(record['annotations'])==2 and len(record['adjudications'])==1 and record['benchmark_eligible']
assert {a['label'] for a in record['annotations']}=={'matched','out_of_context'}
passed('export preserves both original labels, evidence and adjudication')

# Process the remaining ordinary article, then assert the incomplete inventory gate.
a=action('raw_claim',user=users['alice'])
if not a['inventory_flag']:
 action('raw_submit',user=users['alice'],id=a['id'],review=raw_review(a));a=action('raw_claim',user=users['alice'])
assert a['inventory_flag']==1
action('raw_submit',user=users['alice'],id=a['id'],review=raw_review(a),expected=400)
action('raw_submit',user=users['alice'],id=a['id'],review=raw_review(a,'review'))
passed('incomplete inventory cannot be approved by first reviewer')
action('member',email=users['bob'][0],name='bob',role='annotator',active=False)
call('/api/work?action=stats',user=users['bob'],expected=403)
passed('disabled members lose access immediately')
print(json.dumps({'passed':len(checks),'checks':checks,'test_suffix':suffix},indent=2))
