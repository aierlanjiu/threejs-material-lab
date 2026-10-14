import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {stageSpec,stageFountainSlots,stagePyroAt} from '../audio/band-stage-layout.js';

const random=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const trajectory=`
 uniform float uTime,uPower,uSide,uViewportHeight;
 attribute vec4 dynamics,accents;
 varying float vFade,vWhite;
 vec3 spark(float tail){
  float head=mod(uTime+dynamics.x,dynamics.y),age=max(0.,head-tail);
  vFade=pow(max(0.,1.-head/dynamics.y),.6)*(.83+.17*sin(accents.z+uTime*37.));vWhite=accents.w;
  return vec3(uSide*dynamics.w*age+sin(accents.z)*age*.10,
   max(.10,dynamics.z*age-6.2*age*age),(.85+accents.y)*age);
 }
`;
const sparkFragment=`uniform float uPower;varying float vFade,vWhite;
 void main(){vec2 p=gl_PointCoord-.5;float core=exp(-length(p)*15.);
 float cross=exp(-abs(p.x)*34.-abs(p.y)*8.)+exp(-abs(p.y)*34.-abs(p.x)*8.);
 vec3 color=mix(vec3(1.,.62,.20),vec3(1.,.98,.88),max(vWhite,core));
 gl_FragColor=vec4(color,(core+cross*.3)*vFade*uPower*1.65);}`;
const trailFragment=`uniform float uPower;varying float vFade,vWhite,vTail;
 void main(){gl_FragColor=vec4(mix(vec3(1.,.64,.23),vec3(.92,.97,1.),vWhite),vFade*uPower*(1.-vTail*.8));}`;
function particles(count,dynamics,accents,uniforms,vertex,fragment,lines=false){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));
 geometry.setAttribute('dynamics',new THREE.Float32BufferAttribute(dynamics,4));geometry.setAttribute('accents',new THREE.Float32BufferAttribute(accents,4));
 if(lines)geometry.setAttribute('tail',new THREE.Float32BufferAttribute(Array.from({length:count},(_,i)=>i%2),1));
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
 const mesh=lines?new THREE.LineSegments(geometry,material):new THREE.Points(geometry,material);mesh.frustumCulled=false;return mesh;
}
export function createStageFountains(parent,{lightTexture}){
 const jets=[],airbursts=[],capacity=320,airCapacity=640;let narrow=false,lastTime=0,lastPyro=null;
 for(let i=0;i<8;i++){
  const group=new THREE.Group(),dynamics=[],accents=[],lineDynamics=[],lineAccents=[];
  for(let k=0;k<capacity;k++){
   const seed=k+i*capacity,white=k%5<3,life=1.55+random(seed+8)*.55;
   const d=[random(seed+1)*life,life,12.7+random(seed+3)*1.8,.45+random(seed+5)*.50];
   const a=[k%13===0?.38:.19+random(seed+2)*.13,(random(seed+7)-.5)*.3,seed*3.2,white?1:0];
   dynamics.push(...d);accents.push(...a);for(let j=0;j<2;j++){lineDynamics.push(...d);lineAccents.push(...a);}
  }
  const uniforms={uTime:{value:0},uPower:{value:0},uSide:{value:1},uViewportHeight:{value:650}};
  const points=particles(capacity,dynamics,accents,uniforms,trajectory+`void main(){vec4 mv=modelViewMatrix*vec4(spark(0.),1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(accents.x*uViewportHeight/max(1.,-mv.z),1.,18.);}`,sparkFragment);
  const trails=particles(capacity*2,lineDynamics,lineAccents,uniforms,trajectory+`attribute float tail;varying float vTail;void main(){vTail=tail;gl_Position=projectionMatrix*modelViewMatrix*vec4(spark(tail*.075),1.);}`,trailFragment,true);group.add(points,trails);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:lightTexture,color:'#ffdaa0',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));glow.position.y=.18;glow.scale.set(1.4,1.4,1);group.add(glow);
  const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.10,.14,.19,10),new THREE.MeshStandardMaterial({color:'#303743',metalness:.8,roughness:.3}));nozzle.position.y=.1;group.add(nozzle);parent.add(group);
  jets.push({group,points,trails,glow,uniforms});group.visible=false;
 }
 const airTrajectory=`uniform float uTime,uStart,uPower,uViewportHeight;attribute vec4 dynamics,accents;varying float vFade,vWhite;
 vec3 spark(float tail){float head=max(0.,uTime-uStart-dynamics.w),age=max(0.,head-tail),spread=1.-exp(-age*2.2);
 vFade=pow(max(0.,1.-head/3.4),1.2)*smoothstep(0.,.06,uTime-uStart)*(.72+.28*sin(accents.z+uTime*27.));vWhite=accents.w;
 return vec3(dynamics.x*spread+accents.x*age*.22,dynamics.y*spread-.58*age*age,dynamics.z*spread);}`;
 for(let i=0;i<2;i++){
  const group=new THREE.Group(),ds=[],as=[],ld=[],la=[];
  for(let k=0;k<airCapacity;k++){const seed=k+i*airCapacity,angle=.04+random(seed+31)*Math.PI*.97,radius=4.2+random(seed+13)*2.6;
   const d=[Math.cos(angle)*radius,Math.sin(angle)*radius*.8,(random(seed+9)-.5)*1.7,random(seed+12)*.09],a=[(random(seed+20)-.5)*2,.17+random(seed+21)*.18,seed*2.8,k%3?1:0];
   ds.push(...d);as.push(...a);for(let j=0;j<2;j++){ld.push(...d);la.push(...a);}}
  const uniforms={uTime:{value:0},uStart:{value:0},uPower:{value:0},uViewportHeight:{value:650}};
  const points=particles(airCapacity,ds,as,uniforms,airTrajectory+`void main(){vec4 mv=modelViewMatrix*vec4(spark(0.),1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(accents.y*uViewportHeight/max(1.,-mv.z),1.,15.);}`,sparkFragment);
  const trails=particles(airCapacity*2,ld,la,uniforms,airTrajectory+`attribute float tail;varying float vTail;void main(){vTail=tail;gl_Position=projectionMatrix*modelViewMatrix*vec4(spark(tail*.16),1.);}`,trailFragment,true);
  group.add(points,trails);parent.add(group);group.visible=false;airbursts.push({group,points,trails,uniforms});
 }
 function setLayout(value){narrow=value;const s=stageSpec(narrow),slots=stageFountainSlots(narrow);
  jets.forEach((jet,i)=>{jet.enabled=i<slots.length;jet.group.visible=false;if(!jet.enabled)return;jet.group.position.fromArray(slots[i]);jet.uniforms.uSide.value=Math.sign(slots[i][0]);jet.points.geometry.setDrawRange(0,narrow?180:capacity);jet.trails.geometry.setDrawRange(0,(narrow?180:capacity)*2);});
  airbursts.forEach((burst,i)=>{burst.group.position.set((i?1:-1)*(narrow?2.7:5.8),narrow?8.1:10.3,s.back+1.25);burst.group.scale.setScalar(narrow?.68:1);burst.points.geometry.setDrawRange(0,narrow?320:airCapacity);burst.trails.geometry.setDrawRange(0,(narrow?320:airCapacity)*2);});
 }
 function update(time,fx,reduced,viewportHeight){lastTime=time;lastPyro=stagePyroAt(time,fx,narrow,reduced);
  jets.forEach((jet,i)=>{const power=jet.enabled?lastPyro.powers[i]:0;jet.group.visible=power>.015;jet.uniforms.uTime.value=time;jet.uniforms.uPower.value=power;jet.uniforms.uViewportHeight.value=viewportHeight;jet.glow.material.opacity=power*.8;});
  airbursts.forEach((burst,i)=>{burst.group.visible=lastPyro.airPowers[i]>0;burst.uniforms.uTime.value=time;burst.uniforms.uStart.value=lastPyro.airStarts[i];burst.uniforms.uPower.value=lastPyro.airPowers[i];burst.uniforms.uViewportHeight.value=viewportHeight;});
 }
 return {setLayout,update,get diagnostics(){return {motion:'vertex-shader',emitters:narrow?6:8,visible:jets.filter(j=>j.group.visible).length,particleCount:(narrow?6*180+2*320:8*capacity+2*airCapacity),time:lastTime,mode:lastPyro?.mode,flash:lastPyro?.flash||0,powers:lastPyro?.powers||[],positions:jets.filter(j=>j.enabled).map(j=>j.group.position.toArray()),airbursts:{emitters:2,visible:airbursts.filter(b=>b.group.visible).length,starts:lastPyro?.airStarts||[]}};}};
}
