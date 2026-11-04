import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
let origin=process.env.REVIEW_ORIGIN;
let host;
if(!origin){
 host=spawn(process.execPath,['host/start.mjs'],{env:{...process.env,WEB_PORT:'0',BIND:'127.0.0.1'},stdio:['ignore','pipe','inherit']});
 origin=await new Promise((resolve,reject)=>{host.once('exit',code=>reject(Error('Host exited '+code)));host.stdout.on('data',b=>{const m=String(b).match(/host: (\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]);});});
}
const out=process.env.OUTPUT_DIR||'artifacts/browser-review';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
const checks=[],errors=[],failed=[];
import {attachGame,point,clickWorld,button,active,resume,start,fire} from './review-support.mjs';

try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()})});
 page.setDefaultTimeout(30000);await page.goto(origin+'/games/fleet-frenzy/');await page.waitForFunction(()=>!document.querySelector('#host-tools').hidden);await attachGame(page);
 assert.equal(await page.evaluate(()=>{try{localStorage.getItem('x');return false}catch{return true}}),true,'Opaque sandbox blocks persistent storage');
 await page.screenshot({path:out+'/menu.png'});
 await start(page);
 for(const [w,h] of [[1920,1080],[2560,1080],[2560,1440],[3840,2160]]){
  await page.setViewportSize({width:w,height:h});await page.waitForTimeout(120);await resume(page);
  const m=await page.evaluate(()=>{const g=window.__fleetQA,s=g.scene.getScene('Battle');return {viewport:[innerWidth,innerHeight],backing:[g.canvas.width,g.canvas.height],cell:s.theirs.cell,world:[s.stage.W,s.stage.H],listeners:s.input.listenerCount('pointerup'),ratio:g.canvas.width/innerWidth}});
  assert.equal(m.viewport[0],w);await page.waitForFunction(()=>window.__fleetQA.scene.getScene('Battle').phase==='player');const cell={x:checks.length,y:checks.length};const pos=await page.evaluate(c=>{const b=window.__fleetQA.scene.getScene('Battle').theirs;return{x:b.x+(c.x+.5)*b.cell,y:b.y+(c.y+.5)*b.cell}},cell);await clickWorld(page,'Battle',pos.x,pos.y);assert.deepEqual(await page.evaluate(()=>window.__fleetQA.scene.getScene('Battle').target),cell);assert.ok(m.backing[0]*m.backing[1]<=3840*2160+10000);checks.push({size:[w,h],...m});await page.screenshot({path:`${out}/battle-${w}x${h}.png`});
 }
 await page.setViewportSize({width:1920,height:1080});await resume(page);
 for(const level of ['CADET','CAPTAIN','ADMIRAL']){
  if(level!=='CADET'){await button(page,'Result','MENU');await start(page,level);}
  let guard=0;
  while(!await page.evaluate(()=>window.__fleetQA.scene.isActive('Result'))){
   assert.ok(guard++<70,'Match completes');await page.waitForFunction(()=>window.__fleetQA.scene.isActive('Result')||window.__fleetQA.scene.getScene('Battle').phase==='player');
   if(await page.evaluate(()=>window.__fleetQA.scene.isActive('Result')))break;
   const c=await page.evaluate(()=>{const m=window.__fleetQA.scene.getScene('Battle').match;for(const s of m.botShips){const n={carrier:5,battleship:4,cruiser:3,submarine:3,destroyer:2}[s.name];for(let i=0;i<n;i++){const c={x:s.x+(s.orientation==='horizontal'?i:0),y:s.y+(s.orientation==='vertical'?i:0)};if(!m.hasFired('player',c))return c;}}});
   await fire(page,c);await page.waitForTimeout(40);
  }
  await active(page,'Result');const r=await page.evaluate(()=>({winner:window.__fleetQA.scene.getScene('Result').match.winner,reason:window.__fleetQA.scene.getScene('Result').match.endReason}));assert.equal(r.winner,'player');checks.push({difficulty:level,completion:r});console.log('Completed '+level+' win');
 }
 await page.screenshot({path:out+'/victory.png'});await button(page,'Result','MENU');await start(page);
 await page.waitForFunction(()=>window.__fleetQA.scene.getScene('Battle').phase==='player');
 const c=await page.evaluate(()=>{const b=window.__fleetQA.scene.getScene('Battle').theirs;return{x:b.x+b.cell*.5,y:b.y+b.cell*.5}});await clickWorld(page,'Battle',c.x,c.y);
 await page.evaluate(()=>{const s=window.__fleetQA.scene.getScene('Battle');s.time.timeScale=1;s.fire();s.askSurrender();});
 const before=await page.evaluate(()=>window.__fleetQA.scene.getScene('Battle').match.shots.player.length);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.__fleetQA.scene.getScene('Battle').match.shots.player.length),before,'Confirmation pauses pending shot');
 await button(page,'Battle','SURRENDER');await active(page,'Result');assert.equal(await page.evaluate(()=>window.__fleetQA.scene.getScene('Result').match.endReason),'surrender');await page.waitForTimeout(500);checks.push('Surrender while a shot is pending cancels the shot without a post-game exception');
 await context.close();
 const mobile=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true,isMobile:true,reducedMotion:'reduce'}),p=await mobile.newPage();
 p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/games/fleet-frenzy/');await p.waitForFunction(()=>!document.querySelector('#host-tools').hidden);await attachGame(p);await start(p);
 await p.waitForFunction(()=>window.__fleetQA.scene.getScene('Battle').phase==='player');const tile=await p.evaluate(()=>{const b=window.__fleetQA.scene.getScene('Battle').theirs;return {x:b.x+b.cell*9.5,y:b.y+b.cell*9.5};});const tap=await point(p,'Battle',tile.x,tile.y);const prior=await p.evaluate(()=>window.__fleetQA.scene.getScene('Battle').match.shots.player.length);await p.touchscreen.tap(tap.x,tap.y);assert.deepEqual(await p.evaluate(()=>window.__fleetQA.scene.getScene('Battle').target),{x:9,y:9});await p.touchscreen.tap(tap.x,tap.y);await p.waitForFunction(n=>window.__fleetQA.scene.getScene('Battle').match.shots.player.length===n+1,prior);checks.push('Real touch double-tap selects and fires the exact rival tile at DPR 2');const match=await p.evaluate(()=>{window.__retainedMatch=window.__fleetQA.scene.getScene('Battle').match;return window.__retainedMatch.shots.bot.length});
 await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>innerWidth===390&&innerHeight===844&&document.body.dataset.portrait==='true');
 await p.waitForFunction(()=>window.__fleetQA.scene.isPaused('Battle'));const count=await p.evaluate(()=>window.__retainedMatch.shots.bot.length);await p.keyboard.press('Enter');await p.waitForTimeout(1400);assert.equal(await p.evaluate(()=>window.__retainedMatch.shots.bot.length),count);await p.screenshot({path:out+'/portrait.png'});
 await p.setViewportSize({width:844,height:390});await p.waitForFunction(()=>innerWidth===844&&innerHeight===390&&document.body.dataset.portrait==='false');await p.locator('#host-pause').waitFor({state:'visible'});await p.locator('#host-resume').click();await active(p,'Battle');assert.equal(await p.evaluate(()=>window.__retainedMatch===window.__fleetQA.scene.getScene('Battle').match),true);await p.screenshot({path:out+'/landscape.png'});checks.push({mobile:'Portrait pauses timers and keyboard input; landscape resumes the same match',initialBotShots:match});
 await mobile.close();assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
}finally{await writeFile(out+'/report.json',JSON.stringify({origin,checks,errors,failed},null,2));console.log(JSON.stringify({origin,checks,errors,failed}));await browser.close();host?.kill();}
