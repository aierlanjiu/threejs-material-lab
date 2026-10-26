import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {mergeGeometries} from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/utils/BufferGeometryUtils.js/+esm';
import {Reflector} from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/objects/Reflector.js/+esm';
import {stageSpec} from '../audio/band-stage-layout.js';
import {createStageFountains} from './band-fountains.js';

export const FESTIVAL_LOOKS=['cream','island'];

const PALETTES={
 cream:{
  'one-piece':{cool:'#52a8a0',warm:'#dc8e48',glass:'#b6e6df',water:'#366864',shallow:'#6eb2a8',sand:'#c2ded6',horizon:'#90b8b2',sun:'#fff0d0',skyTint:'#d8ebe5',coral:'#3ea6b6'},
  'dragon-ball':{cool:'#50a87c',warm:'#de9230',glass:'#bee6cb',water:'#346858',shallow:'#70b49c',sand:'#c4dfce',horizon:'#92baa6',sun:'#ffeed0',skyTint:'#dbebe0',coral:'#d48c26'},
  naruto:{cool:'#6482aa',warm:'#d0745a',glass:'#c6d4ea',water:'#3e6274',shallow:'#749eb4',sand:'#c6d4de',horizon:'#92a8b4',sun:'#ffeee0',skyTint:'#dae2e8',coral:'#589a7a'}
 },
 island:{
  'one-piece':{cool:'#1c7c88',warm:'#e47e30',glass:'#5ac8d2',water:'#0e4650',shallow:'#2ea4a0',sand:'#c29a68',horizon:'#b85230',sun:'#ffc468',skyTint:'#f09c68',coral:'#2896a2'},
  'dragon-ball':{cool:'#1e7a6e',warm:'#e6781c',glass:'#60ccb6',water:'#10484a',shallow:'#32a68e',sand:'#c49c66',horizon:'#bc542c',sun:'#ffca60',skyTint:'#f09e64',coral:'#cc7a1a'},
  naruto:{cool:'#22687c',warm:'#dc663e',glass:'#66b4c6',water:'#12404e',shallow:'#3696a4',sand:'#c09668',horizon:'#b44c2e',sun:'#ffbe6e',skyTint:'#e89668',coral:'#509670'}
 }
};

// Geometry owns the scenery. The actor support footprint stays compatible with all formations.
export function createFestivalStage(scene,{modelBundle=null,festivalTextures={}}={}){
 const root=new THREE.Group();root.name='festival-stage';scene.add(root);
 const effects=new THREE.Group();scene.add(effects);const fountains=createStageFountains(effects);
 let look='cream',theme='one-piece',narrow=null,disposed=false,revision=0,animated=[],edges=[],luminous=[],lastLighting=null;
 let water=null,sharedGlassMat=null,sharedOrbMat=null;
 let lookMix=1,lookTransition=null,lookSurfaces={};
 const palette=()=>({...((PALETTES[look]||PALETTES.cream)[theme]||PALETTES.cream['one-piece'])});
 function applyLookMix(){
  if(!lookTransition)return;
  const t=1-Math.pow(1-lookMix,3),from=lookTransition.from,to=palette();
  const color=(key)=>new THREE.Color(from[key]).lerp(new THREE.Color(to[key]),t);
  scene.background.copy(color('horizon'));
  const sky=root.getObjectByName('festival-distant-backdrop')?.material.uniforms;
  if(sky){
   sky.uLookMix.value=t;sky.uIsland.value=THREE.MathUtils.lerp(lookTransition.fromLook==='island'?1:0,look==='island'?1:0,t);
   for(const [uniform,key] of [['uHorizon','horizon'],['uSkyTint','skyTint'],['uSun','sun'],['uAccent','cool']])sky[uniform].value.copy(color(key));
  }
  if(water){const u=water.material.uniforms;
   for(const [uniform,key] of [['color','water'],['uShallow','shallow'],['uSand','sand'],['uHorizon','horizon'],['uSun','sun']])u[uniform].value.copy(color(key));
   u.uSea.value=THREE.MathUtils.lerp(lookTransition.fromLook==='island'?1:0,look==='island'?1:0,t);
  }
  for(const [name,material] of Object.entries(lookSurfaces)){
   const target=lookTransition.surfaces[name];if(!target)continue;
   material.color.copy(target.from).lerp(target.to,t);material.roughness=THREE.MathUtils.lerp(target.fromRoughness,target.toRoughness,t);
  }
  if(lookMix>=1)lookTransition=null;
 }
 const materialCache=new Map();

 function cachedMat(key,factory){
  if(!materialCache.has(key)){
   const m=factory();
   m.userData.persistent=true;
   materialCache.set(key,m);
  }
  return materialCache.get(key);
 }

 const mat=(color,roughness=.58,metalness=.08)=>cachedMat(`std:${color}:${roughness}:${metalness}`,()=>new THREE.MeshStandardMaterial({color,roughness,metalness}));

 function mesh(g,m,x=0,y=0,z=0){
  const o=new THREE.Mesh(g,m);
  o.position.set(x,y,z);
  o.receiveShadow=true;
  o.castShadow=true;
  root.add(o);
  return o;
 }

 function tube(points,r,m,segments=56,radial=10){
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,r,radial,false),m);
 }

 function clear(){
  if(water)root.remove(water);
  const gs=new Set(),ms=new Set();
  root.traverse(o=>{
   if(o.geometry&&!o.userData.borrowed)gs.add(o.geometry);
   for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!m.userData?.persistent)ms.add(m);
  });
  gs.forEach(g=>g.dispose());
  ms.forEach(m=>m.dispose());
  root.clear();
  animated=[];
  edges=[];
  luminous=[];
 }

 function shape(level){
  const s=stageSpec(narrow),sh=new THREE.Shape();
  if(narrow){
   const w=s.widths[level]/2,front=s.fronts[level],back=s.back;
   sh.moveTo(-w,back);
   sh.lineTo(w,back);
   sh.lineTo(w,front-.55);
   sh.quadraticCurveTo(w,front+.38,w-.8,front+.48);
   sh.quadraticCurveTo(0,front+(look==='cream'?1.08:.72),-w+.8,front+.48);
   sh.quadraticCurveTo(-w,front+.38,-w,front-.55);
   sh.closePath();
  }else{
   const r=s.radii[level];
   sh.moveTo(-r,s.back);
   for(let i=0;i<=96;i++){
    const a=Math.PI-i/96*Math.PI;
    const extra=look==='cream'?.62*Math.sin(a*3)**2:.32*Math.sin(a);
    const rr=r+extra;
    sh.lineTo(Math.cos(a)*rr,s.back+Math.sin(a)*rr);
   }
   sh.closePath();
  }
  return sh;
 }

 function extrude(sh,height,m,x=0,y=0,z=0){
  const g=new THREE.ExtrudeGeometry(sh,{depth:height,bevelEnabled:true,bevelThickness:.038,bevelSize:.065,bevelSegments:3,curveSegments:48});
  g.rotateX(-Math.PI/2); // 2D Y becomes negative world Z.
  g.scale(1,1,-1);
  const pos=g.attributes.position,normal=g.attributes.normal,uv=g.attributes.uv;
  for(let i=0;i<pos.count;i+=3){
   for(const a of [pos,normal,uv]){
    if(!a)continue;
    for(let k=0;k<a.itemSize;k++){
     const t=a.array[(i+1)*a.itemSize+k];
     a.array[(i+1)*a.itemSize+k]=a.array[(i+2)*a.itemSize+k];
     a.array[(i+2)*a.itemSize+k]=t;
    }
   }
  }
  g.computeVertexNormals();
  return mesh(g,m,x,y,z);
 }

 function ellipse(rx,rz,m,x,y,z,thickness=.25){
  const sh=new THREE.Shape();
  sh.absellipse(0,0,rx,rz,0,Math.PI*2,false,0);
  return extrude(sh,thickness,m,x,y,z);
 }

 function placeGlb(id,{x=0,y=0,z=0,height=1,width=null,rotation=0,tint=null,emissive=null,emissiveIntensity=0,roughness=.45,metalness=.12,top=false}={}){
  const source=modelBundle?.models.get(id);
  if(!source)return null;
  const group=new THREE.Group();
  const scale=width?width/source.size.x:height;
  group.position.set(x,y,z);
  group.rotation.y=rotation;
  group.scale.setScalar(scale);
  for(const p of source.parts){
   const matKey=`glb:${id}:${p.material.uuid}:${tint||''}:${emissive||''}:${emissiveIntensity}:${roughness}:${metalness}`;
   const m=cachedMat(matKey,()=>{
    const c=p.material.clone();
    if('transmission' in c)c.transmission=0;
    c.transparent=false;
    c.opacity=1;
    c.depthWrite=true;
    c.roughness=roughness;
    c.metalness=metalness;
    if(tint&&c.color){
     if(id==='speaker'||id==='monitor'||id==='amp'){
      const hsl={h:0,s:0,l:0};c.color.getHSL(hsl);
      if(hsl.l>.26||p.material.name==='metal'){
       c.color.set('#d8ad72');
       c.metalness=.54;c.roughness=.26;
      }else{
       c.color.set(look==='island'?'#8a6d52':'#b9b2a2');
       c.metalness=.26;c.roughness=.38;
      }
     }else if(id==='quartz'||id==='lantern'||id==='bonsai'||id==='island')c.color.lerp(new THREE.Color(tint),.35);
     else c.color.set(tint);
    }
    if(emissive&&c.emissive){
     c.emissive.set(emissive);
     c.emissiveIntensity=emissiveIntensity;
    }
    return c;
   });
   if(emissiveIntensity>0&&m.emissive)luminous.push({m,base:emissiveIntensity});
   const o=new THREE.Mesh(p.geometry,m);
   o.castShadow=true;
   o.receiveShadow=true;
   o.userData.borrowed=true;
   if(top)o.position.y=-1;
   group.add(o);
  }
  root.add(group);
  return group;
 }

 function backdrop(pal,zHorizon){
  const island=look==='island';
  const tex=festivalTextures[look]||null;
  const m=new THREE.ShaderMaterial({
   depthWrite:false,
   toneMapped:false,
   uniforms:{
    uTex:{value:tex},
    uFromTex:{value:festivalTextures[lookTransition?.fromLook||look]||tex},
    uFromIsland:{value:(lookTransition?.fromLook||look)==='island'?1:0},
    uTargetIsland:{value:island?1:0},
    uLookMix:{value:lookMix},
    uHasTex:{value:tex?1:0},
    uIsland:{value:island?1:0},
    uTime:{value:0},
    uBeat:{value:0},
    uNarrow:{value:narrow?1:0},
    uHorizon:{value:new THREE.Color(pal.horizon)},
    uSkyTint:{value:new THREE.Color(pal.skyTint)},
    uSun:{value:new THREE.Color(pal.sun)},
    uAccent:{value:new THREE.Color(pal.cool)}
   },
   vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`
    varying vec2 vUv;
    uniform sampler2D uTex,uFromTex;
    uniform float uHasTex,uIsland,uTime,uBeat,uNarrow,uFromIsland,uTargetIsland,uLookMix;
    uniform vec3 uHorizon,uSkyTint,uSun,uAccent;
    void main(){
     vec2 p=vUv;
     vec3 col;
     if(uHasTex>.5){
      // Map the central camera frustum span to [0,1] of the panorama (showing left/right islands & mountains)
      // while seamlessly mirror-wrapping the outer overscan wings so the sky fills 100% of any aspect ratio.
      float uSpan=mix(0.60,0.58,uNarrow);
      float rawX=(p.x-0.5)/uSpan+0.5;
      float mirroredX=1.0-abs(1.0-mod(abs(rawX),2.0));
      float yBase=mix(0.496,0.546,uTargetIsland);
      vec2 uv=vec2(clamp(mirroredX,0.004,0.996),mix(yBase,0.992,clamp(p.y,0.0,1.0)));
      col=texture2D(uTex,uv).rgb;
      vec2 previousUv=vec2(uv.x,mix(mix(.496,.546,uFromIsland),.992,clamp(p.y,0.,1.)));
      col=mix(texture2D(uFromTex,previousUv).rgb,col,uLookMix);
      col=mix(col,col*uSkyTint,0.16);
     }else{
      vec3 topCol=mix(vec3(0.76,0.87,0.86),vec3(0.92,0.54,0.44),uIsland);
      col=mix(uHorizon,topCol,smoothstep(0.0,1.0,p.y));
     }
     // Subtle breathing solar/auroral glow in the sky
     vec2 sunPos=mix(vec2(0.50,0.22),vec2(0.60,0.25),uIsland);
     float sunDist=length((p-sunPos)*vec2(1.6,1.0));
     float sunGlow=exp(-sunDist*4.2)*(0.14+uBeat*0.08);
     col+=uSun*sunGlow;
     // Gentle upper atmospheric tint per anime theme
     float aurora=sin(p.x*9.0+uTime*0.25)*0.5+0.5;
     col=mix(col,uAccent,aurora*smoothstep(0.35,0.95,p.y)*0.05);
     // Crisp atmospheric horizon join where 3D water meets the mountains/islands
     float baseMist=1.0-smoothstep(0.0,0.026,p.y);
     col=mix(col,uHorizon,baseMist*0.36);
     gl_FragColor=vec4(col,1.0);
    }`
  });
  const w=narrow?48:96,h=narrow?20:22;
  const sky=mesh(new THREE.PlaneGeometry(w,h),m,0,-0.68+h*0.5,zHorizon-0.12);
  sky.name='festival-distant-backdrop';
  sky.renderOrder=-2;
  sky.castShadow=false;
  sky.receiveShadow=false;
  animated.push({kind:'sky',m});
 }

 function createWater(pal,zHorizon){
  const island=look==='island';
  // Keep one mirror camera: Three.js caches transmission targets per camera.
  if(water){
   const u=water.material.uniforms;
   u.color.value.set(pal.water);
   u.uShallow.value.set(pal.shallow);
   u.uSand.value.set(pal.sand);
   u.uHorizon.value.set(pal.horizon);
   u.uSun.value.set(pal.sun);
   u.uSea.value=island?1:0;
   u.uNarrow.value=narrow?1:0;
   u.uZHorizon.value=zHorizon;
   water.getRenderTarget().setSize(narrow?256:512,narrow?256:512);
   water.name=island?'open-sea':'quiet-lake';
   water.position.set(0,-.66,zHorizon+50);
   root.add(water);
   return;
  }
  water=new Reflector(new THREE.PlaneGeometry(240,100),{
   textureWidth:narrow?256:512,
   textureHeight:narrow?256:512,
   multisample:0,
   clipBias:.003,
   color:pal.water,
   shader:{
    name:'FestivalWater',
    uniforms:{
     tDiffuse:{value:null},
     textureMatrix:{value:new THREE.Matrix4()},
     color:{value:new THREE.Color(pal.water)},
     uShallow:{value:new THREE.Color(pal.shallow)},
     uSand:{value:new THREE.Color(pal.sand)},
     uHorizon:{value:new THREE.Color(pal.horizon)},
     uSun:{value:new THREE.Color(pal.sun)},
     uTime:{value:0},
     uBeat:{value:0},
     uSea:{value:island?1:0},
     uNarrow:{value:narrow?1:0},
     uZHorizon:{value:zHorizon}
    },
    vertexShader:`
     uniform mat4 textureMatrix;
     varying vec4 vUv;
     varying vec3 vWorld;
     void main(){
      vUv=textureMatrix*vec4(position,1.0);
      vec4 world=modelMatrix*vec4(position,1.0);
      vWorld=world.xyz;
      gl_Position=projectionMatrix*viewMatrix*world;
     }`,
    fragmentShader:`
     uniform vec3 color,uShallow,uSand,uHorizon,uSun;
     uniform float uTime,uBeat,uSea,uNarrow,uZHorizon;
     uniform sampler2D tDiffuse;
     varying vec4 vUv;
     varying vec3 vWorld;
     float wave(vec2 p,vec2 d,float f,float s,float t){
      return sin(dot(p,d)*f+t*s);
     }
     void main(){
      vec2 p=vWorld.xz;
      float t=uTime*mix(.55,.88,uSea);
      float freq=mix(.36,.52,uSea);
      float w=wave(p,vec2(.86,.51),freq,1.15,t)
             +wave(p,vec2(-.64,.77),freq*1.48,-1.35,t)*.62
             +wave(p,vec2(.22,-.97),freq*2.35,1.72,t)*.34
             +wave(p,vec2(.93,-.36),freq*3.40,-2.05,t)*.18;
      float gx=cos(dot(p,vec2(.86,.51))*freq+t*1.15)*.86
              -cos(dot(p,vec2(-.64,.77))*freq*1.48-t*1.35)*.40
              +cos(dot(p,vec2(.22,-.97))*freq*2.35+t*1.72)*.18;
      float gz=cos(dot(p,vec2(.86,.51))*freq+t*1.15)*.51
              +cos(dot(p,vec2(-.64,.77))*freq*1.48-t*1.35)*.48
              -cos(dot(p,vec2(.22,-.97))*freq*2.35+t*1.72)*.72;
      float distanceFade=1.-smoothstep(-6.,28.,-vWorld.z);
      float chop=mix(.055,.115,uSea)*(0.45+0.55*distanceFade);
      vec3 normal=normalize(vec3(-gx*chop,1.,-gz*chop));
      vec3 viewDir=normalize(cameraPosition-vWorld);
      float fresnel=pow(1.-max(dot(viewDir,normal),0.),3.0);

      // Stage shoreline distance field (elliptical amphitheatre + side wings)
      vec2 q=vec2(p.x/mix(22.4,14.5,uNarrow),(p.y+2.0)/12.4);
      float dStage=length(q)-1.0;
      float shallowMask=1.-smoothstep(-0.08,0.58,dStage);
      float sandRing=exp(-pow((dStage-0.05)/0.14,2.0));
      float foam=exp(-pow((dStage-0.025)/0.055,2.0))*(0.55+0.45*sin(dStage*38.0-uTime*2.4+w*1.5));

      vec4 uv=vUv;
      uv.xy+=normal.xz*mix(.026,.052,uSea)*uv.w;
      vec3 refl=texture2DProj(tDiffuse,uv).rgb;

      // Rich shallow lagoon to deep sea/lake gradient + golden sandbar reef glow
      vec3 waterBase=mix(color,uShallow,shallowMask*mix(0.65,0.82,uSea)+0.16*smoothstep(-8.,16.,vWorld.z));
      waterBase=mix(waterBase,uSand,sandRing*mix(0.38,0.68,uSea));
      float caustic=(sin(p.x*1.8+w*1.6+t)+sin(p.y*2.1-w*1.4-t*.8))*.25+.5;
      waterBase+=uSand*caustic*shallowMask*mix(.06,.14,uSea);

      vec3 col=mix(waterBase,refl,clamp(mix(.26,.18,uSea)+fresnel*mix(.46,.34,uSea),0.,.68));
      col=mix(col,uSand,foam*mix(.28,.48,uSea));

      // Sun-path shimmer & beat-reactive specular highlights
      vec3 sunDir=normalize(vec3(mix(0.0,0.36,uSea),.28,-.86));
      vec3 halfDir=normalize(sunDir+viewDir);
      float sparkle=pow(max(dot(normal,halfDir),0.),mix(210.,115.,uSea));
      float sunPath=exp(-pow((p.x-mix(0.0,5.2,uSea))/mix(9.5,7.2,uSea),2.0));
      col+=uSun*sparkle*(mix(.26,.72,uSea)+uBeat*.18)*distanceFade;
      col+=uSun*sunPath*(0.06+0.08*uSea)*(0.5+0.5*caustic)*distanceFade;

      // Crisp horizon blend where the water plane meets the distant mountains/islands
      float horizonBlend=1.-smoothstep(uZHorizon,uZHorizon+1.6,vWorld.z);
      col=mix(col,uHorizon,horizonBlend*0.62);

      gl_FragColor=vec4(col,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
     }`
   }
  });
  const reflect=water.onBeforeRender;
  water.onBeforeRender=function(...args){
   const sky=root.getObjectByName('festival-distant-backdrop'),background=scene.background;
   if(sky)sky.visible=false;
   scene.background=water.material.uniforms.color.value;
   try{reflect.apply(this,args);}
   finally{if(sky)sky.visible=true;scene.background=background;}
  };
  water.material.transparent=false;
  water.material.depthWrite=true;
  water.name=island?'open-sea':'quiet-lake';
  water.rotation.x=-Math.PI/2;
  water.position.set(0,-.66,zHorizon+50);
  water.receiveShadow=false;
  water.castShadow=false;
  root.add(water);
 }

 function getSharedGlassMaterial(pal){
  if(!sharedGlassMat){
   sharedGlassMat=new THREE.MeshPhysicalMaterial({
    color:pal.glass,
    emissive:pal.cool,
    emissiveIntensity:.14,
    roughness:.12,
    metalness:.10,
    transparent:true,
    opacity:.48,
    side:THREE.DoubleSide,
    depthWrite:false,
    clearcoat:1,
    clearcoatRoughness:.08,
    iridescence:.58
   });
   sharedGlassMat.userData.persistent=true;
  }else{
   sharedGlassMat.color.set(pal.glass);
   sharedGlassMat.emissive.set(pal.cool);
  }
  return sharedGlassMat;
 }

 function getSharedOrbMaterial(){
  if(!sharedOrbMat){
   sharedOrbMat=new THREE.MeshPhysicalMaterial({
    color:'#fff8eb',
    emissive:'#ffdfa8',
    emissiveIntensity:.38,
    roughness:.06,
    metalness:.14,
    clearcoat:1,
    iridescence:.82
   });
   sharedOrbMat.userData.persistent=true;
  }
  return sharedOrbMat;
 }

 function buildSail(side,span,trim,pal){
  const x=side*(narrow?5.6:12.6),z=narrow?-4.8:-5.6,height=narrow?10.4:13.2,width=narrow?3.6:6.6;
  const sh=new THREE.Shape();
  sh.moveTo(0,0);
  sh.quadraticCurveTo(side*1.3,height*.52,side*.55,height);
  sh.quadraticCurveTo(side*(width*.68),height*.48,side*width,1.25);
  sh.quadraticCurveTo(side*(width*.42),1.75,0,0);
  const g=new THREE.ShapeGeometry(sh,28);
  // Add gentle 3D wind camber so the sail billows naturally in the sunset breeze
  const pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){
   const px=pos.getX(i),py=pos.getY(i);
   const u=Math.min(1,Math.abs(px)/width),v=Math.min(1,py/height);
   const belly=Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*0.92;
   pos.setZ(i,belly);
  }
  g.computeVertexNormals();
  const sailMat=cachedMat(`sail:${pal.warm}`,()=>new THREE.MeshStandardMaterial({
   color:'#fff4df',
   emissive:pal.warm,
   emissiveIntensity:.09,
   roughness:.76,
   metalness:.04,
   side:THREE.DoubleSide
  }));
  const sail=mesh(g,sailMat,x,.65,z);
  sail.rotation.y=-side*.18;
  animated.push({kind:'sail',o:sail,base:sail.rotation.y,side});
  // Tapered timber mast, boom spar & golden rigging lines
  const wood=mat('#b5885c',.52,.12);
  tube([[x,-.2,z],[x+side*.32,height*.52,z+.15],[x+side*.55,height+.75,z]],.09,wood);
  tube([[x,.65,z],[x+side*(width*.5),1.15,z+.38],[x+side*width,1.75,z+.15]],.055,wood);
  tube([[x+side*.55,height+.75,z],[x+side*width,1.75,z+.15]],.022,trim);
  tube([[x+side*.55,height+.75,z],[x-side*1.5,.05,z+2.2]],.018,trim);
 }

 function buildCreamPrismScreens(span,trim,pal){
  const glass=getSharedGlassMaterial(pal);
  const orbMat=getSharedOrbMaterial();
  const coreGlow=cachedMat('coreGlow',()=>new THREE.MeshStandardMaterial({color:'#fff8e2',emissive:'#ffd480',emissiveIntensity:.85,roughness:.18}));
  luminous.push({m:coreGlow,base:.85});

  const cz=-1.2,r=narrow?9.2:13.6,h=narrow?8.6:9.8;
  const arcAngle=Math.PI*.36;

  for(const side of [-1,1]){
   // Sweeping panoramic curved fluted glass screens wrapping the back-left & back-right of the amphitheatre
   const startAngle=side<0?Math.PI*1.11:Math.PI*.53;
   const panelGeo=new THREE.CylinderGeometry(r,r,h,56,1,true,startAngle,arcAngle);
   const panel=mesh(panelGeo,glass,0,h*.5+.05,cz);
   panel.castShadow=false;

   // Upper, mid & lower champagne-gold cornice arches
   for(const y of [.12,h+.02,h*.54]){
    const pts=Array.from({length:37},(_,i)=>{
     const a=startAngle+i/36*arcAngle;
     return [Math.sin(a)*r,y,cz+Math.cos(a)*r];
    });
    tube(pts,y===h*.54?.024:.052,trim);
   }
   // Vertical architectural brass mullions dividing the curved glass screen into 5 fluted bays
   for(let j=0;j<=5;j++){
    const a=startAngle+j/5*arcAngle;
    const vx=Math.sin(a)*r,vz=cz+Math.cos(a)*r;
    tube([[vx,.12,vz],[vx,h+.02,vz]],j===0||j===5?.048:.024,trim,12,8);
   }

   // Hanging warm glass orb chandeliers (Concept C signature)
   for(let i=0;i<4;i++){
    const t=(i+.5)/4;
    const a=startAngle+(side<0?1-t:t)*arcAngle;
    const ox=Math.sin(a)*(r-.38),oz=cz+Math.cos(a)*(r-.38);
    const oy=(narrow?5.4:5.8)+(i%2)*1.15+i*.22;
    tube([[ox,h+.02,oz],[ox,oy+.28,oz]],.016,trim,8,6);
    const orbGroup=new THREE.Group();
    orbGroup.position.set(ox,oy,oz);
    const inner=new THREE.Mesh(new THREE.SphereGeometry(.18,16,12),coreGlow);
    const outer=new THREE.Mesh(new THREE.SphereGeometry(.32,22,16),orbMat);
    orbGroup.add(inner,outer);
    root.add(orbGroup);
    animated.push({kind:'orb',o:orbGroup,y:oy,seed:i*1.3+(side>0?2.1:0)});
   }

   // Concept C outer wing champagne-gold halo arch on cream plinth
   const hx=side*(narrow?8.6:15.4),hz=-2.4;
   const haloPts=Array.from({length:41},(_,i)=>{
    const a=-Math.PI*.15+i/40*Math.PI*1.3;
    return [hx+Math.cos(a)*(narrow?1.15:1.65),1.35+Math.sin(a)*(narrow?1.45:2.05),hz+Math.sin(a)*.25];
   });
   tube(haloPts,.048,trim);

   // Concept C foreground iridescent pearl spheres on champagne-gold ring plinths
   const px=side*(narrow?7.8:14.2),pz=narrow?1.8:1.4;
   const plinth=mesh(new THREE.CylinderGeometry(.74,.84,.20,32),trim,px,-.20,pz);
   plinth.receiveShadow=true;
   const pearl=mesh(new THREE.SphereGeometry(narrow?.56:.78,28,20),orbMat,px,.48,pz);
   animated.push({kind:'orb',o:pearl,y:.48,seed:side*1.7});
  }
 }

 function buildCoastalLantern(x,y,z,trim,glowMat){
  const wood=mat('#a87952',.62,.1);
  mesh(new THREE.CylinderGeometry(.32,.36,.22,22),wood,x,y+.11,z);
  mesh(new THREE.CylinderGeometry(.20,.20,.58,20),glowMat,x,y+.48,z);
  mesh(new THREE.CylinderGeometry(.30,.24,.10,20),trim,x,y+.80,z);
 }

 function themeArchitecture(span,trim,pal){
  const island=look==='island',z=-7.2;
  const glowMat=cachedMat(`glow:${pal.warm}`,()=>new THREE.MeshStandardMaterial({
   color:'#fff3d6',
   emissive:pal.warm,
   emissiveIntensity:.72,
   roughness:.20
  }));
  luminous.push({m:glowMat,base:.72});

  for(const side of [-1,1]){
   const x=side*span;
   const wingX=side*(narrow?8.8:15.2),wingZ=island?(side<0?-.8:-2.8):-2.4;

   // Sculpted 3D island rock cliff beneath the wing terrace (top: true keeps its flat top flush with the terrace)
   placeGlb('island',{
    x:wingX+side*(narrow?1.0:1.8),
    y:-.32,
    z:wingZ-.8,
    width:narrow?2.8:4.4,
    rotation:side*.35,
    tint:island?'#c8af8c':'#dcd8c8',
    roughness:.56,
    top:true
   });

   // Concert audio & stage equipment
   placeGlb('speaker',{x:side*(narrow?7.6:13.4),y:-.18,z:-2.6,height:narrow?1.85:2.35,rotation:-side*.24,tint:island?'#5a4a3c':'#586864',roughness:.42,metalness:.28});
   placeGlb('amp',{x:side*(narrow?6.8:12.0),y:-.18,z:-1.0,height:narrow?.82:1.08,rotation:-side*.32,tint:island?'#6b5340':'#526460',roughness:.46,metalness:.24});
   placeGlb('monitor',{x:side*(narrow?5.6:10.4),y:.36,z:narrow?5.6:3.8,width:narrow?.85:1.18,rotation:Math.PI-side*.25,tint:island?'#544538':'#495a58',roughness:.42,metalness:.3});

   if(island){
    buildCoastalLantern(side*(narrow?7.2:12.4),-.20,1.4,trim,glowMat);
    buildCoastalLantern(side*(narrow?8.6:15.4),-.20,-.2,trim,glowMat);
   }

   if(theme==='one-piece'){
    if(island){
     buildSail(side,span,trim,pal);
    }else{
     // Nautical astrolabe & golden sail-rib arches for Cream One Piece
     const pts=Array.from({length:49},(_,i)=>{
      const a=i/48*Math.PI;
      return [x+side*Math.sin(a)*3.4,.6+i/48*9.2,z+Math.sin(a)*1.2];
     });
     tube(pts,.07,trim);
     const innerPts=Array.from({length:49},(_,i)=>{
      const a=i/48*Math.PI;
      return [x+side*Math.sin(a)*2.3,.6+i/48*7.2,z-.3+Math.cos(a)*.7];
     });
     tube(innerPts,.04,trim);
    }
    // High-precision 3D Coral, Scenario Nautical Lantern & sculpted botanical foliage on both wings
    placeGlb('coral',{
     x:wingX+side*(narrow?.3:.9),
     y:-.18,
     z:wingZ-.6,
     width:narrow?1.65:2.65,
     rotation:side*.42,
     tint:pal.coral,
     emissive:pal.cool,
     emissiveIntensity:.22,
     roughness:.30
    });
    placeGlb('lantern',{
     x:wingX-side*(narrow?.35:.55),
     y:-.16,
     z:wingZ+.65,
     height:narrow?1.30:1.95,
     rotation:-side*.35,
     tint:'#d8ab70',
     emissive:pal.warm,
     emissiveIntensity:.32,
     roughness:.32,
     metalness:.38
    });
    placeGlb('bonsai',{
     x:wingX+side*(narrow?1.2:2.2),
     y:-.18,
     z:wingZ-.3,
     height:narrow?1.55:2.45,
     rotation:side*.52,
     tint:island?'#6ca07c':'#7eb096',
     roughness:.52
    });
   }else if(theme==='dragon-ball'){
    if(island)buildSail(side,span+1.0,trim,pal);
    // Sweeping golden Shenron/aura energy spiral & 7 luminous Dragon Spheres
    const auraPts=Array.from({length:57},(_,i)=>{
     const a=-.35+i/56*2.35;
     return [x+side*Math.cos(a)*3.8,4.6+Math.sin(a)*3.9,z+Math.sin(i/56*Math.PI)*1.1];
    });
    tube(auraPts,.092,trim);
    const orbCore=cachedMat('dragonOrbCore',()=>new THREE.MeshPhysicalMaterial({
     color:'#ff9f2e',
     emissive:'#ff7b18',
     emissiveIntensity:.48,
     roughness:.10,
     metalness:.15,
     clearcoat:1
    }));
    luminous.push({m:orbCore,base:.48});
    const count=side<0?3:4;
    for(let i=0;i<count;i++){
     const a=.15+i*.52;
     const ox=x+side*Math.cos(a)*3.8,oy=4.6+Math.sin(a)*3.9,oz=z+.3;
     const dragonOrb=mesh(new THREE.SphereGeometry(.30+i*.02,20,16),orbCore,ox,oy,oz);
     animated.push({kind:'orb',o:dragonOrb,y:oy,seed:i+side});
    }
    // Scenario Amber Quartz cluster & energy crystals
    const quartz=placeGlb('quartz',{
     x:wingX+side*(narrow?.3:.9),
     y:-.05,
     z:wingZ-.6,
     height:narrow?1.65:2.60,
     rotation:side*.45,
     tint:'#f2ad42',
     emissive:'#e88a25',
     emissiveIntensity:.26,
     roughness:.20,
     metalness:.18
    });
    if(quartz)animated.push({kind:'orb',o:quartz,y:-.05,seed:side*2});
    placeGlb('crystal',{
     x:wingX-side*(narrow?.3:.45),
     y:-.18,
     z:wingZ+.55,
     height:narrow?.98:1.48,
     rotation:-side*.5,
     tint:'#ffba4a',
     emissive:'#f0932b',
     emissiveIntensity:.28,
     roughness:.18
    });
    placeGlb('bonsai',{
     x:wingX+side*(narrow?1.2:2.2),
     y:-.18,
     z:wingZ-.3,
     height:narrow?1.45:2.30,
     rotation:side*.48,
     tint:'#7eb08a',
     roughness:.52
    });
   }else if(theme==='naruto'){
    if(island)buildSail(side,span+1.2,trim,pal);
    // Architectural vermilion/cedar Torii portal & hanging warm paper lanterns
    const wood=mat(island?'#b8684e':'#b07868',.48,.12);
    tube([[x,0,z],[x,9.4,z],[x+side*3.9,10.1,z]],.15,wood);
    tube([[x-side*.65,8.2,z],[x+side*3.5,8.8,z]],.105,trim);
    for(let i=0;i<3;i++){
     const lx=x+side*(.85+i*.98),ly=7.1-i*.42;
     tube([[lx,9.4+i*.15,z],[lx,ly+.35,z]],.015,trim,8,6);
     const lamp=mesh(new THREE.SphereGeometry(.32,18,14),glowMat,lx,ly,z);
     lamp.scale.y=1.48;
     animated.push({kind:'orb',o:lamp,y:ly,seed:i+side*1.5});
    }
    // Scenario Sculpted Pine Bonsai & Bamboo grove
    placeGlb('bonsai',{
     x:wingX+side*(narrow?.35:.95),
     y:-.18,
     z:wingZ-.55,
     height:narrow?1.95:2.95,
     rotation:side*.38,
     tint:'#7ea688',
     roughness:.52
    });
    placeGlb('bamboo',{
     x:wingX+side*(narrow?1.15:2.15),
     y:-.18,
     z:wingZ-1.1,
     height:narrow?2.3:3.45,
     rotation:-side*.25,
     tint:'#79ab89',
     emissive:'#588e70',
     emissiveIntensity:.10,
     roughness:.38
    });
    placeGlb('lantern',{
     x:wingX-side*(narrow?.3:.5),
     y:-.16,
     z:wingZ+.65,
     height:narrow?1.18:1.72,
     rotation:-side*.3,
     tint:'#d89268',
     emissive:pal.warm,
     emissiveIntensity:.30,
     roughness:.34,
     metalness:.32
    });
   }
  }
 }

 function batchStatic(){
  const moving=new Set(animated.map(a=>a.o)),groups=new Map();
  for(const o of root.children){
   if(!o.isMesh||o.userData.borrowed||moving.has(o)||o.material.transparent||o.material.isShaderMaterial||o.material.isMeshBasicMaterial)continue;
   const key=o.material.uuid+o.castShadow+o.receiveShadow;
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(o);
  }
  for(const list of groups.values()){
   if(list.length<2)continue;
   const geometries=list.map(o=>{
    o.updateMatrix();
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    g.applyMatrix4(o.matrix);
    return g;
   });
   const combined=mergeGeometries(geometries,false);
   geometries.forEach(g=>g.dispose());
   if(!combined)continue;
   const old=new Set();
   for(const o of list){root.remove(o);old.add(o.geometry);}
   old.forEach(g=>g.dispose());
   const o=mesh(combined,list[0].material);
   o.castShadow=list[0].castShadow;
   o.receiveShadow=list[0].receiveShadow;
  }
 }

 function rebuild(){
  if(narrow===null||disposed)return;
  clear();
  revision++;
  const s=stageSpec(narrow),island=look==='island';
  const pal=(PALETTES[look]||PALETTES.cream)[theme]||PALETTES.cream['one-piece'];
  const zHorizon=narrow?-16.5:-25.5;

  scene.background=new THREE.Color(pal.horizon);
  const ivory=mat(island?'#9c6e48':'#d8e5e2',island?.62:.48,island?.05:.08);
  const trim=cachedMat(`trim:${island?'#c89662':pal.warm}`,()=>new THREE.MeshStandardMaterial({color:island?'#c89662':pal.warm,metalness:.62,roughness:.26}));
  ivory.color.set(island?'#9c6e48':'#d8e5e2');ivory.roughness=island?.62:.48;trim.color.set(island?'#db8234':pal.warm);
  lookSurfaces={floor:ivory,trim};

  backdrop(pal,zHorizon);
  createWater(pal,zHorizon);

  // Broad shoreline/lagoon base terrace + asymmetric festival wings
  if(island){
   // Golden shallow sandbar / reef plinth just at the water surface
   ellipse(narrow?15.2:23.6,13.0,mat('#be9864',.78,.02),0,-.63,-2,.08);
  }
  ellipse(narrow?14.2:22.2,12.1,ivory,0,-.52,-2,.20);
  const baseRimMat=cachedMat(`baseRim:${look}:${pal.cool}`,()=>new THREE.MeshStandardMaterial({
   color:island?'#ffb458':pal.cool,
   emissive:island?'#ff9436':pal.cool,
   emissiveIntensity:.45,
   roughness:.28
  }));
  edges.push(baseRimMat);
  ellipse(narrow?14.32:22.34,12.22,baseRimMat,0,-.46,-2,.048);

  for(const side of [-1,1]){
   const wx=side*(narrow?9.8:16.6),wz=island?(side<0?0:-3.6):-2.8;
   const wing=ellipse(narrow?5.8:9.8,4.5,ivory,wx,-.30,wz,.48);
   wing.rotation.y=side*(island?.42:.25);
   const rim=ellipse(narrow?5.92:9.92,4.62,trim,wx,-.33,wz,.08);
   rim.rotation.y=side*(island?.42:.25);
  }

  // 3-Level Central Amphitheatre Stage (actor support coordinates stay exact)
  const stepBeaconMat=island?cachedMat('stepBeacon',()=>new THREE.MeshStandardMaterial({color:'#fff4d8',emissive:'#ff9c32',emissiveIntensity:1.25,roughness:.2})):null;
  if(stepBeaconMat)luminous.push({m:stepBeaconMat,base:.78});

  const edgeMat=cachedMat(`edge:${look}:${pal.cool}`,()=>new THREE.MeshStandardMaterial({
   color:island?'#ffc872':pal.cool,
   emissive:island?'#ff9c32':pal.cool,
   emissiveIntensity:.45,
   roughness:.25
  }));
  edges.push(edgeMat);

  const creamWallMat=!island?cachedMat(`creamWall:${pal.cool}`,()=>new THREE.MeshPhysicalMaterial({
   color:new THREE.Color(pal.cool).lerp(new THREE.Color('#385a54'),.35),
   emissive:new THREE.Color(pal.cool),
   emissiveIntensity:.14,
   roughness:.20,
   metalness:.18,
   clearcoat:1,
   clearcoatRoughness:.08,
   iridescence:.42
  })):null;

  for(let level=0;level<s.levels;level++){
   const top=.35+level*s.step;
   const wall=island
    ?mat(level%2?'#784c2a':'#5c361c',.74,.08)
    :creamWallMat;
   extrude(shape(level),s.step-.06,wall,0,top-s.step,0);
   extrude(shape(level),.095,ivory,0,top-.095,0);

   // Glowing under-tread LED strip along each tier
   const points=[];
   for(let i=0;i<=64;i++){
    const a=Math.PI-i/64*Math.PI,r=s.radii?.[level];
    points.push(narrow
     ?[(i/64-.5)*s.widths[level],top-.13,s.fronts[level]+.48]
     :[Math.cos(a)*(r+.06),top-.13,s.back+Math.sin(a)*(r+.06)]);
   }
   tube(points,.028,edgeMat);

   if(island){
    // Inlaid timber deck joints
    const width=narrow?s.widths[level]:s.radii[level]*2;
    for(let x=-width/2+.65;x<width/2;x+=1.35){
     const front=narrow?s.fronts[level]:s.back+Math.sqrt(Math.max(0,s.radii[level]**2-x*x));
     tube([[x,top+.046,s.back+.12],[x,top+.046,front-.16]],.011,mat('#cbb696',.68));
    }
    // Recessed warm step-light beacons along the curved risers (Concept D signature)
    if(!narrow){
     const r=s.radii[level]+.18,beaconCount=level===0?9:level===1?7:5;
     for(let b=1;b<beaconCount;b++){
      const a=Math.PI-b/beaconCount*Math.PI;
      mesh(new THREE.SphereGeometry(.08,12,10),stepBeaconMat,Math.cos(a)*r,top-s.step+.14,s.back+Math.sin(a)*r);
     }
    }
   }
  }

  const span=narrow?11.2:14.2;
  if(!island)buildCreamPrismScreens(span,trim,pal);
  themeArchitecture(span,trim,pal);
  batchStatic();
  fountains.setLayout(narrow);
 }

 return {
  setLook(next,{immediate=false}={}){
   next=FESTIVAL_LOOKS.includes(next)?next:'cream';
   if(next===look)return;
   const from=palette(),fromLook=look,previous=Object.fromEntries(Object.entries(lookSurfaces).map(([name,m])=>[name,{color:m.color.clone(),roughness:m.roughness}]));
   lookMix=immediate?1:0;lookTransition=immediate?null:{from,fromLook,started:performance.now(),surfaces:{}};
   look=next;
   rebuild();
   if(lookTransition){for(const [name,m] of Object.entries(lookSurfaces))lookTransition.surfaces[name]={from:previous[name]?.color||m.color.clone(),to:m.color.clone(),fromRoughness:previous[name]?.roughness??m.roughness,toRoughness:m.roughness};applyLookMix();}
  },
  get transitioning(){return Boolean(lookTransition);},
  get look(){return look;},
  setLayout(next){
   if(next===narrow)return;
   lookMix=1;lookTransition=null;
   narrow=next;
   rebuild();
  },
  async setTheme(next){
   if(theme===next)return;
   lookMix=1;lookTransition=null;
   theme=next;
   rebuild();
  },
  refreshMaterial(){},
  projectProps(){return [];},
  update(time,fx,reduced,lighting={},height=650,rows=[],mode='auto'){
   lastLighting=lighting;
   if(lookTransition){lookMix=reduced?1:Math.min(1,(performance.now()-lookTransition.started)/550);applyLookMix();}
   const motion=!reduced&&mode!=='off';
   const beat=motion?(lighting.beat||0):0;
   const downbeat=motion?(lighting.downbeat||0):0;
   if(water){
    water.material.uniforms.uTime.value=motion?time:0;
    water.material.uniforms.uBeat.value=beat*.65+downbeat*.35;
   }
   for(const a of animated){
    if(a.kind==='sky'){
     a.m.uniforms.uTime.value=motion?time:0;
     a.m.uniforms.uBeat.value=beat*.6+downbeat*.4;
    }
    if(a.kind==='sail')a.o.rotation.y=a.base+(motion?Math.sin(time*.38+a.side)*.022*a.side:0);
    if(a.kind==='orb')a.o.position.y=a.y+(motion?Math.sin(time*.52+a.seed)*.065:0);
   }
   edges.forEach(m=>{m.emissiveIntensity=.28+(motion?beat*.24+downbeat*.16:0);});
   luminous.forEach(item=>{item.m.emissiveIntensity=item.base+(motion?beat*.22+downbeat*.18:0);});
   fountains.update(time,fx,reduced,height,{power:lighting.wingPower||0,zones:lighting.wingZones||[]});
  },
  get diagnostics(){
   return {
    look,
    stageLook:look,
    lookMix,
    theme,
    narrow,
    revision,
    water:water?{kind:water.name,time:water.material.uniforms.uTime.value,reflectionSize:water.getRenderTarget().width}:null,
    shape:look==='cream'?'petal-amphitheatre':'coastal-terraces',
    levels:stageSpec(narrow).levels,
    lighting:lastLighting,
    fountains:fountains.diagnostics,
    props:{theme,models:modelBundle?.models.size||0},
    width:narrow?38:54
   };
  },
  dispose(){
   if(disposed)return;
   disposed=true;
   clear();
   for(const m of materialCache.values())m.dispose();
   materialCache.clear();
   sharedGlassMat?.dispose();
   sharedOrbMat?.dispose();
   sharedGlassMat=null;
   sharedOrbMat=null;
   water?.dispose();
   water?.geometry.dispose();
   water=null;
   const gs=new Set(),ms=new Set();
   effects.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});
   gs.forEach(g=>g.dispose());
   ms.forEach(m=>m.dispose());
   scene.remove(effects);
   modelBundle?.dispose();
   scene.remove(root);
  }
 };
}
