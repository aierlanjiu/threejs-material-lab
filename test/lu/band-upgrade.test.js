import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.LU_TEST_BASE_URL||'http://localhost:8000';
const browser=await chromium.launch({headless:true,channel:process.env.LU_TEST_BROWSER||undefined});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*error/.test(m.text()))errors.push(m.text());});
 await page.goto(base+'/test/band-upgrade.browser.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.runBandUpgrade==='function');
 const result=await page.evaluate(()=>window.runBandUpgrade());
 assert.equal(result.checks.length,8);assert.deepEqual(errors,[]);
 console.log('PASS '+result.checks.join('; '));
 await page.goto(base+'/index.html?intro=skip',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.luBand?.enabled&&window.luApplePlayer);
 await page.locator('#applePlayPauseBtn').click();
 await page.waitForFunction(()=>window.state.isPlayingMusic&&window.luBand.diagnostics.conductor?.ready);
 const cadence=await page.evaluate(async()=>{
  const before=window.luBand.diagnostics,start=performance.now(),intervals=[];let callbacks=0,last=start;
  await new Promise(resolve=>{const frame=now=>{callbacks++;intervals.push(now-last);last=now;if(now-start>=2000)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);});
  const elapsed=performance.now()-start,after=window.luBand.diagnostics,sorted=intervals.slice(1).sort((a,b)=>a-b);
  return {callbacks,frames:after.cadence.frames-before.cadence.frames,uiSyncs:after.cadence.uiSyncs-before.cadence.uiSyncs,renderFps:(after.fullFrame.renderCount-before.fullFrame.renderCount)*1000/elapsed,intervalP95:sorted[Math.floor(sorted.length*.95)],elapsed};
 });
 assert(cadence.frames>=cadence.callbacks*.8,'band must follow native RAF cadence instead of skipping every other frame');
 assert(cadence.uiSyncs<=cadence.elapsed/32+6,'heavy UI must stay near 30Hz');
 console.log('PASS live playback/render cadence '+JSON.stringify(cadence));
 await page.locator('#applePlayPauseBtn').click();
 assert.deepEqual(errors,[],'fixture and live playback must remain free of browser errors');
}finally{await browser.close();}
