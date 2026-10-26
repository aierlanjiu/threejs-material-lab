import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {sampleConcertMotion,concertIslandSlots} from '../js/ui/band-concert-motion.js';

const light={beat:.7,downbeat:.4,bass:.5,wingPower:.6};
const first=sampleConcertMotion(4.3,light);
sampleConcertMotion(26,light);
assert.deepEqual(sampleConcertMotion(4.3,light),first,'seeking must not depend on previous frames');
assert.notDeepEqual(sampleConcertMotion(4.4,light),first,'playing samples advance');
for(const options of [{effectsMode:'off'},{reduced:true}]){
 const a=sampleConcertMotion(4.3,light,options),b=sampleConcertMotion(29,{beat:1,downbeat:1,wingPower:0},options);
 assert.deepEqual(a,b,'off/reduced decorations keep one stable pose and emission');
 assert.equal(a.float,0);assert.equal(a.yaw,0);assert.equal(a.crystalYaw,0);
}
assert.ok(sampleConcertMotion(4,{beat:0}).float!==0,'auto at a quiet verse retains gentle motion');
assert.ok(sampleConcertMotion(4,{downbeat:1}).emission>sampleConcertMotion(4,{}).emission);
for(let t=0;t<300;t+=.17){const pose=sampleConcertMotion(t,light);assert.ok(Math.abs(pose.float)<=.065&&Math.abs(pose.yaw)<=.035);}
for(const narrow of [false,true]){const slots=concertIslandSlots(narrow);assert.equal(slots.length,2);assert.equal(slots[0].position[0],-slots[1].position[0]);assert.ok(slots.every(s=>s.position[2]<-3.7),'decor is behind the performer placement envelope');}

const base=new URL('../assets/models/band-concert/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
assert.equal(manifest.assets.length,9);assert.ok(manifest.total_bytes<1024*1024);
let bytes=0;
for(const asset of manifest.assets){
 const data=await readFile(new URL(asset.file,base));bytes+=data.length;
 assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256,asset.id+' original model hash');
 assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
 const gltf=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
 assert.ok((gltf.extensionsRequired||[]).length===0,'no external geometry/texture decoder is required');
 assert.ok(gltf.buffers.every(b=>!b.uri||b.uri.startsWith('data:')),'model must be self-contained');
 assert.ok((gltf.images||[]).every(i=>i.bufferView!==undefined||i.uri?.startsWith('data:')),'textures must be embedded');
 assert.ok(asset.source.startsWith('https://'));assert.ok(asset.author&&asset.title);assert.match(asset.license,/CC0|CC-BY 3.0/);
}
assert.equal(bytes,manifest.total_bytes);
console.log('PASS 9 original self-contained GLBs, provenance/hashes, <1MB total, deterministic seek/pause/off/reduced and motion bounds');
