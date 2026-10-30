async(page)=>{
 const assert=(ok,label)=>{if(!ok)throw new Error(label);};
 const base=new URL('./',page.url()).href,checks=[];
 const seek=async seconds=>{
  await page.locator('#appleScrubInput').evaluate((el,t)=>{
   el.value=String(t/window.__wingScore.duration*100);
   el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  },seconds);
 };
 for(const [track,theme,ids] of [
  ['pianai','one-piece',['luffy','zoro','nami']],
  ['anime_db_chala','dragon-ball',['goku','vegeta','bulma']],
  ['anime_nr_blue_bird','naruto',['naruto','sasuke','sakura']]
 ]){
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1440,height:900});
  await page.goto(base+'index.html?intro=skip&band='+track);
  await page.waitForFunction(()=>window.luBand?.diagnostics.conductor?.ready);
  const peak=await page.evaluate(async()=>{
   const d=window.luBand.diagnostics;d.settings.effects='auto';d.settings.formation='terrace';
   const catalog=await(await fetch(new URL('assets/band-audio/catalog.json',location.href))).json();
   const track=catalog.tracks.find(t=>t.id===d.trackId);
   window.__wingScore=await(await fetch(new URL(track.score,location.href))).json();
   return d.wings.peak;
  });
  assert(Number.isFinite(peak),'song must have a real climax cue');
  await page.getByRole('button',{name:'播放',exact:true}).click();
  await page.waitForFunction(()=>window.luBand.diagnostics.conductor.audio.player.running);
  await seek(peak+1);
  await page.waitForFunction(()=>window.luBand.diagnostics.wings.power>.9);
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  const expected=ids.map(id=>theme+'/'+id);
  const read=()=>page.evaluate(()=>{const d=window.luBand.diagnostics;return {
   theme:d.theme,time:d.time,formation:d.formation,voiceEvents:d.parts[0].events,
   wings:d.wings,petCount:d.petCount
  };});
  const initial=await read();
  assert(initial.voiceEvents===0,'regression fixture must use recorded vocals without MIDI notes');
  assert(JSON.stringify(initial.wings.members.map(m=>m.id))===JSON.stringify(expected),'each theme must equip its front trio, including the singer');
  assert(initial.wings.members.every(m=>m.visible&&m.power>.9),'all three wings must render at the real song climax');
  for(const [width,height,particles] of [[1440,900,8688],[390,844,5808]]){
   await page.setViewportSize({width,height});
   await page.waitForFunction(n=>window.luBand.diagnostics.wings.members.every(m=>m.particles===n),particles);
   const d=await read();
   assert(d.wings.members.every(m=>m.visible&&m.pureParticles&&m.occluders===d.petCount-1),'wings stay behind other characters in both viewports');
   await page.screenshot({path:'output/playwright/band-front-wings/'+theme+'-'+width+'.png'});
  }
  for(const formation of ['arc','terrace','ring','wings','solo']){
   await page.evaluate(f=>{window.luBand.diagnostics.settings.formation=f;},formation);
   await page.waitForFunction(f=>window.luBand.diagnostics.formation===f,formation);
   assert((await read()).wings.members.every(m=>m.visible),'equipped trio follows formation changes');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>window.luBand.diagnostics.wings.members.every(m=>!m.visible));
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>window.luBand.diagnostics.wings.members.every(m=>m.visible));
  await page.evaluate(()=>{window.luBand.diagnostics.settings.effects='off';});
  await page.waitForFunction(()=>window.luBand.diagnostics.wings.members.every(m=>!m.visible));
  await page.evaluate(()=>{window.luBand.diagnostics.settings.effects='auto';});
  await page.waitForFunction(()=>window.luBand.diagnostics.wings.members.every(m=>m.visible));
  const paused=(await read()).time;await page.waitForTimeout(150);
  assert(Math.abs((await read()).time-paused)<.01,'paused wings keep the song clock');
  await seek(0);
  await page.waitForFunction(()=>window.luBand.diagnostics.wings.members.every(m=>!m.visible));
  await seek(paused);
  await page.waitForFunction(()=>window.luBand.diagnostics.wings.members.every(m=>m.visible));
  checks.push({track,theme,members:expected,recordedSingerVisible:true,peak,viewports:[1440,390],formations:5,reduced:true,off:true,pause:true,seek:true});
 }
 await page.evaluate(result=>{window.__frontWingsQA=result;},{status:'pass',checks});
}
