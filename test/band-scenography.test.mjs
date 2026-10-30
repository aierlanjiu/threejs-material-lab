import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base=new URL('../assets/models/band-scenography/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
assert.equal(manifest.assets.length,3);
let total=0;
for(const asset of manifest.assets){
 const bytes=await readFile(new URL(asset.file,base));total+=bytes.length;
 assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.optimized.sha256,asset.id+' optimized hash');
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const g=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert.ok(g.buffers.every(b=>!b.uri||b.uri.startsWith('data:')),'self-contained geometry');
 assert.ok(g.images.every(i=>i.bufferView!==undefined),'self-contained textures');
 assert.ok((g.extensionsRequired||[]).every(e=>e==='EXT_texture_webp'),'no external geometry decoder');
 const triangles=g.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+g.accessors[p.indices??p.attributes.POSITION].count/3,0),0);
 assert.equal(triangles,asset.optimized.triangles);assert.ok(triangles<12000,asset.id+' triangle budget');
 assert.equal(g.materials.length,1,'one draw material per scenic asset');
 assert.ok(bytes.length<asset.original.bytes/10,'offline optimization must remain substantial');
 assert.equal(asset.author,'Scenario');assert.equal(asset.license,'CC-BY 4.0');
 assert.match(asset.source,/^https:\/\/huggingface\.co\/datasets\/scenario-labs\/3d-collection\//);
}
assert.equal(total,manifest.total_bytes);assert.ok(total<1600000,'combined scenery transfer budget');
console.log('PASS 3 optimized self-contained scenic GLBs, hashes, provenance, triangle/material/transfer budgets');
