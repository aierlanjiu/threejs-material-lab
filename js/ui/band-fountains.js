import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {stageSpec,stageFountainSlots,stagePyroAt} from '../audio/band-stage-layout.js';

const random=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const streamPowerAt=(age,rank,duration)=>{if(duration<=0||age<0||age>=duration)return 0;const pulse=(start,hold,fade)=>age<start?0:age<start+.09?(age-start)/.09:age<start+hold?1:Math.max(0,1-(age-start-hold)/fade);return Math.max(pulse(rank*.11,.33,.45)*.85,pulse(.48,Math.max(.85,duration-.93),.45));};
// Pure GLSL helpers are also exercised by the numerical regression test.
const physicsShader=`
 float dragDistance(float age){return 1.-exp(-max(0.,age)*2.8);}
 vec3 fountainAt(float age,float speed,float spread,float theta){
  float a=max(0.,age),drag=dragDistance(a),terminal=12.4/2.8;
  float y=(speed+terminal)/2.8*drag-terminal*a;
  float crown=smoothstep(.40,.95,a)*(1.-exp(-max(0.,a-.40)*1.5));
  float radius=.025+spread*(.24*drag+1.35*crown);
  return vec3(cos(theta)*radius,y,sin(theta)*radius);
 }
 float particleAlive(float age,float life,float height){return step(0.,age)*step(.015,height)*(1.-step(life,age));}
 vec3 sphereAt(vec3 direction,float age,float willow){
  float a=max(0.,age),spread=1.-exp(-a*9.);
  return vec3(direction.x*spread,direction.y*spread-willow*a*a,direction.z*spread);
 }
 vec3 coolingColor(float life){
  vec3 hot=vec3(.94,.98,1.),gold=vec3(1.,.8235,.4784),copper=vec3(.8784,.3255,.1098),ember=vec3(.16,.022,.006);
  if(life<.18)return hot;
  if(life<.60)return mix(hot,gold,(life-.18)/.42);
  if(life<.85)return mix(gold,copper,(life-.60)/.25);
  return mix(copper,ember,clamp((life-.85)/.15,0.,1.));
 }
 float emissionPulse(float age,float start,float hold,float fade){
  if(age<start)return 0.;
  if(age<start+.09)return clamp((age-start)/.09,0.,1.);
  if(age<start+hold)return 1.;
  return clamp(1.-(age-start-hold)/fade,0.,1.);
 }
 float emissionAt(float age,float rank){return max(emissionPulse(age,rank*.11,.33,.45)*.85,emissionPulse(age,.48,.85,.7));}
 float streamAge(float time,float phase,float life){return mod(time-phase,life);}
 float streamPower(float age,float rank,float duration){
  if(duration<=0.||age<0.||age>=duration)return 0.;
  return max(emissionPulse(age,rank*.11,.33,.45)*.85,emissionPulse(age,.48,max(.85,duration-.93),.45));
 }
 float starCore(float x,float y,float aspect){return exp(-34.*(x*x+y*y*aspect*aspect));}
 float flameLift(float corner,float size){return (corner+1.)*size*2.3;}
 float smokeAlpha(float age){return step(0.,age)*sin(clamp(age/4.8,0.,1.)*3.14159265)*.075;}
`;
const vertexShader=physicsShader+`
 uniform float uTime,uAge,uPreviousAge,uDuration,uPreviousDuration,uRank,uPower,uViewportHeight,uKind,uRise,uHeight;
 attribute vec4 dynamics,accents;attribute vec2 extras;
 varying vec2 vUv;varying float vFade,vLife,vSeed,vKind,vHot,vGrain,vAspect;
 float bornPower(float particleAge){return max(streamPower(uAge-particleAge,uRank,uDuration),streamPower(uPreviousAge-particleAge,uRank,uPreviousDuration));}
 vec3 positionAt(float a){
  if(uKind<.5)return fountainAt(a,dynamics.z,accents.y,accents.x);
  if(uKind<1.5)return sphereAt(dynamics.xyz,a-dynamics.w,accents.w>.5?.48:.78);
  if(uKind<2.5){float rise=clamp((a-dynamics.x+.35)/.35,0.,1.);return vec3(0.,-uRise*(1.-pow(rise,1.45)),0.);}
  if(uKind<3.5)return vec3(0.);
  if(uKind<4.5)return vec3(0.,.20,0.);
  float t=max(0.,a-dynamics.x);return vec3(cos(accents.x)*t*.10,2.2+t*.60,sin(accents.x)*t*.10);
 }
 void main(){
  float a=uAge,age=a-dynamics.x;
  if(uKind<.5){age=streamAge(uTime,dynamics.x,dynamics.y);a=age;}
  if(uKind>4.5){age=streamAge(uTime,dynamics.x,4.8);a=age+dynamics.x;}
  vSeed=accents.z;vKind=uKind;vHot=0.;vFade=0.;vLife=0.;vUv=position.xy*.5+.5;
  vec3 p=positionAt(a),before=positionAt(a-.04);float width=1.,lengthScale=1.;
  if(uKind<.5){
   float pressure=bornPower(age),life=dynamics.y;
   vLife=clamp(age/life,0.,1.);vFade=particleAlive(age,life,p.y)*step(extras.x,pressure)*pow(max(0.,1.-vLife),.48)*pressure;
   width=accents.w;lengthScale=1.;
  }else if(uKind<1.5){
   age=a-dynamics.w;vLife=clamp(age/accents.x,0.,1.);vHot=accents.w;
   vFade=particleAlive(age,accents.x,p.y+uHeight)*pow(max(0.,1.-vLife),.70);width=accents.y;lengthScale=1.45;
  }else if(uKind<2.5){
   float rise=clamp((age+.35)/.35,0.,1.);vLife=(1.-rise)*.45;
   vFade=step(-.35,age)*(1.-smoothstep(-.01,.07,a))*pow(1.-dynamics.x/.13,1.5);width=.17;lengthScale=1.8;
  }else if(uKind<3.5){
   vFade=step(0.,a)*(1.-smoothstep(0.,.12,a));vLife=0.;width=.10+max(0.,a)*11.;
  }else if(uKind<4.5){
   float f=fract(sin(floor(uTime*30.)+accents.z)*43758.5453);
   vFade=bornPower(0.)*(.72+.28*f);vLife=dynamics.x>.5?.27:0.;width=dynamics.y*(.84+.16*f);
  }else{
   float t=max(0.,age);vLife=clamp(t/4.8,0.,1.);vFade=smokeAlpha(t)*bornPower(t);width=1.0+t*.35;
  }
  vFade*=uPower;vGrain=width;
  vec4 mv=modelViewMatrix*vec4(p,1.),clip=projectionMatrix*mv;
  vec4 prior=projectionMatrix*modelViewMatrix*vec4(before,1.);
  float aspect=projectionMatrix[1][1]/projectionMatrix[0][0];vec2 resolution=vec2(uViewportHeight*aspect,uViewportHeight);
  vec2 delta=(clip.xy/clip.w-prior.xy/prior.w)*resolution*.5;
  float speed=length(delta);vec2 dir=speed>.001?delta/speed:vec2(0.,1.),normal=vec2(-dir.y,dir.x);
  float radius=clamp(width*uViewportHeight/max(1.,-mv.z),.75,12.);
  float streak=clamp(speed*.72*lengthScale+radius*1.8,2.,52.);
  vAspect=streak/radius;
  vec2 offset=normal*position.x*radius+dir*(position.y-.55)*streak;
  if(uKind>2.5){
   float size=width*uViewportHeight/max(1.,-mv.z);
   offset=position.xy*size;
   if(uKind>3.5&&uKind<4.5)offset=vec2(position.x*size*.48,flameLift(position.y,size));
  }
  clip.xy+=offset/resolution*2.*clip.w;gl_Position=clip;
 }`;
const fragmentShader=physicsShader+`
 varying vec2 vUv;varying float vFade,vLife,vSeed,vKind,vHot,vGrain,vAspect;
 void main(){
  if(vFade<.0001)discard;
  vec2 p=vUv-.5;float alpha=0.;vec3 color=coolingColor(vLife);
  if(vKind<2.5){
   float taper=.16+.84*smoothstep(.02,.80,vUv.y);
   float tail=exp(-p.x*p.x*22./(taper*taper))*smoothstep(0.,.20,vUv.y)*(1.-smoothstep(.75,.99,vUv.y));
   float head=starCore(p.x,vUv.y-.775,vAspect);
   float pop=step(.14,vGrain)*step(.72,fract(vSeed*.137))*smoothstep(.82,.84,vLife)*(1.-smoothstep(.94,.96,vLife))*pow(max(0.,sin(vLife*90.+vSeed)),16.);
   color=mix(color,vec3(1.,.96,.84),pop*.85+vHot*.22);
   color=mix(color,color*vec3(1.,.68,.40),clamp((.78-vUv.y)*.5,0.,.35));
   alpha=(tail*.37+head*.92+head*pop*1.3)*vFade;
  }else if(vKind<3.5){alpha=exp(-dot(p,p)*16.)*vFade;color=vec3(1.,.97,.87);}
  else if(vKind<4.5){float taper=.12+.65*(1.-vUv.y);alpha=exp(-p.x*p.x*7./(taper*taper))*sin(vUv.y*3.14159265)*vFade*.55;}
  else{float fog=exp(-dot(p,p)*7.)*(.8+.2*sin(vUv.x*19.+vUv.y*13.+vSeed));alpha=fog*vFade;color=vec3(.94,.75,.47);}
  gl_FragColor=vec4(color,alpha);
 }`;
function quads(dynamics,accents,extras,uniforms,kind){
 const geometry=new THREE.InstancedBufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));geometry.setIndex([0,1,2,0,2,3]);
 geometry.setAttribute('dynamics',new THREE.InstancedBufferAttribute(new Float32Array(dynamics),4));geometry.setAttribute('accents',new THREE.InstancedBufferAttribute(new Float32Array(accents),4));geometry.setAttribute('extras',new THREE.InstancedBufferAttribute(new Float32Array(extras),2));geometry.instanceCount=dynamics.length/4;
 const material=new THREE.ShaderMaterial({uniforms:{...uniforms,uKind:{value:kind}},vertexShader,fragmentShader,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;if(kind===5)mesh.renderOrder=-2;return mesh;
}
const uniformsFor=()=>({uTime:{value:0},uAge:{value:100},uPreviousAge:{value:100},uDuration:{value:0},uPreviousDuration:{value:0},uRank:{value:0},uPower:{value:0},uViewportHeight:{value:650},uRise:{value:6},uHeight:{value:10}});
export function createStageFountains(parent){
 const jets=[],airbursts=[],capacity=400,airCapacity=768;let narrow=false,lastTime=0,lastPyro=null,previous=-100,lastFlow=0;
 for(let i=0;i<8;i++){
  const group=new THREE.Group(),ds=[],as=[],es=[],u=uniformsFor();
  for(let k=0;k<capacity;k++){const seed=k+i*capacity,speed=27.5+random(seed+3)*5.7,life=(speed+12.4/2.8)/12.4,core=k%5<3;
   ds.push(random(seed+1)*life,life,speed,0);as.push(random(seed+7)*Math.PI*2,core?.045+random(seed+9)*.10:.45+random(seed+9)*.75,seed*3.2,core?.105:.14+random(seed+2)*.10);es.push(random(seed+11),0);}
  const sparks=quads(ds,as,es,u,0);group.add(sparks);
  const flame=quads([0,.21,0,0,1,.31,0,0],[0,0,i*1.7,0,0,0,i*1.7+4,0],[0,0,0,0],u,4);group.add(flame);
  const smoke=quads([i*.37,0,0,0,1.6+i*.37,0,0,0,3.2+i*.37,0,0,0],[i*.9,0,i*2.3,0,i*.9+2,0,i*2.3+1,0,i*.9+4,0,i*2.3+2,0],[0,0,0,0,0,0],u,5);group.add(smoke);
  const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.10,.14,.19,10),new THREE.MeshStandardMaterial({color:'#303743',metalness:.8,roughness:.3}));nozzle.position.y=.1;group.add(nozzle);parent.add(group);group.visible=false;jets.push({group,sparks,flame,smoke,uniforms:u});
 }
 for(let i=0;i<2;i++){
  const group=new THREE.Group(),ds=[],as=[],es=[],u=uniformsFor();
  for(let k=0;k<airCapacity;k++){const seed=k+i*airCapacity,index=k%384,n=384,y=1-2*(index+.5)/n,phi=index*Math.PI*(3-Math.sqrt(5))+Math.floor(k/384)*.37,ring=Math.sqrt(1-y*y),inner=index%5===0,radius=(inner?1.6:4.3)+random(seed+21)*(inner?.6:2.4);
   ds.push(Math.cos(phi)*ring*radius,y*radius,Math.sin(phi)*ring*radius,random(seed+12)*.035);as.push(inner?2.3:4.25,.10+random(seed+22)*.11,seed*2.8,inner?1:0);es.push(0,0);}
  const sparks=quads(ds,as,es,u,1);group.add(sparks);
  const cds=[],cas=[],ces=[];for(let k=0;k<32;k++){cds.push(k/31*.12,0,0,0);cas.push(0,0,k*.6,0);ces.push(0,0);}
  const comet=quads(cds,cas,ces,u,2),core=quads([0,0,0,0],[0,0,0,0],[0,0],u,3);group.add(comet,core);
  // Full-capacity history draws reuse buffers; only overlapping airbursts add draw calls.
  const history=new THREE.Group(),pastUniforms={...u,uAge:{value:100}},copies=[sparks,comet,core].map(mesh=>{const copy=new THREE.Mesh(mesh.geometry,mesh.material.clone());copy.material.uniforms={...pastUniforms,uKind:mesh.material.uniforms.uKind};copy.frustumCulled=false;return copy;});history.add(...copies);group.add(history);
  parent.add(group);group.visible=false;airbursts.push({group,sparks,comet,core,history,uniforms:u,pastUniforms});
 }
 function setLayout(value){narrow=value;const s=stageSpec(narrow),slots=stageFountainSlots(narrow);
  jets.forEach((jet,i)=>{jet.enabled=i<slots.length;jet.group.visible=false;if(!jet.enabled)return;jet.group.position.fromArray(slots[i]);jet.uniforms.uRank.value=Math.floor(Math.abs(i-(slots.length-1)/2));jet.sparks.geometry.instanceCount=narrow?240:capacity;});
  airbursts.forEach((burst,i)=>{const scale=narrow?.68:1;burst.group.position.set((i?1:-1)*(narrow?2.7:5.8),narrow?8.1:10.3,s.back+1.25);burst.group.scale.setScalar(scale);burst.uniforms.uHeight.value=burst.group.position.y/scale;burst.uniforms.uRise.value=(burst.group.position.y-2.7)/scale;burst.sparks.geometry.instanceCount=narrow?384:airCapacity;});
 }
 function update(time,fx,reduced,viewportHeight){lastTime=time;lastPyro=stagePyroAt(time,fx,narrow,reduced);previous=Math.max(-100,...fx.bursts.filter(t=>t<lastPyro.start));
  const explicitWindow='fountainWindow' in fx,window=explicitWindow?fx.fountainWindow||{start:-100,end:-100}:{start:lastPyro.start,end:lastPyro.start+5.1},age=time-window.start,duration=window.start>=0?window.end-window.start:0,past=time-previous,pastDuration=!explicitWindow&&previous>=0?5.1:0;
  lastFlow=0;
  jets.forEach(jet=>{const rank=jet.uniforms.uRank.value,active=jet.enabled&&!reduced&&((duration>0&&age>=rank*.11&&age<duration+3.1)||(pastDuration>0&&past>=rank*.11&&past<pastDuration+3.1));jet.group.visible=active;
   jet.uniforms.uTime.value=time;jet.uniforms.uAge.value=age;jet.uniforms.uPreviousAge.value=past;jet.uniforms.uDuration.value=duration;jet.uniforms.uPreviousDuration.value=pastDuration;jet.uniforms.uPower.value=active?1:0;jet.uniforms.uViewportHeight.value=viewportHeight;
   if(active)lastFlow+=Math.max(streamPowerAt(age,rank,duration),streamPowerAt(past,rank,pastDuration));});
  lastFlow/=narrow?6:8;
  airbursts.forEach((burst,i)=>{const age=time-lastPyro.airStarts[i],past=time-(previous+[.72,1.18][i]),now=!reduced&&age>=-.35&&age<4.35,old=!reduced&&previous>=0&&past>=-.35&&past<4.35;burst.group.visible=now||old;
   burst.sparks.visible=now;burst.comet.visible=now;burst.core.visible=now;burst.history.visible=old;
   burst.uniforms.uTime.value=time;burst.uniforms.uAge.value=age;burst.pastUniforms.uAge.value=past;burst.uniforms.uPower.value=now||old?1:0;burst.uniforms.uViewportHeight.value=viewportHeight;});
 }
 return {setLayout,update,get flow(){return lastFlow;},get diagnostics(){const ages=airbursts.flatMap(b=>[...(b.sparks.visible?[b.uniforms.uAge.value]:[]),...(b.history.visible?[b.pastUniforms.uAge.value]:[])]);return {motion:'vertex-shader',streaks:'instanced-quads',angularDistribution:'360-degree',cooling:'white-gold-copper-ember',groundCutoff:true,poolUse:'full-primary-shared-history',continuous:true,roundCore:true,flameAnchor:'nozzle',smokeOpacity:.075,emitters:narrow?6:8,visible:jets.filter(j=>j.group.visible).length,particleCount:narrow?6*240+2*384:8*capacity+2*airCapacity,flow:lastFlow,window:fxWindow(),smokeClouds:(narrow?6:8)*3,time:lastTime,mode:lastFlow>.05?'stream':lastPyro?.mode,flash:lastPyro?.flash||0,powers:lastPyro?.powers||[],attributeUpdates:[...jets,...airbursts].reduce((sum,j)=>sum+Object.values(j.sparks.geometry.attributes).reduce((n,a)=>n+a.version,0),0),positions:jets.filter(j=>j.enabled).map(j=>j.group.position.toArray()),airbursts:{emitters:2,visible:airbursts.filter(b=>b.group.visible).length,historyVisible:airbursts.filter(b=>b.history.visible).length,particlesPerBurst:narrow?384:airCapacity,spherical:true,comets:ages.filter(a=>a>=-.35&&a<.07).length,cores:ages.filter(a=>a>=0&&a<.12).length,starts:lastPyro?.airStarts||[]}};}};
 function fxWindow(){const u=jets[0].uniforms;return {start:lastTime-u.uAge.value,end:lastTime-u.uAge.value+u.uDuration.value};}
}
