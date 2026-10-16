import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stepSpring,SPRINGS,perceptualLevel} from '../js/ui/perceptual-math.js';
import {bandEffectsTimeline,particleWingState,stageEffectsAt,energyWingEnvelope} from '../js/audio/band-effects-timeline.js';
import {normalizeBandSettings} from '../js/ui/band-settings.js';

for(const parameters of [SPRINGS.panel,SPRINGS.button,{stiffness:1200,damping:80,mass:.1},{stiffness:100,damping:20,mass:1}]){
 const initial={value:.28,velocity:-.8},whole=stepSpring(initial,1,.06,parameters),half=stepSpring(stepSpring(initial,1,.03,parameters),1,.03,parameters);
 assert.ok(Math.abs(whole.value-half.value)<1e-10);assert.ok(Math.abs(whole.velocity-half.velocity)<1e-9,'frame-rate-independent position and velocity');
 let state={value:0,velocity:0};for(let i=0;i<300;i++)state=stepSpring(state,1,1/120,parameters);
 assert.ok(Math.abs(state.value-1)<.002,'all damping branches converge');
}
let panel={value:0,velocity:0},max=0;for(let i=0;i<120;i++){panel=stepSpring(panel,1,1/240);max=Math.max(max,panel.value);}
assert.ok(max>1.01&&max<1.025,'panel has a subtle physical overshoot');
const moving=stepSpring({value:0,velocity:0},1,.05),retargeted=stepSpring(moving,0,.00001);
assert.ok(Math.abs(retargeted.velocity-moving.velocity)<.02,'retargeting preserves velocity');
assert.equal(perceptualLevel(.08),0);assert.equal(perceptualLevel(-1),0);
assert.ok(perceptualLevel(1)<.95);assert.ok(Number.isFinite(perceptualLevel(2)));
for(let i=1;i<=100;i++)assert.ok(perceptualLevel(i/100)>=perceptualLevel((i-1)/100));
assert.ok(perceptualLevel(1)-perceptualLevel(.95)<perceptualLevel(.5)-perceptualLevel(.45),'highlight response has a soft knee');
assert.equal(normalizeBandSettings({pyroSound:false}).pyroSound,false);assert.equal(normalizeBandSettings({}).pyroSound,true);
const score=JSON.parse(fs.readFileSync(new URL('../output/lu-band-arrangement/bolero-trial/web/score.json',import.meta.url)));
const timeline=bandEffectsTimeline(score);assert.ok(timeline.bursts.length>0&&timeline.peak>0);
assert.ok(timeline.bursts.some(t=>Math.abs(t+.72-timeline.peak)<1e-6),'wing peak belongs to a real firework cue');
assert.equal(particleWingState(score,timeline.peak-1).power,0);
assert.equal(particleWingState(score,timeline.peak+.6).spread,1);
assert.equal(particleWingState(score,timeline.peak+.38).spread,1);
assert.equal(particleWingState(score,timeline.peak+3).power,1,'stage keeps the approved three-second hold');
assert.equal(particleWingState(score,timeline.peak+4.3).power,0);
for(const age of [-.6,-.25,0,.38,1.4,3,3.8,4.3]){
 const {power,spread,dissolve}=particleWingState(score,timeline.peak+age);
 const expected=energyWingEnvelope(age);
 for(const [key,value] of Object.entries({power,spread,dissolve}))assert.ok(Math.abs(value-expected[key])<1e-12,'close-up and song stage share the same envelope');
}
assert.equal(particleWingState(score,score.duration).power,0);
assert.equal(particleWingState(score,timeline.peak,{reduced:true}).power,0);
assert.equal(particleWingState(score,timeline.peak,{mode:'off'}).power,0);
const direct=particleWingState(score,timeline.peak+1);particleWingState(score,1);assert.deepEqual(particleWingState(score,timeline.peak+1),direct,'seek is deterministic');
assert.equal(stageEffectsAt(score,20,'off').bursts.length,0);
console.log('PASS spring frame invariance, interruption continuity, subtle overshoot, noise gate, soft knee, persisted switch and deterministic score-linked wings');
