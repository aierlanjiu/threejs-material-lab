import assert from 'node:assert/strict';
import {createBandConductor,nextBandBeat} from '../js/audio/band-conductor.js';
const score={duration:50,bpmEstimate:120,beatTimes:Array.from({length:101},(_,i)=>i*.5)};
let time=5,playing=false;const schedules=[],awards=[];
const c=createBandConductor({score,getTime:()=>time,isPlaying:()=>playing,onSchedule:(p,t)=>schedules.push({p,t}),onAward:e=>awards.push(e)});
c.setGroups(['voice','drums','bass','guitar']);
for(const id of ['voice','drums','bass','guitar'])c.toggle(id);
assert.deepEqual(awards,[],'editing while paused cannot unlock a performance');
playing=true;
for(const [i,id] of ['voice','drums','bass','guitar'].entries()){
 time=10.46+i*.5;c.toggle(id);assert.equal(schedules.at(-1).t,10.5+i*.5);
 c.tick();assert.equal(c.gain(id),0,'audio and actor remain resting until the target beat');
 time=10.501+i*.5;c.tick();assert.equal(c.gain(id),1);
}
assert.deepEqual(awards.map(e=>e.id),['on-beat']);
assert.equal(c.toggle('not-a-part'),false);
for(const [i,id] of ['voice','drums','bass'].entries()){
 time=14.46+i*2;c.soloStart(id);time=14.501+i*2;c.tick();
 assert.equal(c.gain(id),1);assert.equal(c.gain('guitar'),0);
 time=15.46+i*2;c.soloEnd();time=15.501+i*2;c.tick();
 assert.equal(c.gain('guitar'),1,'releasing a solo restores the previous full mix');
}
assert.deepEqual(awards.map(e=>e.id),['on-beat','relay']);
time=35.46;c.toggle('bass');time=35.501;c.tick();
time=36.46;c.soloStart('voice');time=36.501;c.tick();time=37.46;c.soloEnd();time=37.501;c.tick();
assert.equal(c.gain('bass'),0,'solo release restores pre-existing mutes');
time=45.46;c.all();time=45.501;c.tick();assert.deepEqual(awards.map(e=>e.id),['on-beat','relay','curtain']);
time=46.46;c.all();time=46.501;c.tick();assert.equal(awards.length,3,'awards fire once per song performance');
const before=awards.length;time=47.46;c.soloStart('guitar');time=2;c.resetTransport();c.tick();
assert.equal(c.snapshot.soloGroup,null);assert.equal(c.snapshot.effect,null);assert.equal(awards.length,before,'seeking cannot apply queued awards or leave solo latched');
playing=false;time=49;c.toggle('voice');c.all();assert.equal(awards.length,before);
time=0;c.restartPerformance();assert.deepEqual(c.snapshot.awarded,[]);assert.equal(c.gain('voice'),1);
playing=true;time=44.46;c.toggle('bass');time=44.501;c.tick();time=45.46;c.all();time=45.501;c.tick();assert.equal(awards.length,before+1,'a new performance can unlock the Easter eggs again');
assert.equal(nextBandBeat({bpmEstimate:120},2.1),2.5);
const silentAwards=[];playing=true;
const silent=createBandConductor({score,getTime:()=>time,isPlaying:()=>playing,isGroupAudible:()=>false,onAward:e=>silentAwards.push(e)});silent.setGroups(['a','b','c']);
for(const [i,id] of ['a','b','c'].entries()){time=10+i;silent.soloStart(id);time+=.6;silent.tick();silent.soloEnd();time+=.6;silent.tick();}
assert.deepEqual(silentAwards,[],'soloing silent sources cannot unlock an audible relay');
console.log('PASS beat scheduling, audible state, held-solo restoration, existing mutes, three performance Easter eggs, seek cancellation and paused/no-op abuse prevention');
