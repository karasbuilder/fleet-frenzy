import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist'),mount='/games/fleet-frenzy/';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.wav':'audio/wav','.json':'application/json','.gz':'application/gzip','.txt':'text/plain; charset=utf-8'};
const policy="sandbox allow-scripts; default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'";
const server=createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(pathname==='/health'){
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(req.method==='HEAD'?undefined:JSON.stringify({ok:true,game:'fleet-frenzy',runtime:'browser',version:'1.0.0',upstream:'bf854c2433b1eb0750c49b490f36fa0085cd41bd'}));return;
 }
 if(!pathname.startsWith(mount)||pathname.includes('\\')||pathname.includes('\0')){res.writeHead(404);res.end();return;}
 const relative=pathname.slice(mount.length)||'index.html',file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)||relative.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);res.end();return;}
 try{
  const info=await stat(file);if(!info.isFile())throw Error('Not a file');
  let served=file,size=info.size,encoding='';
  if(/\.(?:html|js|css)$/.test(relative)){
   const quality=new Map(String(req.headers['accept-encoding']||'').toLowerCase().split(',').map(part=>{
    const [name,...args]=part.trim().split(';'),q=args.find(v=>v.trim().startsWith('q='));return [name,q?Number(q.trim().slice(2)):1];
   }));
   const variants=[['br','.br'],['gzip','.gz']].map(([name,suffix])=>({name,suffix,q:quality.get(name)??quality.get('*')??0})).filter(v=>Number.isFinite(v.q)&&v.q>0&&v.q<=1).sort((a,b)=>b.q-a.q);
   for(const v of variants){try{const s=await stat(file+v.suffix);if(s.isFile()){served=file+v.suffix;size=s.size;encoding=v.name;break;}}catch{}}
  }
  const immutable=/[-][\w-]{8,}\.(?:js|css)$/.test(relative);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':size,'Vary':'Accept-Encoding',...(encoding?{'Content-Encoding':encoding}:{}),
   'Cache-Control':immutable?'public,max-age=31536000,immutable':relative==='index.html'?'no-cache':'public,max-age=3600',
   'Content-Security-Policy':policy,'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else{const stream=createReadStream(served);stream.on('error',()=>res.destroy());stream.pipe(res);}
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.WEB_PORT||8080),process.env.BIND||'0.0.0.0',()=>console.log(`Fleet Frenzy static host: ${server.address().port}`));
