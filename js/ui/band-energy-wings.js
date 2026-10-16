import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
export {energyWingEnvelope as energyWingState} from '../audio/band-effects-timeline.js';

// Coordinates are in actor heights, with the origin at the actor's feet.
// The canonical curves borrow Tyrael's shoulder-first energy flow. Their upper
// arches are compressed for the existing large-head, short-body pet proportions.
const PLUMES = [
  [[.180,.395],[.38,.39],[.37,.66],[.44,.83],[.51,1.00],[.65,1.20],[.86,.75]],
  [[.180,.395],[.36,.41],[.42,.64],[.56,.73],[.70,.82],[.73,.76],[.81,.87]],
  [[.180,.395],[.39,.40],[.45,.57],[.61,.63],[.77,.69],[.75,.50],[.88,.57]],
  [[.180,.395],[.39,.36],[.45,.48],[.61,.50],[.77,.52],[.77,.36],[.90,.43]],
  [[.180,.395],[.37,.37],[.41,.41],[.55,.40],[.69,.39],[.62,.26],[.79,.29]],
  [[.180,.395],[.36,.35],[.40,.25],[.56,.28],[.72,.31],[.71,.17],[.86,.22]],
];
const attachments=Object.freeze({
  'one-piece/luffy':Object.freeze({x:.12,y:.37,centerX:.025}),
  'one-piece/usopp':Object.freeze({x:.12,y:.355,centerX:-.035,glowReach:.065,wingScale:.90}),
});
const defaultAttachment=Object.freeze({x:.12,y:.37,centerX:0,wingScale:.94});
export const energyWingAttachment=id=>attachments[id]||defaultAttachment;

function cubic(points,t) {
  const q=1-t;
  return [0,1].map(axis=>q*q*q*points[0][axis]+3*q*q*t*points[1][axis]+3*q*t*t*points[2][axis]+t*t*t*points[3][axis]);
}
function plumePoint(points,t) {
  const p=t<.5?cubic(points.slice(0,4),t*2):cubic(points.slice(3),t*2-1);
  p[0]=.18+(p[0]-.18)*.68;
  if(p[1]>.395)p[1]=.395+(p[1]-.395)*.53;
  return p;
}
function arcSamples(points,count) {
  const path=Array.from({length:801},(_,i)=>plumePoint(points,i/800)),lengths=[0];
  for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
  const total=lengths.at(-1),result=[];
  let index=1;
  for(let i=0;i<count;i++){
    const distance=total*i/(count-1);
    while(index<lengths.length-1&&lengths[index]<distance)index++;
    const mix=(distance-lengths[index-1])/(lengths[index]-lengths[index-1]);
    result.push(path[index-1].map((n,axis)=>THREE.MathUtils.lerp(n,path[index][axis],mix)));
  }
  return {points:result,spacing:total/(count-1)};
}

function makeGeometry(samples) {
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));
  geometry.setIndex([0,1,2,0,2,3]);
  const centers=[],directions=[],profiles=[];
  for(let side=-1;side<=1;side+=2)PLUMES.forEach((plume,strand)=>{
    const {points,spacing}=arcSamples(plume,samples);
    points.forEach((point,i)=>{
      const t=i/(samples-1),before=points[Math.max(0,i-1)],after=points[Math.min(samples-1,i+1)];
      const dx=(after[0]-before[0])*side,dy=after[1]-before[1],length=Math.hypot(dx,dy);
      const weight=[1.18,.62,1.06,.91,.70,.76][strand];
      const width=((.033+Math.sin(t*Math.PI)*.013)*Math.pow(1-t,1.25)+.00012)*weight;
      for(let layer=0;layer<5;layer++){
        centers.push(point[0]*side,point[1],-.045-strand*.002,t);
        directions.push(dx/length,dy/length,spacing*2.7,width);
        profiles.push(layer,strand,side,t);
      }
    });
  });
  // A broad cyan penumbra and concentrated white emission share each shoulder
  // attachment. Both sit behind the original pet's depth-tested silhouette.
  for(const side of [-1,1])for(let layer=5;layer<=6;layer++)for(let i=0;i<12;i++){
    const angle=i/12*Math.PI*2;
    centers.push(side*(.215+Math.cos(angle)*.014),.395+Math.sin(angle)*.010,-.065,0);
    directions.push(side,.04,layer===5?.100:.045,layer===5?.065:.025);
    profiles.push(layer,0,side,0);
  }
  geometry.setAttribute('aCenter',new THREE.InstancedBufferAttribute(new Float32Array(centers),4));
  geometry.setAttribute('aDirection',new THREE.InstancedBufferAttribute(new Float32Array(directions),4));
  geometry.setAttribute('aProfile',new THREE.InstancedBufferAttribute(new Float32Array(profiles),4));
  geometry.instanceCount=centers.length/4;
  return geometry;
}

const vertexShader=`
  uniform float uTime,uPower,uSpread,uDissolve;
  uniform vec4 uShoulder;
  uniform float uWingScale;
  uniform vec4 uOccluders[29];
  uniform int uOccluderCount;
  attribute vec4 aCenter,aDirection,aProfile;
  varying vec2 vUv;
  varying float vLayer,vAlpha,vHeat;
  void main(){
    float t=aCenter.w,strand=aProfile.y,side=aProfile.z;
    float layer=aProfile.x;
    vec3 p=aCenter.xyz;
    float attachment=layer>4.5?1.:1.-smoothstep(0.,.35,t);
    p.xy+=vec2(uShoulder.z+side*(uShoulder.x-.18),uShoulder.y-.395)*attachment;
    if(layer>4.5)p.x+=side*(uShoulder.w-.035);
    else p.xy=vec2(uShoulder.z+side*uShoulder.x,uShoulder.y)+(p.xy-vec2(uShoulder.z+side*uShoulder.x,uShoulder.y))*uWingScale;
    if(layer<4.5){p.x=mix(uShoulder.z+side*uShoulder.x,p.x,uSpread);p.y=mix(uShoulder.y,p.y,uSpread);}
    // Coherent motion along a plume preserves its uninterrupted silhouette.
    float wave=sin(uTime*1.08+t*5.1+strand*.72+side*.3);
    p.xy+=vec2(side*.009*wave,.012*sin(uTime*.83+t*4.8+strand*.8+side*.4))*pow(t,1.6)*uSpread;
    p.xy+=vec2(side*.12,.06*sin(strand*1.7+t*9.))*t*t*uDissolve;
    vec2 tangent=normalize(aDirection.xy),normal=vec2(-tangent.y,tangent.x);
    if(layer<4.5)p.xy+=normal*sin(t*23.-uTime*1.5+strand*2.1)*aDirection.w*.20*uSpread;
    if(layer>2.5&&layer<4.5)p.xy+=normal*aDirection.w*sin(t*14.-uTime*1.3+strand+layer*1.7)*1.6*sin(t*3.14159)*uSpread;
    float width=aDirection.w*(layer<.5?4.8:(layer<1.5?1.65:(layer<2.5?.46:(layer<3.5?.13:(layer<4.5?.07:1.)))));
    if(layer<4.5)width*=(.4+.6*uSpread)*uWingScale;
    p.xy+=normal*position.x*width+tangent*position.y*aDirection.z;
    float reveal=layer>4.5?1.:smoothstep(t-.09,t+.03,uSpread*1.13);
    float tipFade=1.-smoothstep(.975,1.,t);
    float dissolve=1.-smoothstep(1.-uDissolve*1.08-.08,1.-uDissolve*1.08+.08,t);
    float flow=.91+.09*sin(t*22.-uTime*4.+strand*.9);
    vAlpha=uPower*reveal*tipFade*dissolve*flow;
    if(layer<4.5)vAlpha*=1.30-.75*smoothstep(.08,.90,t);
    else vAlpha*=.85+.15*(1.-uSpread);
    vHeat=t;vLayer=layer;vUv=position.xy;
    vec4 clip=projectionMatrix*modelViewMatrix*vec4(p,1.);
    vec2 ndc=clip.xy/clip.w;
    for(int i=0;i<29;i++){
      if(i>=uOccluderCount)break;
      vec4 r=uOccluders[i];
      float covered=smoothstep(r.x-.006,r.x+.006,ndc.x)*(1.-smoothstep(r.z-.006,r.z+.006,ndc.x))*smoothstep(r.y-.006,r.y+.006,ndc.y)*(1.-smoothstep(r.w-.006,r.w+.006,ndc.y));
      vAlpha*=1.-covered;
    }
    gl_Position=clip;
  }`;
const fragmentShader=`
  uniform float uTime;
  varying vec2 vUv;
  varying float vLayer,vAlpha,vHeat;
  void main(){
    float gaussian=exp(-vUv.x*vUv.x*4.-vUv.y*vUv.y*3.);
    float envelope=(1.-smoothstep(.72,1.,abs(vUv.x)))*(1.-smoothstep(.72,1.,abs(vUv.y)));
    float gain=vLayer<.5?.027:(vLayer<1.5?.18:(vLayer<2.5?.56:(vLayer<4.5?.19:(vLayer<5.5?.067:.10))));
    vec3 tint=vLayer<.5?vec3(.005,.42,.78):(vLayer<1.5?vec3(.015,.78,1.):(vLayer<2.5?vec3(.84,1.,1.):(vLayer<4.5?vec3(.20,.86,1.):(vLayer<5.5?vec3(.025,.72,1.):vec3(.88,1.,1.)))));
    tint=mix(tint,tint*vec3(.38,.78,1.),smoothstep(.64,1.,vHeat)*.6);
    float texture=1.;
    if(vLayer>1.5&&vLayer<4.5)texture=.68+.32*sin(vUv.x*9.+vHeat*35.-uTime*3.);
    float alpha=gaussian*envelope*gain*vAlpha*texture;
    if(alpha<.0005)discard;
    gl_FragColor=vec4(tint,alpha);
  }`;

export function createEnergyWings(parent,{samples=280,compactSamples=samples}={}) {
  const geometry=makeGeometry(samples),compactGeometry=compactSamples===samples?geometry:makeGeometry(compactSamples);
  const uniforms={uTime:{value:0},uPower:{value:0},uSpread:{value:0},uDissolve:{value:0},uShoulder:{value:new THREE.Vector4(.12,.37,.025,.035)},uWingScale:{value:1},uOccluderCount:{value:0},uOccluders:{value:new Float32Array(29*4)}};
  const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false,forceSinglePass:true});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.frustumCulled=false;mesh.visible=false;parent.add(mesh);
  return {
    mesh,
    update({time,state,height=1,body,art,shoulder=energyWingAttachment('one-piece/luffy'),narrow=false,occluders=[]}){
      mesh.visible=state.power>.001;
      mesh.geometry=narrow?compactGeometry:geometry;
      uniforms.uTime.value=time;uniforms.uPower.value=state.power;
      uniforms.uSpread.value=state.spread||0;uniforms.uDissolve.value=state.dissolve||0;
      uniforms.uShoulder.value.set(shoulder.x,shoulder.y,shoulder.centerX||0,shoulder.glowReach??.035);
      uniforms.uWingScale.value=shoulder.wingScale??1;
      uniforms.uOccluderCount.value=Math.min(29,occluders.length);
      for(let i=0;i<uniforms.uOccluderCount.value;i++){const r=occluders[i];uniforms.uOccluders.value.set([r.left,r.bottom,r.right,r.top],i*4);}
      if(!mesh.visible)return;
      if(body)mesh.position.copy(body.position);
      if(art)mesh.rotation.set(0,art.rotation.y,body?.rotation.z||0);
      mesh.scale.setScalar(height);
    },
    get diagnostics(){return {plumesPerSide:PLUMES.length,particles:mesh.geometry.instanceCount,pureParticles:true,visible:mesh.visible,power:uniforms.uPower.value,spread:uniforms.uSpread.value,dissolve:uniforms.uDissolve.value,occluders:uniforms.uOccluderCount.value,shoulder:{x:uniforms.uShoulder.value.x,y:uniforms.uShoulder.value.y,centerX:uniforms.uShoulder.value.z,glowReach:uniforms.uShoulder.value.w},proportions:{spanScale:.68,upperRiseScale:.53,actorScale:uniforms.uWingScale.value}};},
    dispose(){parent.remove(mesh);geometry.dispose();if(compactGeometry!==geometry)compactGeometry.dispose();material.dispose();},
  };
}
