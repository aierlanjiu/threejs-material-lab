import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = cb => { if (cb.name === 'animate') window.nextLuTestFrame = cb; return 1; };
  });
  await page.goto('http://localhost:8000/index.html?intro=skip');
  await page.waitForFunction(() => window.luDiagnostics && window.nextLuTestFrame);
  const result = await page.evaluate(() => {
    const d = luDiagnostics; d.composer.render = () => {};
    state.isPlayingMusic = state.audioReady = true;
    state.isIntroPlaying = state.enableTitleIntro = false;
    state.isChoreographyShow = false; state.matrixSequence = 'locked';
    state.activeFormation = state.formationMode = 'grid';
    state.enableDynamicFov = false; state.camMotionMode = 'off';
    let now = performance.now();
    const click = selector => document.querySelector(selector).click();
    const tick = count => { for (let i=0;i<count;i++) {
      state.bassEnergy=.6; state.midEnergy=.4; state.trebleEnergy=.3; state.beatPulse=.6;
      window.nextLuTestFrame(now+=50);
    } };
    const contentCount = () => d.matrixGroup.children.reduce((n,u)=>n+u.userData.contentCount,0);
    const vectors = () => d.matrixGroup.children.map(u=>[u.userData.target.y,u.userData.target.rotX,u.userData.target.rotY]);
    tick(2);
    const waves = {};
    for (const pattern of ['ripple','diagonal','equalizer','spiral','heartbeat','glitch']) {
      click(`#wavePatternGroup [data-pattern="${pattern}"]`);
      state.waveAccumulator=2; state.beatCount=2; state.beatPhase=.2; tick(1);
      waves[pattern]=vectors();
    }
    click('#avatarDistGroup [data-dist="center"]');
    const counts = { center: (tick(1),contentCount()) };
    state.isChoreographyShow=true;
    for (const beat of [16,32,48,64,80]) { state.beatCount=beat; window.updateMasterChoreography(); tick(1); }
    const kept = {wave:state.wavePattern,avatar:state.avatarDist,count:contentCount()};
    click('#wavePatternAutoToggle'); click('#avatarDistAutoToggle');
    state.beatCount=32; window.updateMasterChoreography(); tick(1);
    const automatic = {wave:state.wavePattern,avatar:state.avatarDist,
      shownAvatar:document.querySelector('#avatarDistGroup .active').dataset.dist};
    state.isChoreographyShow=false;
    for(const dist of ['all','variety','mosaic']) {
      click(`#avatarDistGroup [data-dist="${dist}"]`); tick(1); counts[dist]=contentCount();
    }
    const mosaicWaves={};
    for(const pattern of Object.keys(waves)) {
      click(`#wavePatternGroup [data-pattern="${pattern}"]`);
      state.waveAccumulator=2; tick(1); mosaicWaves[pattern]=vectors()[0][0];
    }
    click('#avatarDistGroup [data-dist="all"]');
    const tiers=[];
    for(const tier of [1,2,3]) {
      click(`#intensityTierGroup [data-tier="${tier}"]`); tick(1);
      const scales=[];
      for(let i=0;i<20;i++) { state.beatPhase=i/20; tick(1); scales.push(d.matrixGroup.children[0].userData.motion.targetScaleY); }
      tiers.push(Math.max(...scales)-Math.min(...scales));
    }
    const amplitudes=[];
    for(const value of [.2,1]) {
      const el=document.querySelector('#waveAmpSlider'); el.value=value; el.dispatchEvent(new Event('input',{bubbles:true}));
      const samples=[];
      for(let i=0;i<60;i++) { state.beatCount=i%2; state.beatPhase=i%10/10; tick(1); samples.push(d.matrixGroup.position.y); }
      amplitudes.push(Math.max(...samples)-Math.min(...samples));
    }
    click('#waveMotionToggle'); tick(80);
    const stopped={lift:d.matrixGroup.position.y,yaw:d.matrixGroup.rotation.y};
    click('#waveMotionToggle');
    const cadence={}; state.isChoreographyShow=true; state.formationMode='auto';
    for(const tier of [1,3]) {
      click(`#intensityTierGroup [data-tier="${tier}"]`);
      for(const freq of [4,8,16,32]) {
        click(`#morphFreqGroup [data-freq="${freq}"]`);
        state.beatCount=0; window.updateMasterChoreography(); const first=state.activeFormation;
        state.beatCount=freq-1; window.updateMasterChoreography(); const before=state.activeFormation;
        state.beatCount=freq; window.updateMasterChoreography(); cadence[`${tier}/${freq}`]={first,before,after:state.activeFormation};
      }
    }
    click('#gridPresetGroup [data-size="3x3"]'); tick(1);
    state.beatCount=128; window.updateMasterChoreography(); tick(1);
    const grid={cols:state.gridCols,rows:state.gridRows,sequence:state.matrixSequence};
    state.isChoreographyShow=false; state.formationMode=state.activeFormation='grid';
    const modes={};
    for(const mode of ['material','avatar','text','image']) {
      click(`#contentModeGroup [data-mode="${mode}"]`); tick(1);
      modes[mode]={count:contentCount(),disabled:document.querySelector('#layerModeGroup button').disabled};
    }
    click('#contentModeGroup [data-mode="avatar"]'); tick(1);
    const layers={}; const crafts={};
    for(const layer of ['surface','inside','back']) {
      click(`#layerModeGroup [data-layer="${layer}"]`); tick(1);
      const unit=d.matrixGroup.children[0];
      layers[layer]={children:unit.children.length,z:unit.children[1]?.position.z};
      for(const craft of ['conformal','emboss','hologram']) {
        click(`#adhesionCraftGroup [data-craft="${craft}"]`); tick(1);
        const unit=d.matrixGroup.children[0],m=unit.children.at(-1).material;
        const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:
          '#include <common>\n#include <map_fragment>\n#include <emissivemap_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <normal_fragment_maps>\n#include <transmission_fragment>'};
        m.onBeforeCompile(shader); crafts[`${layer}/${craft}`]=shader.fragmentShader;
      }
    }
    state.isPlayingMusic=state.audioReady=false;
    click('#camMotionGroup [data-cam-mode="on"]');
    click('#orbitModeGroup [data-orbit="full"]'); tick(40);
    const start=d.camera.position.clone(); tick(100); const orbitDistance=d.camera.position.distanceTo(start);
    click('#camMotionGroup [data-cam-mode="off"]'); const off=d.camera.position.clone(); tick(40);
    const offDrift=d.camera.position.distanceTo(off);
    const fov=document.querySelector('#fov');fov.value=72;fov.dispatchEvent(new Event('input',{bubbles:true}));tick(80);
    const optics={};
    for(const [id,value]of Object.entries({roughness:.35,ior:1.8,thickness:.9,transmission:.7,dispersion:.12})) {
      const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));tick(1);
      optics[id]=d.matrixGroup.children[0].children[0].material[id];
    }
    const originalGeometry=d.matrixGroup.children[0].children[0].geometry;
    for(const [id,value]of Object.entries({bevelRadius:.28,envIntensity:2.5,light:.16,bloom:.12})) {
      const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));tick(1);
    }
    const opticalExtras={geometryChanged:originalGeometry!==d.matrixGroup.children[0].children[0].geometry,
      env:d.matrixGroup.children[0].children[0].material.envMapIntensity,
      bloom:d.composer.passes[1].strength,light:d.scene.children.find(o=>o.isLight&&o.castShadow)?.intensity};
    const lens={};state.enableDynamicFov=true;
    for(const mode of ['bass','dolly','sine','snap']) {
      click(`#fovModeGroup [data-fmode="${mode}"]`);const samples=[];
      for(let i=0;i<150;i++){state.beatCount=Math.floor(i/10);tick(1);samples.push(d.camera.fov);}
      lens[mode]={min:Math.min(...samples),range:Math.max(...samples)-Math.min(...samples)};
    }
    state.enableDynamicFov=false;tick(80);
    return {waves,mosaicWaves,kept,automatic,counts,tiers,amplitudes,stopped,cadence,grid,modes,layers,crafts,orbitDistance,offDrift,fov:d.camera.fov,optics,opticalExtras,lens};
  });
  assert.equal(new Set(Object.values(result.waves).map(v=>JSON.stringify(v))).size,6,'all six waveforms must produce distinct poses');
  assert.equal(new Set(Object.values(result.mosaicWaves).map(v=>v.toFixed(5))).size,6,'mosaic must respond to all waveforms');
  assert.deepEqual(result.kept,{wave:'glitch',avatar:'center',count:1},'manual choices must survive five chapters');
  assert.equal(result.automatic.shownAvatar,result.automatic.avatar,'automatic avatar choices must update the selected button');
  assert.notEqual(result.automatic.wave,'glitch','automatic waveform control must resume');
  assert.ok(result.counts.all>1 && result.counts.mosaic>1 && result.counts.variety>1);
  assert.ok(result.tiers[0]<result.tiers[1] && result.tiers[1]<result.tiers[2],'three tiers must increase motion range');
  assert.ok(result.amplitudes[1]>result.amplitudes[0]*2.5,'amplitude must affect visible whole-matrix movement');
  assert.ok(Math.abs(result.stopped.lift)<.001 && Math.abs(result.stopped.yaw)<.001,'soundwave off must settle to rest');
  for(const [key,c] of Object.entries(result.cadence)) assert.ok(c.first===c.before && c.after!==c.first,`wrong beat cadence ${key}`);
  assert.deepEqual(result.grid,{cols:3,rows:3,sequence:'locked'},'manual matrix dimensions must stay during music');
  assert.equal(result.modes.material.count,0);assert.equal(result.modes.material.disabled,true);
  assert.ok(result.modes.avatar.count>0 && result.modes.text.count>0);
  assert.equal(result.modes.image.count,0,'empty image mode must not show an avatar');
  assert.equal(result.layers.surface.children,1);assert.equal(result.layers.inside.z,0);assert.equal(result.layers.back.z,-.508);
  for(const layer of ['surface','inside','back']) assert.equal(new Set(['conformal','emboss','hologram'].map(c=>result.crafts[`${layer}/${c}`])).size,3,`${layer} crafts must differ`);
  assert.ok(result.orbitDistance>.5 && result.offDrift<.001);
  assert.ok(Math.abs(result.fov-72)<.05);
  assert.deepEqual(result.optics,{roughness:.35,ior:1.8,thickness:.9,transmission:.7,dispersion:.12});
  assert.ok(result.opticalExtras.geometryChanged && result.opticalExtras.env>0);
  assert.ok(Math.abs(result.opticalExtras.bloom-.12)<.001 && Math.abs(result.opticalExtras.light-2.4)<.001);
  assert.ok(result.lens.bass.min<71);for(const mode of ['dolly','sine','snap'])assert.ok(result.lens[mode].range>1);
  assert.deepEqual(errors,[]);
  const {waves,mosaicWaves,crafts,...summary}=result;
  console.log('LÜ mechanical control functionality PASS',JSON.stringify(summary));
} finally { await browser.close(); }
