import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {stageSpec,stageHeightAt} from '../audio/band-stage-layout.js';

const random=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const trajectory=`
 uniform float uTime,uPower,uSide,uPair,uViewportHeight;
 attribute vec4 dynamics,accents;
 varying float vFade,vWhite;
 vec3 spark(float tail){
  float life=dynamics.y,head=mod(uTime*(1.12+uPair*.025)+dynamics.x,life);
  float age=max(0.,head-tail),flicker=.78+.22*sin(accents.z+uTime*37.);
  vFade=max(0.,1.-head/life)*flicker;vWhite=accents.w;
  return vec3(uSide*dynamics.w*age+sin(accents.z)*age*.08,
   max(.13,dynamics.z*age-6.2*age*age),accents.y*age);
 }
`;
export function createStageFountains(parent,{lightTexture}){
 const jets=[],capacity=480;let narrow=false,lastTime=0;
 for(let i=0;i<6;i++){
  const group=new THREE.Group(),dynamics=[],accents=[],lineDynamics=[],lineAccents=[],ends=[];
  for(let k=0;k<capacity;k++){
   const seed=k+i*capacity,white=k%5<3,life=.82+random(seed+8)*.60;
   const d=[random(seed+1)*life+i*.19,life,white?10.2+random(seed+3)*4.3:8.5+random(seed+3)*7.7,.12+random(seed+5)*(white?.55:1.45)];
   const a=[k%13===0?.38:.18+random(seed+2)*.16,(random(seed+7)-.5)*.35,seed*3.2,white?1:0];
   dynamics.push(...d);accents.push(...a);for(let end=0;end<2;end++){lineDynamics.push(...d);lineAccents.push(...a);ends.push(end);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(capacity*3),3));geometry.setAttribute('dynamics',new THREE.Float32BufferAttribute(dynamics,4));geometry.setAttribute('accents',new THREE.Float32BufferAttribute(accents,4));
  const uniforms={uTime:{value:0},uPower:{value:0},uSide:{value:i%2?1:-1},uPair:{value:Math.floor(i/2)},uViewportHeight:{value:650}};
  const points=new THREE.Points(geometry,new THREE.ShaderMaterial({uniforms,vertexShader:trajectory+`void main(){vec4 mv=modelViewMatrix*vec4(spark(0.),1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(accents.x*uViewportHeight/max(1.,-mv.z),1.,18.);}`,fragmentShader:`uniform float uPower;varying float vFade,vWhite;void main(){vec2 p=gl_PointCoord-.5;float r=length(p);float core=exp(-r*15.);float cross=exp(-abs(p.x)*34.-abs(p.y)*8.)+exp(-abs(p.y)*34.-abs(p.x)*8.);vec3 color=mix(vec3(1.,.63,.22),vec3(1.,.97,.85),max(vWhite,core));gl_FragColor=vec4(color,(core+cross*.38)*vFade*uPower*1.8);}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));points.frustumCulled=false;group.add(points);
  const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(capacity*6),3));lineGeometry.setAttribute('dynamics',new THREE.Float32BufferAttribute(lineDynamics,4));lineGeometry.setAttribute('accents',new THREE.Float32BufferAttribute(lineAccents,4));lineGeometry.setAttribute('tail',new THREE.Float32BufferAttribute(ends,1));
  const trails=new THREE.LineSegments(lineGeometry,new THREE.ShaderMaterial({uniforms,vertexShader:trajectory+`attribute float tail;varying float vTail;void main(){vTail=tail;gl_Position=projectionMatrix*modelViewMatrix*vec4(spark(tail*.065),1.);}`,fragmentShader:`uniform float uPower;varying float vFade,vWhite,vTail;void main(){vec3 color=mix(vec3(1.,.64,.23),vec3(1.,.96,.82),vWhite);gl_FragColor=vec4(color,vFade*uPower*(1.-vTail*.72));}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));trails.frustumCulled=false;group.add(trails);
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.65,.045,1,20,1,true),new THREE.ShaderMaterial({uniforms,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uTime,uPower;varying vec2 vUv;void main(){float flow=.72+.28*sin(vUv.y*42.-uTime*45.);float a=pow(1.-vUv.y,.65)*pow(sin(vUv.x*3.14159),2.)*flow*uPower*.30;gl_FragColor=vec4(1.,.87,.52,a);}`,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));group.add(core);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:lightTexture,color:'#ffdda1',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));glow.position.y=.22;glow.scale.set(1.4,1.4,1);group.add(glow);
  const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.10,.14,.20,10),new THREE.MeshStandardMaterial({color:'#303743',metalness:.8,roughness:.3}));nozzle.position.y=.1;group.add(nozzle);parent.add(group);
  group.visible=false;jets.push({group,points,trails,core,glow,uniforms});
 }
 function setLayout(value){narrow=value;const s=stageSpec(narrow);
  jets.forEach((jet,i)=>{const pair=Math.floor(i/2),side=i%2?1:-1,x=side*(narrow?[5.8,6.1,5.75][pair]:[12.85,12.0,10.5][pair]),z=narrow?[5.6,1.2,-3.1][pair]:s.back+[4.1,6.4,8.7][pair];
   jet.group.position.set(x,stageHeightAt(x,z,narrow)+.08,z);const count=narrow?240:capacity;jet.points.geometry.setDrawRange(0,count);jet.trails.geometry.setDrawRange(0,count*2);
   const height=(narrow?5.7:5.5)+pair*.7;jet.core.scale.y=height;jet.core.position.set(side*.25,height/2+.13,0);jet.core.rotation.z=-side*.085;
  });
 }
 function update(time,fx,reduced,viewportHeight){lastTime=time;const start=fx.bursts.at(-1);
  jets.forEach((jet,i)=>{const pair=Math.floor(i/2),phase=start===undefined?-1:(time-start-pair*.12)/2.5,pulse=phase>0&&phase<1?Math.sin(phase*Math.PI):0;
   const power=reduced?0:Math.max(fx.intensity,pulse*.85);jet.group.visible=power>.04;
   // Static attributes stay on the GPU; only the clock, power and viewport change.
   jet.uniforms.uTime.value=time;jet.uniforms.uPower.value=power;jet.uniforms.uViewportHeight.value=viewportHeight;jet.glow.material.opacity=power*.92;
  });
 }
 return {setLayout,update,get diagnostics(){return {motion:'vertex-shader',emitters:6,visible:jets.filter(j=>j.group.visible).length,particleCount:6*(narrow?240:capacity),time:lastTime,powers:jets.map(j=>j.uniforms.uPower.value)};}};
}
