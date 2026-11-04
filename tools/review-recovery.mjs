import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {attachGame,point,button,active,start,fire} from './review-support.mjs';
const out=process.env.OUTPUT_DIR||'artifacts/recovery-review';await mkdir(out,{recursive:true});
const host=spawn(process.execPath,['host/start.mjs'],{env:{...process.env,WEB_PORT:'0',BIND:'127.0.0.1'},stdio:['ignore','pipe','inherit']});
const origin=await new Promise((resolve,reject)=>{host.once('exit',code=>reject(Error('Host exited '+code)));host.stdout.on('data',b=>{const m=String(b).match(/host: (\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]);});});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
const checks=[],errors=[];
try{
 for(const [path,status] of [['/games/fleet-frenzy/.git/config',404],['/games/fleet-frenzy/%2e%2e%2fpackage.json',404],['/games/flashfire/',404],['/games/fleet-frenzy/no-file',404]])assert.equal((await fetch(origin+path)).status,status,path);
 assert.equal((await fetch(origin+'/games/fleet-frenzy/',{method:'POST'})).status,405);
 for(const [value,encoding]of [['br','br'],['br;q=0,gzip','gzip'],['identity',null]]){
  const r=await fetch(origin+'/games/fleet-frenzy/',{headers:{'Accept-Encoding':value}});assert.equal(r.headers.get('content-encoding'),encoding);assert.match(await r.text(),/Fleet Frenzy/);
 }
 checks.push('Static service traversal/method isolation and gzip/Brotli negotiation');
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/assets/img/ocean.png',r=>r.fulfill({status:503,body:'Unavailable'}));await page.goto(origin+'/games/fleet-frenzy/');await page.locator('#host-error').waitFor({state:'visible'});assert.equal(await page.locator('#host-tools').isVisible(),false);
 await page.unroute('**/assets/img/ocean.png');await page.locator('#host-retry').click();await page.waitForFunction(()=>!document.querySelector('#host-tools').hidden);await attachGame(page);checks.push('Asset failure stays unready; Retry loads a fresh working game');
 await button(page,'Menu','PLAY');await active(page,'Placement');
 const before=await page.evaluate(()=>window.__fleetQA.scene.getScene('Placement').ships),listeners=[];
 for(let i=0;i<16;i++){await page.setViewportSize(i%2?{width:1920,height:1080}:{width:2560,height:1080});await page.waitForTimeout(35);listeners.push(await page.evaluate(()=>{const s=window.__fleetQA.scene.getScene('Placement');return[s.input.listenerCount('pointermove'),s.input.listenerCount('pointerup')]}));}
 assert.deepEqual(await page.evaluate(()=>window.__fleetQA.scene.getScene('Placement').ships),before);assert.ok(listeners.every(x=>x[0]===1&&x[1]===1),JSON.stringify(listeners));
 const drag=await page.evaluate(()=>{
  const s=window.__fleetQA.scene.getScene('Placement'),size={carrier:5,battleship:4,cruiser:3,submarine:3,destroyer:2},cells=v=>Array.from({length:size[v.name]},(_,i)=>({x:v.x+(v.orientation==='horizontal'?i:0),y:v.y+(v.orientation==='vertical'?i:0)}));
  for(const ship of s.ships)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const candidate={...ship,x:ship.x+dx,y:ship.y+dy},taken=new Set(s.ships.filter(v=>v.name!==ship.name).flatMap(cells).map(c=>`${c.x},${c.y}`));
   if(cells(candidate).every(c=>c.x>=0&&c.y>=0&&c.x<10&&c.y<10&&!taken.has(`${c.x},${c.y}`)))return{ship,candidate,from:{x:s.board.x+(ship.x+.5)*s.board.cell,y:s.board.y+(ship.y+.5)*s.board.cell},to:{x:s.board.x+(candidate.x+.5)*s.board.cell,y:s.board.y+(candidate.y+.5)*s.board.cell}};
  }throw Error('No movable ship');
 });
 const from=await point(page,'Placement',drag.from.x,drag.from.y),to=await point(page,'Placement',drag.to.x,drag.to.y);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:6});await page.mouse.up();assert.deepEqual(await page.evaluate(name=>window.__fleetQA.scene.getScene('Placement').ships.find(s=>s.name===name),drag.ship.name),drag.candidate);
 checks.push('Sixteen resizes retain placement, keep one listener per event and preserve inverse-mapped drag input');
 await button(page,'Placement','MENU');await start(page,'ADMIRAL');let turns=0;
 while(!await page.evaluate(()=>window.__fleetQA.scene.isActive('Result'))){
  assert.ok(turns++<110);await page.waitForFunction(()=>window.__fleetQA.scene.isActive('Result')||window.__fleetQA.scene.getScene('Battle').phase==='player');if(await page.evaluate(()=>window.__fleetQA.scene.isActive('Result')))break;
  const c=await page.evaluate(()=>{const m=window.__fleetQA.scene.getScene('Battle').match,sz={carrier:5,battleship:4,cruiser:3,submarine:3,destroyer:2},used=new Set(m.botShips.flatMap(s=>Array.from({length:sz[s.name]},(_,i)=>`${s.x+(s.orientation==='horizontal'?i:0)},${s.y+(s.orientation==='vertical'?i:0)}`)));for(let y=0;y<10;y++)for(let x=0;x<10;x++)if(!used.has(`${x},${y}`)&&!m.hasFired('player',{x,y}))return{x,y};});
  assert.ok(c);await fire(page,c);await page.waitForTimeout(40);
 }
 await active(page,'Result');assert.equal(await page.evaluate(()=>window.__fleetQA.scene.getScene('Result').match.winner),'bot');assert.equal(await page.evaluate(()=>window.__fleetQA.scene.getScene('Result').match.endReason),'all_sunk');await page.screenshot({path:out+'/defeat.png'});checks.push('A complete bot victory reaches the defeat screen');assert.deepEqual(errors,[]);
}finally{await writeFile(out+'/report.json',JSON.stringify({origin,checks,errors},null,2));console.log(JSON.stringify({origin,checks,errors}));await browser.close();host.kill();}
