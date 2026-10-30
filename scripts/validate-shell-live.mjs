import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const base=process.env.LU_URL||'http://127.0.0.1:52612';
const out=path.resolve(process.env.LU_TEST_ARTIFACTS||'output/shell-live-browser');fs.mkdirSync(out,{recursive:true});
const evidence={requests:[],errors:[],console:[],steps:[],passed:false};let browser,page;
const save=()=>fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(evidence,null,2));
const deadline=setTimeout(()=>{evidence.error='150 second bounded browser deadline';save();process.exit(1);},150000);
async function snapshot(label){const data=await page.evaluate(()=>{const d=window.luBand?.diagnostics;if(!d)return null;return {selectionKey:d.selectionKey,version:d.arrangementVersion,trackId:d.trackId,time:d.time,loadError:d.loadError,playLabel:document.querySelector('#applePlayPauseBtn')?.getAttribute('aria-label'),playerMessage:document.querySelector('#nowPlayingText')?.textContent,stage:d.stage.shell,audio:d.conductor?.audio,members:d.members.map(m=>({id:m.id,position:m.position,bounds:m.bounds,layered:m.layered,layerCount:m.layerCount,renderMode:m.renderMode,spriteFrameCount:m.spriteFrameCount})),scrollWidth:document.documentElement.scrollWidth,width:innerWidth};});evidence.steps.push({label,data});save();return data;}
async function seek(seconds){await page.locator('#timeProgressSlider').evaluate((el,sec)=>{el.value=String(sec/266.29068*100);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},seconds);}
async function clickLook(name){
 // Playback intentionally hides the dock; normal pointer movement reveals it.
 await page.mouse.move(4,page.viewportSize().height-4);await page.waitForTimeout(300);
 const hit=await page.evaluate(name=>{const button=[...document.querySelectorAll('.lu-festival-switch button')].find(b=>b.getAttribute('aria-label')===name);if(!button)return null;const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,width:r.width,height:r.height,hit:button.contains(document.elementFromPoint(x,y)),disabled:button.disabled};},name);
 assert(hit&&hit.width>0&&hit.height>0&&hit.hit&&!hit.disabled,`Stage button must be visible and receive pointer input: ${name}`);
 evidence.steps.push({label:'button-hit-test',name,data:hit});await page.mouse.click(hit.x,hit.y);
}
async function clickPlay(){
 const button=await page.evaluate(()=>{const b=document.querySelector('#applePlayPauseBtn');if(!b)return null;const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,width:r.width,height:r.height,hit:b.contains(document.elementFromPoint(x,y)),label:b.getAttribute('aria-label')};});
 assert(button&&button.width>0&&button.height>0&&button.hit,'Playback button must receive pointer input');if(!/暂停/.test(button.label||''))await page.mouse.click(button.x,button.y);
}
try{
 browser=await chromium.launch({headless:true,channel:process.env.LU_TEST_BROWSER||undefined,timeout:15000,args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>{evidence.errors.push(String(e));save();});
 page.on('console',message=>{if(['warning','error'].includes(message.type()))evidence.console.push({type:message.type(),text:message.text()});});
 page.on('request',req=>{if(/band-shell-performance|band-cast-v2|band-shell-concert/.test(req.url()))evidence.requests.push(req.url());});
 await page.goto(base+'/index.html?intro=skip&band=anime_op_one_day',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.luBand,undefined,{timeout:45000});
 await page.evaluate(()=>window.luBand.setEnabled(true));
 await clickLook('珍珠贝壳');
 await page.waitForFunction(()=>window.luBand.diagnostics.stage.shell?.ready,undefined,{timeout:30000});
 await snapshot('stage-loaded');
 // The local library discovers original media asynchronously; a missing src
 // deliberately rejects playback. Wait for that independent prerequisite.
 await page.waitForFunction(()=>{const d=window.luBand.diagnostics;return Boolean(d.selectionKey?.split('|')[2])&&d.arrangementVersion===3;},undefined,{timeout:45000});
 await snapshot('media-bound');
 await clickPlay();
 await page.waitForFunction(()=>{const d=window.luBand.diagnostics,a=d.conductor?.audio;return d.arrangementVersion===3&&a?.source==='rendered-stems'&&a.ready&&a.playing&&a.contextState==='running'&&d.time>.25;},undefined,{timeout:30000});
 await page.waitForTimeout(250);
 const start=await snapshot('nine-track-playing');assert(start.selectionKey.endsWith('true'));assert.equal(start.members.filter(m=>m.renderMode==='sprite-sequence'&&m.spriteFrameCount===4&&!m.layered).length,10);assert.equal(start.audio.loaded.length,9);assert(start.audio.bed<.01);assert(start.audio.cachedChunks.length<=2);
 await page.screenshot({path:path.join(out,'desktop.png')});
 await seek(11.7);await page.waitForTimeout(1300);const boundary=await snapshot('past-12-second-boundary');assert(boundary.time>=12);assert(boundary.audio.ready);assert(boundary.audio.cachedChunks.length<=2);
 await seek(65);await page.waitForFunction(()=>{const d=window.luBand.diagnostics;return d.time>=65&&d.conductor.audio.ready;},undefined,{timeout:10000});const afterSeek=await snapshot('seek-65');assert(afterSeek.audio.cachedChunks.includes(5));
 for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.waitForTimeout(300);const state=await snapshot('mobile-'+width);assert(state.scrollWidth<=width);await page.screenshot({path:path.join(out,'mobile-'+width+'.png')});}
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'reduced-motion.png')});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await clickLook('奶油棱镜');await page.waitForFunction(()=>window.luBand.diagnostics.arrangementVersion===2,undefined,{timeout:15000});
 await clickLook('珍珠贝壳');await page.waitForFunction(()=>{const d=window.luBand.diagnostics,a=d.conductor?.audio;return d.arrangementVersion===3&&a?.ready&&a.playing&&a.bed<.01;},undefined,{timeout:15000});
 await snapshot('return-to-shell');assert.equal(evidence.errors.length,0);
 assert(evidence.requests.some(url=>/band-shell-concert\/shell-concert\.glb/.test(url)));
 assert(evidence.requests.some(url=>/band-shell-performance\/chunks\//.test(url)));
 evidence.passed=true;save();console.log('PASS live GLB, ten intact four-cel actors, legacy nine-track transport, seek, stage return and mobile widths; musical fidelity is outside this check');
}catch(error){evidence.error=String(error);if(page){try{evidence.buttons=await page.locator('button').evaluateAll(buttons=>buttons.map(b=>({html:b.outerHTML,visible:!!b.getClientRects().length})));await snapshot('failure');await page.screenshot({path:path.join(out,'failure.png')});}catch{}}save();console.error(evidence.error);process.exitCode=1;
}finally{clearTimeout(deadline);await browser?.close();}
