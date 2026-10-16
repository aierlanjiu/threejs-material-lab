import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';

const vertexShader=`
 uniform float uTime,uPower,uSpread,uDissolve,uNarrow,uViewportHeight,uPixelRatio;
 uniform vec4 uOccluders[29];uniform int uOccluderCount;
 attribute vec4 wing;varying vec2 vUv;varying float vAlpha,vHeat;
 vec3 feather(float t,float side,float f,float seed){
   float unfold=.08+.92*uSpread,span=mix(1.,.62,uNarrow)*unfold;
   float q=1.-t;
   float x=(3.*q*q*t*.12+3.*q*t*t*(.72+f*.08)+t*t*t*(1.08+f*.17))*side*span;
   float y=q*q*q*.52+3.*q*q*t*(1.10-f*.48)+3.*q*t*t*(1.50-f*.80)+t*t*t*(1.16-f*1.12);
   y=.52+(y-.52)*unfold;
   x+=sin(seed*19.+uTime*1.7+t*8.)*.008*t;
   y+=sin(uTime*2.1+t*7.+f*2.)*.018*t;
   vec3 p=vec3(x,y,-.09-sin(t*3.14159)*.045);
   p+=vec3(side*t*.25,t*.25,sin(seed*11.)*.12)*uDissolve;
   return p;
 }
 void main(){
   float t=fract(wing.z+uTime*(.10+wing.y*.025)),seed=wing.w;
   vec3 p=feather(t,wing.x,wing.y,seed),prior=feather(max(0.,t-.025),wing.x,wing.y,seed);
   p.xy+=vec2(sin(seed*56.),cos(seed*87.))*(.0025+.008*t);
   vec4 clip=projectionMatrix*modelViewMatrix*vec4(p,1.);
   vec4 before=projectionMatrix*modelViewMatrix*vec4(prior,1.);
   float aspect=projectionMatrix[1][1]/projectionMatrix[0][0];vec2 res=vec2(uViewportHeight*aspect,uViewportHeight);
   vec2 delta=(clip.xy/clip.w-before.xy/before.w)*res;
   vec2 dir=length(delta)>.001?normalize(delta):vec2(0.,1.),normal=vec2(-dir.y,dir.x);
   float width=mix(.65,1.25,fract(seed*3.7))*uPixelRatio,lengthPx=mix(3.,12.,t)*(.55+.45*uSpread)*uPixelRatio;
   clip.xy+=(normal*position.x*width+dir*position.y*lengthPx)/res*2.*clip.w;
   vAlpha=uPower*(.36+.64*pow(sin(t*3.14159),.35))*(1.-smoothstep(.90,1.,t))*(.62+.38*sin(seed*12.+uTime*4.)*sin(seed*12.+uTime*4.));
   vec2 ndc=clip.xy/clip.w;
   for(int i=0;i<29;i++){if(i>=uOccluderCount)break;vec4 r=uOccluders[i];
     float inside=smoothstep(r.x-.009,r.x+.009,ndc.x)*(1.-smoothstep(r.z-.009,r.z+.009,ndc.x))*smoothstep(r.y-.009,r.y+.009,ndc.y)*(1.-smoothstep(r.w-.009,r.w+.009,ndc.y));
     vAlpha*=1.-inside;
   }
   vHeat=t;vUv=position.xy;gl_Position=clip;
 }`;
const fragmentShader=`
 varying vec2 vUv;varying float vAlpha,vHeat;
 void main(){float core=exp(-vUv.x*vUv.x*7.-vUv.y*vUv.y*1.8),halo=exp(-dot(vUv,vUv)*2.8);
   float a=(core*.72+halo*.12)*vAlpha;if(a<.008)discard;
   vec3 color=mix(vec3(.80,1.,1.),vec3(.04,.70,1.),smoothstep(.0,.55,vHeat));
   gl_FragColor=vec4(color,a);
 }`;
function geometryFor() {
  const g=new THREE.InstancedBufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));g.setIndex([0,1,2,0,2,3]);
  const data=[];
  for(let i=0;i<2000;i++){const seed=(Math.sin(i*127.1+53.7)*43758.5453)%1;data.push(i%2?1:-1,(Math.floor(i/2)%8)/7,(i*.61803398875)%1,Math.abs(seed));}
  g.setAttribute('wing',new THREE.InstancedBufferAttribute(new Float32Array(data),4));g.instanceCount=2000;return g;
}
export function createParticleWings(parent) {
  const geometry=geometryFor(),uniforms={uTime:{value:0},uPower:{value:0},uSpread:{value:0},uDissolve:{value:0},uNarrow:{value:0},uViewportHeight:{value:800},uPixelRatio:{value:1},uOccluderCount:{value:0},uOccluders:{value:Array.from({length:29},()=>new THREE.Vector4())}};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.visible=false;parent.add(mesh);
  return {mesh,update({time,state,narrow,height,viewportHeight,pixelRatio=1,body,art,occluders=[]}){
    mesh.visible=state.power>.005;if(!mesh.visible)return;
    mesh.position.copy(body.position);mesh.rotation.set(0,art.rotation.y,body.rotation.z);mesh.scale.setScalar(height);
    uniforms.uTime.value=time;uniforms.uPower.value=state.power;uniforms.uSpread.value=state.spread;uniforms.uDissolve.value=state.dissolve||0;
    uniforms.uNarrow.value=narrow?1:0;uniforms.uViewportHeight.value=viewportHeight;uniforms.uPixelRatio.value=pixelRatio;uniforms.uOccluderCount.value=Math.min(29,occluders.length);
    occluders.slice(0,29).forEach((r,i)=>uniforms.uOccluders.value[i].set(r.left,r.bottom,r.right,r.top));geometry.instanceCount=narrow?800:2000;
  },get diagnostics(){return {visible:mesh.visible,particles:geometry.instanceCount,power:uniforms.uPower.value,spread:uniforms.uSpread.value,occluders:uniforms.uOccluderCount.value,pureParticles:true};}};
}
