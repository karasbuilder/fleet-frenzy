import assert from 'node:assert/strict';
export async function attachGame(page,frame=page){
 const cd=await page.context().newCDPSession(page),contexts=[];
 cd.on('Runtime.executionContextCreated',e=>contexts.push(e.context));await cd.send('Runtime.enable');
 const tree=await cd.send('Page.getFrameTree');
 const walk=t=>[t.frame,...(t.childFrames||[]).flatMap(walk)],target=walk(tree.frameTree).find(f=>f.url===frame.url());
 assert.ok(target,'Game frame exists');const context=contexts.find(c=>c.auxData?.frameId===target.id&&c.auxData?.isDefault);assert.ok(context);
 const prototype=await cd.send('Runtime.evaluate',{contextId:context.id,expression:"(async()=>{const m=await import(document.querySelector('link[rel=modulepreload]').href);return Object.values(m).find(x=>x&&x.Game).Game.prototype})()",awaitPromise:true});
 assert.ok(prototype.result.objectId,JSON.stringify(prototype));
 const q=await cd.send('Runtime.queryObjects',{prototypeObjectId:prototype.result.objectId});
 await cd.send('Runtime.callFunctionOn',{objectId:q.objects.objectId,functionDeclaration:'function(){for(const g of this)if(g.canvas?.ownerDocument)g.canvas.ownerDocument.defaultView.__fleetQA=g}',returnByValue:true});
 await cd.detach();
}
export async function point(frame,key,x,y){return frame.evaluate(({key,x,y})=>{
 const g=window.__fleetQA,c=g.scene.getScene(key).cameras.main,a=c.getWorldPoint(0,0),b=c.getWorldPoint(1,0),d=c.getWorldPoint(0,1),u={x:b.x-a.x,y:b.y-a.y},v={x:d.x-a.x,y:d.y-a.y},det=u.x*v.y-u.y*v.x,dx=x-a.x,dy=y-a.y,r=g.canvas.getBoundingClientRect();
 return {x:r.x+(dx*v.y-dy*v.x)/det*r.width/g.canvas.width,y:r.y+(dy*u.x-dx*u.y)/det*r.height/g.canvas.height};
},{key,x,y});}
export async function clickWorld(page,key,x,y){const p=await point(page,key,x,y);await page.mouse.click(p.x,p.y);}
export async function button(page,key,text){const p=await page.evaluate(({key,text})=>{
 const s=window.__fleetQA.scene.getScene(key),b=s.children.list.filter(o=>o.o?.text===text).at(-1);if(!b)throw Error('Missing button '+text);return {x:b.x,y:b.y};
},{key,text});await clickWorld(page,key,p.x,p.y);}
export async function active(page,key){await page.waitForFunction(key=>window.__fleetQA.scene.isActive(key),key);}
export async function resume(page){if(await page.locator('#host-pause').isVisible())await page.locator('#host-resume').click();}
export async function start(page,level='CADET'){
 await active(page,'Menu');await resume(page);await button(page,'Menu',level);await button(page,'Menu','PLAY');await active(page,'Placement');
 await button(page,'Placement','SHUFFLE');await button(page,'Placement','ROTATE');await button(page,'Placement','START BATTLE');await active(page,'Battle');
 await page.evaluate(()=>window.__fleetQA.scene.getScene('Battle').time.timeScale=30);
}
export async function fire(page,c){const p=await page.evaluate(c=>{const b=window.__fleetQA.scene.getScene('Battle').theirs;return {x:b.x+(c.x+.5)*b.cell,y:b.y+(c.y+.5)*b.cell}},c);await clickWorld(page,'Battle',p.x,p.y);await page.keyboard.press('Enter');}
