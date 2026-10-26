import assert from 'node:assert/strict';
import {stageSpec,stageBandLayout,stageHeightAt,stageClimaxAt,stageLightingAt,petFrameAt,stageLimits,spatialStageAt,spatialStemMap} from '../js/audio/band-stage-layout.js';
import {bandBeatAt} from '../js/audio/band-beat.js';
import {sampleBandMotion} from '../js/audio/band-layout.js';
import {BAND_PETS} from '../js/avatar/band-pets.js';

assert.equal(BAND_PETS.length,29);
assert.equal(new Set(BAND_PETS.map(p=>p.asset)).size,29);
assert.equal(stageSpec(false).shape,'semicircular');
assert.equal(stageSpec(true).shape,'rectangular');
assert.equal(stageSpec(true).levels,3);
assert.ok(stageSpec(true).front-stageSpec(true).back<stageSpec(true).width,'mobile stage should be wider than it is deep');
for(const count of [9,10]){
 const rows=new Map();for(const [x,y,z] of stageBandLayout(count,'terrace',true)){rows.set(y,(rows.get(y)||0)+1);}
 assert.deepEqual([...rows.values()],count===10?[3,4,3]:[3,3,3]);
}
assert.equal(stageHeightAt(0,-6,false),0,'no circular stage behind the straight rear diameter');
for(const narrow of [true,false])for(const count of [9,10])for(const formation of ['arc','terrace','ring','wings','solo']){
 const positions=stageBandLayout(count,formation,narrow,4);
 assert.equal(new Set(positions.map(p=>p.join(','))).size,count,'all performers need separate slots');
 assert.ok(positions.every(([x,y,z])=>y>0&&y===stageHeightAt(x,z,narrow)),'performers must stand on actual stair treads');
}
assert.equal(petFrameAt(2,120,0),0,'unassigned or quiet members must use their rest pose');
assert.equal(petFrameAt(2,120,1,{reduced:true}),0);
assert.equal(petFrameAt(2,120,1,{speed:0}),0);
const frames=Array.from({length:16},(_,i)=>petFrameAt(i/16,120,1));
assert.equal(new Set(frames).size,2,'sustained notes breathe between the two quiet playing frames');
assert.equal(petFrameAt(1.03,120,1,{attack:.8}),3,'a strong onset must select the accented frame');
assert.equal(petFrameAt(1.03,120,1,{attack:.8,reduced:true}),0);
for(const narrow of [true,false]){
 const solo=stageBandLayout(10,'solo',narrow,4),front=solo[4];
 assert.ok(solo.every((p,i)=>i===4||p[2]<front[2]-2),'soloist stands ahead of all accompaniment');
 const wings=stageBandLayout(10,'wings',narrow);assert.ok(wings.every(p=>Math.abs(p[0])>2),'wings leave a central aisle');
 const signatures=new Set(['arc','terrace','ring','wings','solo'].map(f=>JSON.stringify(stageBandLayout(10,f,narrow))));assert.equal(signatures.size,5);
}
assert.equal(petFrameAt(3.125,150,.9),petFrameAt(3.125,150,.9),'sprite selection follows the song time, not wall time');
const score={duration:30,bpmEstimate:120,beatTimes:[0,.5,1,1.5,2,2.5,3],timeSignature:[4,4],stems:[{id:'drums',envelope:[{time:0,value:.1},{time:8,value:.1},{time:12,value:1},{time:16,value:1},{time:20,value:.1},{time:30,value:.1}]}]};
const downbeatAccent=bandBeatAt(score,2.01);
const offbeatAccent=bandBeatAt(score,2.51);
assert.equal(downbeatAccent.index,4);assert.ok(downbeatAccent.downbeat>.9&&downbeatAccent.pulse>.9);
assert.equal(offbeatAccent.index,5);assert.equal(offbeatAccent.downbeat,0);assert.ok(offbeatAccent.pulse>.9);
assert.deepEqual(bandBeatAt(score,2.01),downbeatAccent,'beat grid lookup is deterministic across seeks');
const basePose=sampleBandMotion({activity:.8,attack:.2},2.01,120,{technique:'pluck',index:1});
const accentedPose=sampleBandMotion({activity:.8,attack:.2},2.01,120,{technique:'pluck',index:1,beatPulse:downbeatAccent.pulse,downbeat:downbeatAccent.downbeat});
assert.ok(Math.abs(accentedPose.instrument.rotation[2])>Math.abs(basePose.instrument.rotation[2]),'beat accents amplify active instrument motion');
assert.deepEqual(stageClimaxAt(score,2),{energy:.1,intensity:0,bursts:[]});
const peak=stageClimaxAt(score,14.5);assert.ok(peak.intensity>0&&peak.bursts.length>0);
stageClimaxAt(score,29);assert.deepEqual(stageClimaxAt(score,14.5),peak,'seeking back must reconstruct the same fireworks');
assert.deepEqual(stageClimaxAt(score,14.5,'off'),{energy:0,intensity:0,bursts:[]});
assert.equal(stageClimaxAt(score,2,'preview').intensity,1);
assert.equal(stageClimaxAt(score,30,'preview').bursts.length,0,'effects stop at track end');
const light=stageLightingAt(score,14.5,peak);assert.ok(light.lift>stageLightingAt(score,2,stageClimaxAt(score,2)).lift);
assert.deepEqual(stageLightingAt(score,14.5,peak),light,'camera and lights must be reconstructed by song time after a seek');
assert.equal(stageLightingAt(score,14.5,peak,true).cameraShift,0);
assert.equal(stageLightingAt(score,14.5,peak,true).climax,0);
assert.equal(stageLightingAt(score,2.01,stageClimaxAt(score,2.01),true).beat,0);
assert.equal(stageLightingAt(score,2.01,stageClimaxAt(score,2.01),true).downbeat,0);
const lim=stageLimits(false);
const leftRear=spatialStageAt(-lim.x,lim.back,false);
const rightFront=spatialStageAt(lim.x,lim.front,false);
assert.equal(leftRear.pan,-.85,'far left wing maps to -0.85 stereo pan');
assert.equal(rightFront.pan,.85,'far right wing maps to +0.85 stereo pan');
assert.ok(leftRear.depthGain<.9&&rightFront.depthGain>1.1,'front stage edge boosts depth presence over rear riser');
assert.ok(leftRear.shelfDb<-2&&rightFront.shelfDb>2.5,'front stage edge boosts 3.2kHz air shelf over rear riser');
const stemSpatial=spatialStemMap(
 [{id:'one-piece/zoro',position:[-9.5,1,6.8],activity:.8},{id:'one-piece/luffy',position:[0,1,7.8],activity:.9}],
 [{id:'one-piece/zoro',stemId:'guitar',originalStemId:'guitar'},{id:'one-piece/luffy',stemId:'vocals',originalStemId:'vocals'}],
 {narrow:false,draggingId:'one-piece/zoro',placedIds:['one-piece/zoro']}
);
assert.ok(stemSpatial.guitar.pan<-.7&&stemSpatial.guitar.depthGain>1.05,'dragged guitarist steers guitar stem pan and depth presence');
assert.equal(stemSpatial.vocals.pan,0,'center front vocalist remains centered');
console.log('PASS 29 unique pets, grounded half-circle/rectangular stages, note-driven frames, beat-grid accents, spatial stage coupling, quiet/reduced states and seek-stable climax effects');
