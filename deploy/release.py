#!/usr/bin/env python3
"""Fleet Frenzy: new isolated static service and a two-file live Store overlay."""
import copy, hashlib, http.client, json, os, shutil, socket, sqlite3, subprocess, sys, time, urllib.parse
from pathlib import Path
ROOT=Path('/data/utxoplay/releases/20261104-fleet-frenzy-1.0.0')
STORE='utxoplay-store'; GAME='utxoplay-fleet-frenzy'; STAGE='utxoplay-fleet-frenzy-store-stage'
ROLLBACK='utxoplay-store-before-fleet-frenzy-1.0.0'; NGINX='outline_keycloak-https-portal-1'
GAME_TAG='utxoplay-fleet-frenzy:1.0.0'; STORE_TAG='utxoplay-store:fleet-frenzy-1.0.0'
os.umask(0o077); ROOT.mkdir(parents=True,exist_ok=True)
def run(*args): return subprocess.check_output(args,text=True).strip()
def inspect(name): return json.loads(run('docker','inspect',name))[0]
def save(name,value): (ROOT/name).write_text(json.dumps(value,indent=2)+'\n')
class DockerConnection(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.connect('/var/run/docker.sock')
def docker(method,path,body=None):
 c=DockerConnection('localhost')
 try:
  c.request(method,'/v1.47'+path,None if body is None else json.dumps(body),{'Content-Type':'application/json'})
  r=c.getresponse();data=r.read()
  if r.status>=300: raise RuntimeError('Docker operation failed: '+str(r.status)+' '+data.decode()[:200])
  return json.loads(data) if data else None
 finally:c.close()
def healthy(name):
 for _ in range(60):
  s=inspect(name)['State'];assert s['Running'],name+' stopped'
  if s.get('Health',{}).get('Status')=='healthy':return
  time.sleep(1)
 raise RuntimeError(name+' health timeout')
def clone(meta,image,staging=False):
 spec=copy.deepcopy(meta['Config']);spec.update(Image=image,Hostname='',HostConfig=copy.deepcopy(meta['HostConfig']))
 endpoints={}
 for network,data in meta['NetworkSettings']['Networks'].items():
  endpoint={}
  if not staging:
   endpoint['Aliases']=[a for a in data.get('Aliases') or [] if a not in [meta['Id'],meta['Id'][:12]]]
   if data.get('IPAMConfig'):endpoint['IPAMConfig']=data['IPAMConfig']
  endpoints[network]=endpoint
 spec['NetworkingConfig']={'EndpointsConfig':endpoints}
 spec['Labels']={k:v for k,v in (spec.get('Labels') or {}).items() if not k.startswith('com.docker.compose.')}
 spec['Labels']['io.utxoplay.fleet.release']=str(ROOT)
 if staging:
  env=dict(e.split('=',1) for e in spec['Env'] if not e.startswith('VIRTUAL_'));env['PUBLIC_ORIGIN']='http://127.0.0.1:19944'
  spec['Env']=[k+'='+v for k,v in env.items()]
  spec['HostConfig']['RestartPolicy']={'Name':'no','MaximumRetryCount':0}
  spec['HostConfig']['PortBindings']={'8790/tcp':[{'HostIp':'127.0.0.1','HostPort':'19944'}]}
 return spec
def create(name,spec):
 save(name+'.private.json',spec);docker('POST','/containers/create?name='+urllib.parse.quote(name),spec);run('docker','start',name);healthy(name)
def backup(source,target):
 with sqlite3.connect('file:'+str(source)+'?mode=ro',uri=True) as src,sqlite3.connect(target) as dst:
  src.backup(dst);assert dst.execute('PRAGMA quick_check').fetchone()[0]=='ok'
def isolate(spec,meta):
 stage=ROOT/'stage-data';stage.mkdir(exist_ok=True)
 writable=[m for m in meta['Mounts'] if m['RW']];assert [m['Destination'] for m in writable]==['/app/data']
 for name in ['platform.sqlite','site-stats.sqlite']:
  source=Path(writable[0]['Source'])/name
  if source.exists():backup(source,stage/name)
 run('chown','-R','1000:1000',str(stage));found=False
 binds=[]
 for bind in spec['HostConfig'].get('Binds') or []:
  src,target,*options=bind.split(':')
  if target=='/app/data':src=str(stage);found=True
  binds.append(':'.join([src,target]+options))
 spec['HostConfig']['Binds']=binds
 for mount in spec['HostConfig'].get('Mounts') or []:
  if mount['Target']=='/app/data':mount['Source']=str(stage);found=True
 assert found,'Stage database was not isolated'
def assert_scope(meta):
 for name in ['catalog.json','game-services.json']:
  before=json.loads(run('docker','exec',STORE,'cat','/app/server/'+name));after=json.loads((ROOT/'overlay'/name).read_text())
  if name=='catalog.json':
   assert not any(g['id']=='fleet-frenzy' for g in before)
   assert before==[g for g in after if g['id']!='fleet-frenzy']
  else:
   assert 'fleet-frenzy' not in before
   after.pop('fleet-frenzy');assert before==after
 assert inspect(STORE)['Id']==meta['Id'],'Live Store changed: rebase and retest'
def prepare():
 assert not (ROOT/'deployment.json').exists(),'Release already deployed'
 meta=inspect(STORE);save('store-before.private.json',meta)
 assert not any(e.startswith('FLEET_FRENZY_URL=') and e!='FLEET_FRENZY_URL=http://'+GAME+':8080' for e in meta['Config']['Env']),'Conflicting reserved game URL'
 save('containers-before.json',{m['Name']:m['Id'] for m in json.loads(run('docker','inspect',*run('docker','ps','-q').split()))})
 runtime=ROOT/'runtime';runtime.mkdir(exist_ok=True)
 run('tar','-xzf',str(ROOT/'runtime.tar.gz'),'-C',str(runtime))
 for f in json.loads((ROOT/'files.json').read_text()):
  p=runtime/'dist'/f['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
 node=run('docker','image','inspect','node:22-bookworm-slim','--format','{{.Id}}');node_tag='utxoplay-fleet-frenzy:node-'+node.split(':')[1][:12]
 run('docker','tag',node,node_tag)
 p=runtime/'deploy/Dockerfile';p.write_text(p.read_text().replace('FROM node:22-bookworm-slim','FROM '+node_tag))
 run('docker','build','-f',str(p),'-t',GAME_TAG,str(runtime))
 run('docker','run','-d','--name',GAME,'--label','io.utxoplay.fleet.release='+str(ROOT),'--network','utxoplay-games','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','256m','--cpus','0.5','--pids-limit','64','--restart','unless-stopped','--tmpfs','/tmp:rw,noexec,nosuid,size=16m',GAME_TAG)
 healthy(GAME)
 overlay=ROOT/'overlay';overlay.mkdir(exist_ok=True)
 for name in ['catalog.json','game-services.json']:run('docker','cp',STORE+':/app/server/'+name,str(overlay/name))
 catalog=json.loads((overlay/'catalog.json').read_text());assert not any(g['id']=='fleet-frenzy' for g in catalog)
 catalog.append(json.loads((ROOT/'catalog-entry.json').read_text()));(overlay/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
 services=json.loads((overlay/'game-services.json').read_text());assert 'fleet-frenzy' not in services
 services['fleet-frenzy']={'url':'http://'+GAME+':8080','urlEnv':'FLEET_FRENZY_URL','runtime':'browser','socket':False,'recordReads':False,'repository':'karasbuilder/fleet-frenzy'}
 (overlay/'game-services.json').write_text(json.dumps(services,indent=2)+'\n')
 base='utxoplay-store:fleet-base-'+meta['Image'].split(':')[1][:12];run('docker','tag',meta['Image'],base)
 (overlay/'Dockerfile').write_text('FROM '+base+'\nCOPY catalog.json game-services.json /app/server/\n')
 for p in overlay.iterdir():p.chmod(0o644)
 assert_scope(meta);run('docker','build','-t',STORE_TAG,str(overlay))
 spec=clone(meta,STORE_TAG,True);isolate(spec,meta);create(STAGE,spec)
 save('stage.json',{'baseId':meta['Id'],'baseImage':meta['Image'],'gameImage':inspect(GAME)['Image'],'storeImage':inspect(STAGE)['Image'],'isolatedDatabase':True})
 print((ROOT/'stage.json').read_text())
def cutover():
 meta=json.loads((ROOT/'store-before.private.json').read_text());candidate=json.loads((ROOT/'stage.json').read_text())
 assert inspect(STAGE)['Image']==candidate['storeImage'];healthy(STAGE);healthy(GAME);assert_scope(meta)
 assert inspect(GAME)['Image']==candidate['gameImage']
 data=Path(next(m['Source'] for m in meta['Mounts'] if m['Destination']=='/app/data'))
 backup(data/'platform.sqlite',ROOT/'platform-before.private.sqlite')
 run('docker','exec',NGINX,'nginx','-t');assert inspect(STORE)['Id']==meta['Id']
 run('docker','stop','-t','15',STORE);run('docker','rename',STORE,ROLLBACK)
 try:
  create(STORE,clone(meta,candidate['storeImage']))
  run('docker','exec',STORE,'node','-e',"fetch('http://127.0.0.1:8790/api/games').then(r=>r.json()).then(x=>{if(!x.games.some(g=>g.id==='fleet-frenzy'&&g.runtime==='browser'))process.exit(1)})")
  run('docker','exec',NGINX,'nginx','-s','reload')
 except Exception:
  subprocess.run(['docker','rm','-f',STORE],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  run('docker','rename',ROLLBACK,STORE);run('docker','start',STORE);healthy(STORE);run('docker','exec',NGINX,'nginx','-s','reload');raise
 save('deployment.json',{**candidate,'rollbackStore':ROLLBACK,'publishedAtUtc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())})
 print((ROOT/'deployment.json').read_text())
def verify():
 before=json.loads((ROOT/'store-before.private.json').read_text());after=inspect(STORE);candidate=json.loads((ROOT/'stage.json').read_text())
 assert after['Image']==candidate['storeImage'];assert inspect(GAME)['Image']==candidate['gameImage']
 assert before['HostConfig']==after['HostConfig']
 ignored={'Image','Hostname','Labels'};assert {k:v for k,v in before['Config'].items() if k not in ignored}=={k:v for k,v in after['Config'].items() if k not in ignored}
 assert sorted(before['Mounts'],key=lambda m:m['Destination'])==sorted(after['Mounts'],key=lambda m:m['Destination'])
 assert set(before['NetworkSettings']['Networks'])==set(after['NetworkSettings']['Networks'])
 ids=json.loads((ROOT/'containers-before.json').read_text());changed=[]
 for name,identity in ids.items():
  if name!='/'+STORE and inspect(name)['Id']!=identity:changed.append(name)
 assert not changed,'Other containers changed: '+str(changed)
 healthy(STORE);healthy(GAME)
 print(json.dumps({'configurationPreserved':True,'otherContainersPreserved':True,'gameImage':candidate['gameImage'],'storeImage':candidate['storeImage']}))
def rollback():
 candidate=json.loads((ROOT/'stage.json').read_text());meta=json.loads((ROOT/'store-before.private.json').read_text())
 assert inspect(STORE)['Image']==candidate['storeImage'],'Newer Store present; refuse rollback'
 assert inspect(ROLLBACK)['Id']==meta['Id']
 run('docker','stop','-t','15',STORE);run('docker','rename',STORE,STORE+'-failed-fleet-frenzy')
 run('docker','rename',ROLLBACK,STORE);run('docker','start',STORE);healthy(STORE)
 run('docker','exec',NGINX,'nginx','-t');run('docker','exec',NGINX,'nginx','-s','reload')
 print('Previous Store restored using current player data. New static runtime retained for inspection.')
def cleanup():
 candidate=json.loads((ROOT/'stage.json').read_text());assert inspect(STORE)['Image']==candidate['storeImage']
 run('docker','rm','-f',STAGE);shutil.rmtree(ROOT/'stage-data')
 print('Only this release staging removed. Rollback Store and consistent backups retained.')
if __name__=='__main__':{'prepare':prepare,'cutover':cutover,'verify':verify,'rollback':rollback,'cleanup':cleanup}[sys.argv[1]]()
