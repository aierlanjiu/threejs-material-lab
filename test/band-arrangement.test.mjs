import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {validateArrangement} from '../js/audio/band-arrangement.js';
import {validateBandScore} from '../js/audio/band-timeline.js';
import {compileBandParts,sampleBandEnsemble} from '../js/audio/band-parts.js';
import {createBandConductor} from '../js/audio/band-conductor.js';
import {sampleBandMotion} from '../js/audio/band-layout.js';

const score=JSON.parse(fs.readFileSync(new URL('../output/lu-band-arrangement/bolero-trial/web/score.json',import.meta.url)));
assert.deepEqual(validateArrangement(score),{ok:true,errors:[]});
assert.equal(validateBandScore(score).ok,true);
const parts=compileBandParts(score,'one-piece');
assert.equal(parts.length,10);assert.equal(new Set(parts.map(p=>p.stemId)).size,10);
assert.ok(parts.every(p=>p.bindingStatus==='composed'&&!p.shared&&p.events.length));
for(const stem of score.stems){
 const bytes=fs.readFileSync(new URL('../'+stem.audio.replace(/^\.\//,''),import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),stem.audioSha256);
}
const changed=structuredClone(score);changed.arrangement.parts[0].actorId=changed.arrangement.parts[1].actorId;
assert.equal(validateArrangement(changed).ok,false,'duplicate or mismatched pet cannot take an instrument');
const participants=new Set();for(let t=60;t<78;t+=.04)for(const p of sampleBandEnsemble(score,parts,t).parts)if(p.activity>.18)participants.add(p.id);
assert.equal(participants.size,10,'all ten actually play during the ensemble, with natural note rests');
assert.ok(compileBandParts(score,'naruto').every(p=>!p.stemId),'trial cannot invent tracks for another theme');
const idle=sampleBandMotion({activity:0,idle:true},2,78,{index:3});
assert.ok(idle.actor.rotation.some(Boolean));assert.deepEqual(idle.instrument,{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
assert.deepEqual(sampleBandMotion({activity:0,idle:true},2,78,{reduced:true}).actor.position,[0,0,0]);

let time=60,playing=true;const schedules=[];
const c=createBandConductor({score,getTime:()=>time,isPlaying:()=>playing,onSchedule:(policy,at,options)=>schedules.push({policy,at,...options})});
c.setGroups(parts.map(p=>p.stemId));c.toggle('guitar');
const first=c.snapshot.restoreTime;
assert.ok(Math.abs(first-c.snapshot.pendingTime-12*60/78)<1e-9,'four bars must be twelve beats in 3/4');
time=c.snapshot.pendingTime+.01;c.tick();assert.equal(c.gain('guitar'),0);
time+=2;c.toggle('bass');const renewed=c.snapshot.restoreTime;assert.ok(renewed>first);
time=c.snapshot.pendingTime+.01;c.tick();assert.equal(c.gain('bass'),0);
playing=false;c.resetTransport({preserveChoices:true});
const frozen=c.snapshot.restoreTime;for(let i=0;i<3;i++)c.tick();assert.equal(c.snapshot.restoreTime,frozen);assert.equal(c.gain('guitar'),0);
playing=true;c.soloStart('saxophone');time=c.snapshot.pendingTime+.01;c.tick();assert.equal(c.snapshot.soloGroup,'saxophone');
assert.equal(c.snapshot.restoreTime,null,'holding solo must not be cut off by an automatic timeout');
c.soloEnd();assert.equal(c.snapshot.soloGroup,null);assert.equal(c.gain('guitar'),0);assert.equal(c.snapshot.restoreTime,renewed);
time=renewed+.05;c.tick();assert.deepEqual(c.snapshot.muted,[]);assert.equal(c.snapshot.restoreTime,null);
assert.equal(c.snapshot.history.at(-1).event.type,'auto-return');assert.deepEqual(c.snapshot.awarded,[],'automatic restoration cannot award an Easter egg');
time+=.2;c.toggle('vocals');time=c.snapshot.pendingTime+.01;c.tick();c.resetTransport();
assert.deepEqual(c.snapshot.muted,[]);assert.equal(c.snapshot.restoreTime,null,'seeking returns this short-lived intervention to automatic');
assert.ok(schedules.some(s=>s.restoreTime!==null),'audio mixer receives an independently schedulable restoration time');
console.log('PASS ten independent composed voices, source integrity, actual ensemble participation, idle motion without fake playing, 3/4 takeover, renewal, pause, held solo and automatic return');
