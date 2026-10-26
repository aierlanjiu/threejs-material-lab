import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';

// Screen-space highlight glow for the concert stage. The normal frame is drawn
// first (keeping the characters' untone-mapped colours), then only its brightest
// pixels are blurred at low resolution and added back. Beams, pyro, wings and
// LED edges bloom; mid-tone artwork is untouched.
export function createBandGlow(renderer,{threshold=.74,knee=.2,downscale=4}={}){
 const size=new THREE.Vector2(),origin=new THREE.Vector2(0,0),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),scene=new THREE.Scene();
 const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const material=(fragmentShader,uniforms,extra={})=>new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,depthTest:false,depthWrite:false,...extra});
 const bright=material('uniform sampler2D tMap;uniform float uThreshold,uKnee;varying vec2 vUv;void main(){vec3 c=texture2D(tMap,vUv).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(uThreshold,uThreshold+uKnee,l),1.);}',
  {tMap:{value:null},uThreshold:{value:threshold},uKnee:{value:knee}});
 const blur=material('uniform sampler2D tMap;uniform vec2 uDir;varying vec2 vUv;void main(){vec3 s=texture2D(tMap,vUv).rgb*.227027;s+=(texture2D(tMap,vUv+uDir*1.3846).rgb+texture2D(tMap,vUv-uDir*1.3846).rgb)*.316216;s+=(texture2D(tMap,vUv+uDir*3.2308).rgb+texture2D(tMap,vUv-uDir*3.2308).rgb)*.07027;gl_FragColor=vec4(s,1.);}',
  {tMap:{value:null},uDir:{value:new THREE.Vector2()}});
 const composite=material('uniform sampler2D tNear,tFar;uniform float uStrength;varying vec2 vUv;void main(){vec3 g=texture2D(tNear,vUv).rgb*.6+texture2D(tFar,vUv).rgb*.9;gl_FragColor=vec4(g*uStrength,1.);}',
  {tNear:{value:null},tFar:{value:null},uStrength:{value:0}},{transparent:true,blending:THREE.AdditiveBlending});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),bright);quad.frustumCulled=false;scene.add(quad);
 let frame=null,near=[],far=[],lastStrength=0;
 const target=(w,h)=>new THREE.WebGLRenderTarget(w,h,{depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
 function release(){frame?.dispose();for(const t of [...near,...far])t.dispose();frame=null;near=[];far=[];}
 function ensure(){
  renderer.getDrawingBufferSize(size);if(frame&&frame.image.width===size.x&&frame.image.height===size.y)return;
  release();frame=new THREE.FramebufferTexture(size.x,size.y);
  // FramebufferTexture defaults to RGBA, which has sized WebGL2 storage.
  frame.minFilter=frame.magFilter=THREE.LinearFilter;
  const w=Math.max(2,Math.round(size.x/downscale)),h=Math.max(2,Math.round(size.y/downscale));
  near=[target(w,h),target(w,h)];far=[target(Math.max(2,w>>1),Math.max(2,h>>1)),target(Math.max(2,w>>1),Math.max(2,h>>1))];
 }
 function pass(mat,output){quad.material=mat;renderer.setRenderTarget(output);renderer.render(scene,camera);}
 function separable(input,pair,step=1){const [a,b]=pair;
  blur.uniforms.tMap.value=input;blur.uniforms.uDir.value.set(step/a.width,0);pass(blur,b);
  blur.uniforms.tMap.value=b.texture;blur.uniforms.uDir.value.set(0,step/a.height);pass(blur,a);}
 function apply(strength){
  lastStrength=strength;if(!(strength>.002))return;ensure();
  const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
  renderer.copyFramebufferToTexture(frame,origin);
  bright.uniforms.tMap.value=frame;pass(bright,near[0]);
  separable(near[0].texture,near);
  separable(near[0].texture,far);separable(far[0].texture,far,2);
  composite.uniforms.tNear.value=near[0].texture;composite.uniforms.tFar.value=far[0].texture;composite.uniforms.uStrength.value=strength;
  renderer.autoClear=false;quad.material=composite;renderer.setRenderTarget(null);renderer.render(scene,camera);
  renderer.autoClear=autoClear;renderer.setRenderTarget(previous);
 }
 return {apply,get strength(){return lastStrength;},dispose(){release();quad.geometry.dispose();bright.dispose();blur.dispose();composite.dispose();}};
}
