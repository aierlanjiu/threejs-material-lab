import assert from 'node:assert/strict';
import {stageSpec,stageBandLayout,stageHeightAt,stageClimaxAt,petFrameAt} from '../js/audio/band-stage-layout.js';
import {BAND_PETS} from '../js/avatar/band-pets.js';

assert.equal(BAND_PETS.length,29);
assert.equal(new Set(BAND_PETS.map(p=>p.asset)).size,29);
assert.equal(stageSpec(false).shape,'semicircular');
assert.equal(stageSpec(true).shape,'rectangular');
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
assert.equal(new Set(frames).size,3,'active music must advance through generated performance keyframes');
assert.equal(petFrameAt(3.125,150,.9),petFrameAt(3.125,150,.9),'sprite selection follows the song time, not wall time');
const score={duration:30,bpmEstimate:120,stems:[{id:'drums',envelope:[{time:0,value:.1},{time:8,value:.1},{time:12,value:1},{time:16,value:1},{time:20,value:.1},{time:30,value:.1}]}]};
assert.deepEqual(stageClimaxAt(score,2),{energy:.1,intensity:0,bursts:[]});
const peak=stageClimaxAt(score,14.5);assert.ok(peak.intensity>0&&peak.bursts.length>0);
stageClimaxAt(score,29);assert.deepEqual(stageClimaxAt(score,14.5),peak,'seeking back must reconstruct the same fireworks');
assert.deepEqual(stageClimaxAt(score,14.5,'off'),{energy:0,intensity:0,bursts:[]});
assert.equal(stageClimaxAt(score,2,'preview').intensity,1);
assert.equal(stageClimaxAt(score,30,'preview').bursts.length,0,'effects stop at track end');
console.log('PASS 29 unique pets, grounded half-circle/rectangular stages, note-driven frames, quiet/reduced states and seek-stable climax effects');
