import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBandDemoScore} from '../js/audio/band-timeline.js';
import {BAND_ROSTERS,compileBandParts,sampleBandPart,sampleBandEnsemble} from '../js/audio/band-parts.js';
import {BAND_FORMATIONS,formationAt,layoutBand,sampleBandMotion} from '../js/audio/band-layout.js';
import {defaultBandSettings,normalizeBandSettings} from '../js/ui/band-settings.js';
import {bandRecordingLayout} from '../js/ui/band-recording-layout.js';

assert.deepEqual(Object.values(BAND_ROSTERS).map(r=>r.length),[10,10,9]);
assert.equal(new Set(Object.values(BAND_ROSTERS).flat().map(r=>r.id)).size,29);
const landscape=bandRecordingLayout(1920,1080),portrait=bandRecordingLayout(1080,1920);
assert.equal(landscape.narrow,false);assert.equal(portrait.narrow,true);
assert.ok(landscape.score.width<1920*.35&&landscape.score.height<1080*.18,'landscape score must not grow to a phone-sized full-width overlay');
assert.ok(portrait.score.x>=0&&portrait.score.x+portrait.score.width<=1080);
assert.equal(landscape.logicalWidth/landscape.logicalHeight,1920/1080);
const demo=createBandDemoScore(),parts=compileBandParts(demo,'one-piece');
const expected=sampleBandEnsemble(demo,parts,12.25);
sampleBandEnsemble(demo,parts,30);sampleBandEnsemble(demo,parts,2);
assert.deepEqual(sampleBandEnsemble(demo,parts,12.25),expected,'seek must rebuild the same ensemble');
assert.ok(sampleBandEnsemble(demo,parts,32).parts.every(p=>p.activity===0&&p.notes.length===0));
const empty={id:'test',stemId:'other',events:[],endPrefix:[]};
assert.equal(sampleBandPart(empty,2,{stems:{other:{energy:1}}}).activity,0,'source energy alone cannot make an unassigned member play');
for(const count of [9,10])for(const f of BAND_FORMATIONS)for(const narrow of [false,true]){
 const positions=layoutBand(count,f.id,narrow,4);assert.equal(positions.length,count);
 assert.equal(new Set(positions.map(p=>p.join(','))).size,count,`${f.id} must have distinct slots`);
 assert.ok(positions.flat().every(Number.isFinite));
}
assert.equal(formationAt(15.99,demo).id,'arc');assert.equal(formationAt(16,demo).id,'terrace');
assert.equal(formationAt(16,demo).mix,0);assert.equal(formationAt(17.6,demo).mix,1);
const identities=Object.keys(BAND_ROSTERS).map(t=>compileBandParts(demo,t));
for(const roster of identities)for(const part of roster){
 const stopped=sampleBandMotion({activity:0,attack:1},1,120,{technique:part.technique});
 assert.deepEqual(stopped.actor,{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
 assert.deepEqual(sampleBandMotion({activity:1,attack:1},1,120,{reduced:true}),stopped);
 const pose=sampleBandMotion({activity:.8,energy:.8,attack:.9},1.13,150,{technique:part.technique,index:3,actorMotion:2,instrumentMotion:2});
 assert.ok([...pose.actor.position,...pose.instrument.position].every(v=>Math.abs(v)<=.18));
 assert.ok([...pose.actor.rotation].every(v=>Math.abs(v)<=.15));
 assert.ok([...pose.instrument.rotation].every(v=>Math.abs(v)<=.45));
 assert.notDeepEqual(pose.actor,pose.instrument,'instrument and actor must not mirror each other');
}
const bad=normalizeBandSettings({actorSize:999,instrumentSize:NaN,actorMotion:-1,formation:'bad',overrides:{'one-piece/luffy':{gap:20},'../secret':{actorSize:1}}});
assert.equal(bad.actorSize,1.6);assert.equal(bad.instrumentSize,.8);assert.equal(bad.actorMotion,0);assert.equal(bad.formation,'auto');assert.equal(bad.overrides['one-piece/luffy'].gap,.6);assert.equal(bad.overrides['../secret'],undefined);
if(process.argv.includes('--analysis')){
 const real=JSON.parse(readFileSync(new URL('../output/lu-band/anime_op_we_are/score.json',import.meta.url)));
 const realParts=compileBandParts(real,'one-piece');assert.equal(realParts.length,10);assert.ok(realParts.every(p=>p.events.length>0));
 const guitar=realParts.find(p=>p.id.endsWith('/usopp')),harp=realParts.find(p=>p.id.endsWith('/robin'));
 assert.notDeepEqual(guitar.events,harp.events,'shared source must yield distinct assigned notes');
 const sharedNotes=realParts.filter(p=>p.stemId==='other').flatMap(p=>p.events);
 assert.equal(new Set(sharedNotes).size,sharedNotes.length,'automatic shared-source parts must not duplicate note events');
 const extra={...real,stems:[...real.stems,{...real.stems.find(s=>s.id==='other'),id:'piano',label:'键盘音轨'}]};
 const custom=compileBandParts(extra,'one-piece',{'one-piece/law':{stem:'piano',technique:'keys'}}).find(p=>p.id.endsWith('/law'));
 assert.equal(custom.stemId,'piano');assert.equal(custom.events.length,extra.stems.at(-1).events.length,'additional source counts are not fixed to four');
 console.log('PASS real-song part assignment, distinct shared-source notes and expandable source mapping');
}
console.log('PASS 29-member rosters, five formations, independent gestures, quiet states, seek determinism and setting limits');
