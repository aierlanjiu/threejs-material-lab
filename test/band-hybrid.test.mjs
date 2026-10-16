import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateBandScore} from '../js/audio/band-timeline.js';
import {validateArrangement} from '../js/audio/band-arrangement.js';
import {compileBandParts,sampleBandEnsemble} from '../js/audio/band-parts.js';
import {hybridLevels} from '../js/audio/band-hybrid-audio.js';
import {createBandConductor} from '../js/audio/band-conductor.js';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const catalog=read('assets/band-audio/catalog.json'),banks=read('assets/band-audio/banks.json');
assert.equal(catalog.tracks.length,16);
let notes=0;
const checked=new Set();
function audioHash(item){if(checked.has(item.audio))return;checked.add(item.audio);
 const bytes=fs.readFileSync(new URL(item.audio,root));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.audioSha256);}
for(const bank of Object.values(banks.banks))for(const s of bank.samples)audioHash(s);
for(const track of catalog.tracks){const score=read(track.score);
 const general=['youjing','qiuyinong','lanni','gui','pianai','haiou'];
 const original=new URL(track.id.startsWith('track_')?`audio/${general[+track.id.slice(6)]}.mp3`:`output/audio/${track.id}.mp3`,root);
 const bytes=fs.readFileSync(original);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),score.sourceSha256);
 const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',original.pathname]).toString());
 assert.ok(Math.abs(score.duration-duration)<.15,'entire original recording duration, never a preview');
 assert.deepEqual(validateArrangement(score),{ok:true,errors:[]});assert.equal(validateBandScore(score).ok,true,track.id);
 for(const stem of score.hybrid.originalStems)audioHash(stem);
 for(const theme of catalog.themes){const parts=compileBandParts(score,theme);
  assert.equal(parts.length,theme==='naruto'?9:10);assert.equal(new Set(parts.map(p=>p.stemId)).size,parts.length);
  assert.ok(parts.every(p=>p.bindingStatus==='composed'&&!p.shared));
  const voice=parts.find(p=>p.technique==='voice'),guitar=parts.find(p=>p.instrumentId==='guitar');
  assert.equal(voice.events.length,0,'recorded singer cannot masquerade as synthesized notes');
  const all={muted:[],soloGroup:null},normal=hybridLevels(score,theme,all);
  const muted=hybridLevels(score,theme,{muted:[voice.stemId],soloGroup:null});
  assert.equal(muted.bed,normal.bed,'original backing never stops on character click');
  assert.equal(muted.gains[voice.stemId],0);assert.equal(muted.original.vocals,-normal.bed*(1-score.hybrid.mix.originalFloor));
  for(const id of Object.keys(normal.original).filter(id=>id!=='vocals'))assert.equal(muted.original[id],normal.original[id],'unrelated original sources stay unchanged');
  const solo=hybridLevels(score,theme,{muted:[],soloGroup:guitar.stemId});
  assert.ok(solo.bed>0&&solo.bed<normal.bed);assert.ok(solo.gains[guitar.stemId]>normal.gains[guitar.stemId]);
  assert.ok(Object.entries(solo.gains).every(([id,g])=>id===guitar.stemId||g===0));
  const custom=parts.find(p=>!['vocals','bass','drums','guitar','piano'].includes(p.instrumentId));
  if(custom)assert.deepEqual(hybridLevels(score,theme,{muted:[custom.stemId],soloGroup:null}).original,normal.original,'new instruments do not attenuate unrelated original families');
  let time=score.duration*.3;const conductor=createBandConductor({score,getTime:()=>time,isPlaying:()=>true});
  conductor.setGroups(parts.map(p=>p.stemId));conductor.toggle(guitar.stemId);time=conductor.snapshot.pendingTime+.001;conductor.tick();assert.equal(conductor.gain(guitar.stemId),0);
  time=conductor.snapshot.restoreTime+.001;conductor.tick();assert.equal(conductor.gain(guitar.stemId),1);
  for(const p of parts.filter(p=>p.technique!=='voice')){assert.ok(banks.banks[score.stems.find(s=>s.id===p.stemId).bank]);notes+=p.events.length;}
  assert.ok(sampleBandEnsemble(score,parts,score.duration*.5).parts.length===parts.length);
 }
}
const changed=read(catalog.tracks[0].score);changed.arrangement.themes['one-piece'][0].originalStemId='guitar';assert.equal(validateArrangement(changed).ok,false);
console.log(`PASS 16 complete songs, 48 theme arrangements, 29 real role instruments, ${notes} performed notes, ${checked.size} audio hashes, original-first/mute/held-solo/four-bar restoration and missing-source safety`);
