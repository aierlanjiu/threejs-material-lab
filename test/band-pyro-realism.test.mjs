import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stagePyroAt} from '../js/audio/band-stage-layout.js';

// Exercise the scalar/vector GLSL helper bodies themselves, without a CPU runtime simulation.
const source=await readFile(new URL('../js/ui/band-fountains.js',import.meta.url),'utf8');
const shader=source.match(/const physicsShader=`([\s\S]*?)`;/)?.[1];assert.ok(shader);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const vec3=(x,y=x,z=x)=>({x,y,z});
const mix=(a,b,t)=>typeof a==='number'?a+(b-a)*t:vec3(mix(a.x,b.x,t),mix(a.y,b.y,t),mix(a.z,b.z,t));
const smoothstep=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x);};
const env={...Object.fromEntries(['exp','max','min','cos','sin','pow'].map(k=>[k,Math[k]])),clamp,vec3,mix,smoothstep,step:(edge,x)=>Number(x>=edge)};
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
