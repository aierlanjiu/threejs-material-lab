import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stagePyroAt,stageSpec,stageFountainSlots,stageClimaxAt} from '../js/audio/band-stage-layout.js';

// Exercise the scalar/vector GLSL helper bodies themselves, without a CPU runtime simulation.
const source=await readFile(new URL('../js/ui/band-fountains.js',import.meta.url),'utf8');
// Instantiate production pool construction with a minimal render-free Three adapter.
class Vector{set(x,y,z){this.xyz=[x,y,z];return this;}fromArray(a){this.xyz=a;return this;}toArray(){return this.xyz;}}
class Group{constructor(){this.children=[];this.position=new Vector();this.scale={setScalar(){}};this.visible=true;}add(...items){this.children.push(...items);}}
class Geometry{constructor(){this.attributes={};}setAttribute(k,a){this.attributes[k]=a;}setIndex(){}}
class Attribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.version=0;}}
class Material{constructor(options){Object.assign(this,options);}clone(){return new Material(this);}}
class Mesh extends Group{constructor(geometry,material){super();this.geometry=geometry;this.material=material;}}
const three={Group,Mesh,InstancedBufferGeometry:Geometry,Float32BufferAttribute:Attribute,InstancedBufferAttribute:Attribute,ShaderMaterial:Material,MeshStandardMaterial:Material,CylinderGeometry:Geometry};
const factory=new Function('THREE','stageSpec','stageFountainSlots','stagePyroAt',source.replace(/^import .*;\n/gm,'').replace('export function','function')+';return createStageFountains;')(three,stageSpec,stageFountainSlots,stagePyroAt);
const root=new Group(),fountains=factory(root);fountains.setLayout(false);
for(const group of root.children){const sparks=group.children[0].geometry?group.children[0]:group.children[0].children[0];
 const e=sparks.geometry.attributes.extras.array;
 assert.equal(Array.from(e).filter((_,i)=>i%2===1&&e[i]!==0).length,0,'every primary particle must serve the current event; no dormant half-pool');
}
const shader=source.match(/const physicsShader=`([\s\S]*?)`;/)?.[1];assert.ok(shader);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const vec3=(x,y=x,z=x)=>({x,y,z});
const mix=(a,b,t)=>typeof a==='number'?a+(b-a)*t:vec3(mix(a.x,b.x,t),mix(a.y,b.y,t),mix(a.z,b.z,t));
const smoothstep=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x);};
const env={...Object.fromEntries(['exp','max','min','cos','sin','pow'].map(k=>[k,Math[k]])),clamp,vec3,mix,smoothstep,step:(edge,x)=>Number(x>=edge),mod:(x,y)=>x-y*Math.floor(x/y)};
for(const m of shader.matchAll(/(?:float|vec3) (\w+)\(([^)]*)\)\{([^}]+)\}/g)){
 const args=m[2].split(',').map(a=>a.trim().split(' ').at(-1)),keys=Object.keys(env);
 const body=m[3].replace(/\b(?:float|vec3) (\w+)\s*=/g,'let $1 =');
 env[m[1]]=new Function(...keys,...args,body).bind(null,...keys.map(k=>env[k]));
}
for(const speed of [27.5,30.3,33.2]){
 const life=(speed+12.4/2.8)/12.4;
 const heights=Array.from({length:300},(_,i)=>env.fountainAt(i*life/299,speed,1,0).y);
 assert.ok(Math.max(...heights)>6.5&&Math.max(...heights)<8.6,'the drag model retains the intended fountain height');
 const landed=env.fountainAt(life-.001,speed,1,0);assert.ok(landed.y<.015);assert.equal(env.particleAlive(life-.001,life,landed.y),0,'sparks must disappear on ground contact even before lifetime expiry');
}
const circle=Array.from({length:64},(_,i)=>env.fountainAt(1.0,30,1,i/64*Math.PI*2));
for(const key of ['x','z'])assert.ok(Math.abs(circle.reduce((sum,p)=>sum+p[key],0))<1e-8,'radial spray has no left/right or forward bias');
assert.ok(env.fountainAt(1,30,1,0).x>env.fountainAt(.1,30,1,0).x*8,'the plume opens at the crown');
assert.equal(env.particleAlive(-.01,3,1),0,'no pre-ignition sparks');assert.equal(env.particleAlive(3,3,1),0);
assert.ok(env.coolingColor(.1).z>.95);assert.ok(env.coolingColor(.6).y>.8);assert.ok(env.coolingColor(.9).z<.11&&env.coolingColor(.9).y<.33);
const blast=env.sphereAt(vec3(3,4,5),.15,.78);assert.ok(blast.z>3.7&&blast.x>2.2,'initial expansion is fast and has true depth');
assert.ok(env.sphereAt(vec3(3,4,5),3,.78).y<env.sphereAt(vec3(3,4,5),1,.78).y,'the crown falls into willow rain');
for(const age of [.1,.3,.6,1.1,1.7,2.1])for(let rank=0;rank<3;rank++){
 const powers=stagePyroAt(10+age,{bursts:[10]},true).powers;
 assert.ok(Math.abs(env.emissionAt(age,rank)-powers[2-rank])<1e-8,'GPU ignition matches the song-clock firing envelope');
}
console.log('PASS actual GLSL drag trajectory, radial symmetry, ground cutoff, ignition, cooling, rapid 3D burst and willow fall');
for(const key of ['streamAge','streamPower','starCore','flameLift','smokeAlpha'])assert.equal(typeof env[key],'function',key+' must be exercised from actual GLSL');
for(const t of [3.1,5.2,9.4,18.3]){
 let young=0;for(let k=0;k<400;k++){const age=env.streamAge(t,k/400*2.8,2.8);if(age<.15&&env.streamPower(t-age,0,20)>.9)young++;}
 assert.ok(young>=20,'a sustained cue must keep spawning young sparks after 2.03 seconds');
}
assert.equal(env.streamPower(-.01,0,20),0);assert.equal(env.streamPower(20.01,0,20),0,'no new births after shutoff');
for(const ratio of [1,3,10,40])assert.ok(Math.abs(env.starCore(.1,0,ratio)-env.starCore(0,.1/ratio,ratio))<1e-12,'equal screen-space radii retain a round white head');
for(const width of [.1,.21,.31]){assert.equal(env.flameLift(-1,width),0,'flame bottom stays on nozzle');assert.ok(env.flameLift(1,width)>0);}
assert.ok(env.smokeAlpha(2.4)>=.06&&env.smokeAlpha(2.4)<=.09);assert.equal(env.smokeAlpha(-.01),0);
const score={duration:40,bpmEstimate:120,stems:[],stageCues:{choruses:[{start:5,end:25}],bursts:[5,12,20,24.8]}};
for(const time of [5,10,18,24,26])assert.deepEqual(stageClimaxAt(score,time).fountainWindow,{start:5,end:25},'chorus emission window survives isolated bursts and includes tail release');
assert.equal(stageClimaxAt(score,29).fountainWindow,null);assert.equal(stageClimaxAt(score,10,'off').fountainWindow,undefined);
fountains.update(10,{bursts:[5],intensity:1,fountainWindow:{start:5,end:25}},false,800);
assert.equal(fountains.diagnostics.attributeUpdates,0);assert.ok(fountains.diagnostics.flow>.9);
fountains.update(26,{bursts:[],intensity:0,fountainWindow:{start:5,end:25}},false,800);
assert.equal(fountains.diagnostics.flow,0);assert.equal(fountains.diagnostics.visible,8,'shutoff retains airborne embers');
fountains.update(29,{bursts:[],intensity:0},false,800);assert.equal(fountains.diagnostics.visible,0);
fountains.update(29,stageClimaxAt(score,29),false,800);assert.equal(fountains.diagnostics.visible,0,'a late discrete airburst must not restart spray outside its chorus');
fountains.update(10,{bursts:[8,9.5],intensity:1},false,800);assert.equal(fountains.diagnostics.airbursts.historyVisible,2,'overlapping airbursts keep a full independent history draw');
for(const group of root.children.slice(8)){
 const sparks=group.children[0],history=group.children.at(-1);assert.equal(history.children[0].geometry,sparks.geometry,'history must share buffers rather than split primary capacity');
 const ds=sparks.geometry.attributes.dynamics.array;let above=0,below=0;for(let k=0;k<384;k++)ds[k*4+1]>0?above++:below++;
 assert.equal(above,192);assert.equal(below,192,'the mobile prefix must cover both sphere hemispheres');
}
console.log('PASS full primary pools, sustained births, shutoff drain, circular spark cores, nozzle anchoring, visible smoke and overlapping airbursts');
