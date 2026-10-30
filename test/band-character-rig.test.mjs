import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {RIG_ROLES,rehearsalSample,sampleCharacterRig} from '../js/avatar/band-character-rig.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/band-cast-v3/one-piece/manifest.json')));
const score=JSON.parse(fs.readFileSync(path.join(root,'assets/band-shell-performance/score.json')));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('rig assets retain anatomical ownership and verified original PNGs',()=>{
 assert.equal(manifest.version,3);assert.equal(manifest.actors.length,10);const hashes=new Map();
 for(const a of manifest.actors){
  assert(RIG_ROLES[a.id]);assert.equal(a.rigVersion,3);
  const parts=a.rigParts;assert(parts.leftHand&&parts.rightHand);
  assert.notDeepEqual(parts.leftHand.rect,parts.rightHand.rect);
  if(!a.furSkin){assert(parts.leftUpper.rect[1]<parts.rightUpper.rect[1]);assert(parts.leftFore.rect[1]<parts.rightFore.rect[1]);}
  for(const p of [...Object.values(a.rigParts),a.layers.body,a.layers.head,a.layers.instrument]){
   const bytes=fs.readFileSync(path.join(root,p.image));const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
   assert(p.rect[0]>=0&&p.rect[1]>=0&&p.rect[0]+p.rect[2]<=width&&p.rect[1]+p.rect[3]<=height);
   if(p.sha256){if(!hashes.has(p.image))hashes.set(p.image,createHash('sha256').update(bytes).digest('hex'));assert.equal(hashes.get(p.image),p.sha256);}
  }
 }
 assert.match(manifest.actors.find(a=>a.id==='robin').layers.body.image,/band-cast-v3/);
 assert(manifest.actors.find(a=>a.id==='robin').layers.faceFront.maskRuns.length>0);
});
test('fixed bones stay connected through rehearsal, seek, rests and current score cues',()=>{
 for(const a of manifest.actors){
  const check=(t,sample)=>{const p=sampleCharacterRig(a,t,sample);assert(p.arms[0].shoulder[0]>p.arms[1].shoulder[0]);
   for(const arm of p.arms){assert(arm.handScale>0);assert(arm.contactError<.001,`${a.id} disconnected at ${t}`);
    assert(Math.abs(distance(arm.shoulder,arm.elbow)-(a.bones?.upper??82))<.001);
    assert(Math.abs(distance(arm.elbow,arm.wrist)-(a.bones?.fore??80))<.001);}
   return p;
  };
  for(let i=0;i<=240;i++)check(i/30,rehearsalSample(a.id,i/30));
  const events=score.stems.find(s=>s.id===a.actorId)?.events||[];
  for(const n of events)for(const t of [n.start-.09,n.start,n.start+.08])check(t,{events,activity:1});
  const s=rehearsalSample(a.id,2.3),before=check(2.3,s);check(6,rehearsalSample(a.id,6));assert.deepEqual(check(2.3,s),before);
  const rest=sampleCharacterRig(a,0,{activity:0}).arms;
  assert.deepEqual(sampleCharacterRig(a,5,{activity:0}).arms,rest);
  assert.deepEqual(sampleCharacterRig(a,5,{...rehearsalSample(a.id,5),userMuted:true}).arms,rest);
  assert.deepEqual(sampleCharacterRig(a,5,rehearsalSample(a.id,5),true).arms,rest);
  if(a.id==='shanks')for(let i=0;i<240;i++){
   const arm=sampleCharacterRig(a,i/30,rehearsalSample(a.id,i/30)).arms[1],[p,q]=arm.toolLine;
   assert(Math.abs(p[1]-q[1])<.001);assert(arm.contact[0]>=Math.min(p[0],q[0])&&arm.contact[0]<=Math.max(p[0],q[0]));assert(Math.abs(arm.contact[1]-p[1])<.001,'bow detached from strings');
  }
 }
});
test('rehearsal has distinct instrument actions and strike tips land on surfaces',()=>{
 const actor=id=>manifest.actors.find(a=>a.id===id),pose=(id,t)=>sampleCharacterRig(actor(id),t,rehearsalSample(id,t));
 for(const id of ['zoro','usopp','nami','robin','law','shanks','luffy']){
  const values=Array.from({length:220},(_,i)=>pose(id,.35+i/30));
  const travel=Math.max(...values.map(p=>p.arms[0].wrist[0]))-Math.min(...values.map(p=>p.arms[0].wrist[0]));
  const other=Math.max(...values.map(p=>p.arms[1].wrist[0]))-Math.min(...values.map(p=>p.arms[1].wrist[0]));
  assert(Math.max(travel,other)>12,`${id} has no meaningful hand travel`);
 }
 assert(pose('nami',1).bellows>10);assert(Math.abs(pose('shanks',.5).bow-pose('shanks',1.5).bow)>50);
 for(const id of ['sanji','chopper']){
  const a=pose(id,.5),p=a.layout.prop,hand=id==='sanji'?1:0;
  const expectedY=p.y+p.height*(id==='sanji'?.11:.36);
  assert(Math.abs(a.arms[hand].contact[1]-expectedY)<.001,`${id} strikes decoration instead of playing surface`);
  assert(pose(id,.41).arms[hand].contact[1]<a.arms[hand].contact[1]-20);
  for(const n of rehearsalSample(id,1).events){const t=Math.round(n.start*30)/30,p=pose(id,t);
   const impactHand=id==='sanji'?(n.midi===42?1:0):Math.round((n.start-.5)/.35)%2;
   const v=id==='sanji'?(n.midi===49?.07:n.midi===42?.11:.32):.36;
   assert(Math.abs(p.arms[impactHand].contact[1]-(p.layout.prop.y+p.layout.prop.height*v))<.01,'30 fps missed the impact hold');
  }
 }
 assert(pose('luffy',.5).mouthOpen>.4);
 const guitar=pose('usopp',.5);assert(guitar.arms[0].contact[0]<guitar.layout.prop.x+guitar.layout.prop.width*.72,'fretting hand is on the slingshot headstock');
});
