import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';

// Shared concert architecture, with a separate palette and planting per theme.
// No extra lights or transmission pass for the side scenery.
export const obsidianPalette={cool:'#b6b5e2',warm:'#e5bda7',wall:'#131226',curtain:'#27213c',glass:'#b7a9cc',stage:'#29243e',floor:'#10121e',brass:'#9c8279',shadow:'#1a2148',highlight:'#e5c2b4'};
export const obsidianPalettes={
 'one-piece':{cool:'#72b9bd',warm:'#e6b173',wall:'#0b1b24',curtain:'#153137',glass:'#a1bec2',stage:'#142a32',floor:'#0c1b23',brass:'#a88a60',shadow:'#102e43',highlight:'#edb477'},
 'dragon-ball':{cool:'#8dbca4',warm:'#e8bc71',wall:'#101e1b',curtain:'#1d352c',glass:'#b2c1ad',stage:'#1b2e25',floor:'#101e1b',brass:'#a58a59',shadow:'#173b33',highlight:'#e7bd75'},
 naruto:obsidianPalette
};

export function styleObsidianPlant(material,id,theme='naruto'){
 const coral=theme==='one-piece',crystal=id==='crystal';
 material.color.set(coral?(id==='coral'?'#377e90':'#315963'):crystal?'#c69855':id==='bamboo'?'#315155':'#334c51');
 material.emissive.set(coral?'#64b5c1':crystal?'#b77a35':'#6e9d9b');material.emissiveIntensity=.055;
 material.roughness=crystal?.10:.26;material.metalness=crystal?.12:.28;material.envMapIntensity=crystal?1.6:1;material.flatShading=false;
 // Preserve the imported topology. A view-dependent rim gives the same jade
 // language as the architectural pods without physical glass or new geometry.
 material.onBeforeCompile=shader=>{
  shader.uniforms.obsidianRim={value:new THREE.Color(coral?'#94dce4':crystal?'#eac28b':'#b4a6b6')};
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
   'float jadeRim=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.6);outgoingLight+=obsidianRim*jadeRim*.26;\n#include <opaque_fragment>');
  shader.fragmentShader='uniform vec3 obsidianRim;\n'+shader.fragmentShader;
 };
 material.customProgramCacheKey=()=> 'lu-obsidian-jade-v1';
}

export function gradeObsidianBackdrop(material,theme='naruto'){
 const p=obsidianPalettes[theme]||obsidianPalette;
 material.transparent=true;material.depthWrite=false;
 material.onBeforeCompile=shader=>{
  shader.uniforms.backdropShadow={value:new THREE.Color(p.shadow)};
  shader.uniforms.backdropHighlight={value:new THREE.Color(p.highlight)};
  shader.uniforms.backdropSaturation={value:theme==='one-piece'?.62:.56};
  // Uncropped screen UVs keep the vignette consistent on the portrait crop.
  shader.vertexShader='varying vec2 vStageUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvStageUv=uv;');
  shader.fragmentShader='varying vec2 vStageUv; uniform vec3 backdropShadow,backdropHighlight; uniform float backdropSaturation;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   #ifdef USE_MAP
    float luminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    vec3 image=mix(vec3(luminance),diffuseColor.rgb,backdropSaturation);
    float light=smoothstep(.035,.65,luminance);
    vec3 grade=mix(backdropShadow,backdropHighlight,light);
    image=mix(image,grade*(.24+luminance*.95),.46);
    // Keep a luminous horizon while retiring the frame and lower scenery.
    float sides=smoothstep(.27,.5,abs(vStageUv.x-.5));
    float lower=1.-smoothstep(.0,.38,vStageUv.y);
    float upper=smoothstep(.72,1.,vStageUv.y);
    image*=1.-sides*.46-lower*.27-upper*.13;
    // Atmospheric separation: a restrained horizon glow, not a luminous poster.
    float horizon=exp(-pow((vStageUv.y-.40)*7.,2.));
    float center=exp(-pow((vStageUv.x-.50)*2.4,2.));
    image=mix(image,backdropHighlight*.18,horizon*center*.10);
    float edgeFade=smoothstep(0.,.10,vStageUv.x)*smoothstep(0.,.10,1.-vStageUv.x);
    edgeFade*=smoothstep(0.,.15,vStageUv.y)*smoothstep(0.,.08,1.-vStageUv.y);
    diffuseColor.rgb=image;
    diffuseColor.a*=edgeFade;
   #endif`);
 };
 material.customProgramCacheKey=()=> 'lu-obsidian-backdrop-v3';
}

// A baked-looking wash on the existing floor, without lights, textures or passes.
export function gradeObsidianFloor(material,theme='naruto',narrow=false){
 const p=obsidianPalettes[theme]||obsidianPalette;
 material.onBeforeCompile=shader=>{
  shader.uniforms.stageCool={value:new THREE.Color(p.cool)};
  shader.uniforms.stageWarm={value:new THREE.Color(p.warm)};
  shader.uniforms.stageWidth={value:narrow?7.2:14.0};
  shader.vertexShader='varying vec3 vTheatrePosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvTheatrePosition=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='varying vec3 vTheatrePosition; uniform vec3 stageCool,stageWarm; uniform float stageWidth;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec2 floorPoint=vec2(vTheatrePosition.x/stageWidth,(vTheatrePosition.z-1.)/9.);
   float wash=exp(-dot(floorPoint,floorPoint)*1.45);
   float side=smoothstep(-1.1,1.1,floorPoint.x);
   vec3 spill=mix(stageWarm,stageCool,side);
   outgoingLight+=spill*wash*.035;
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=> 'lu-obsidian-floor-v1';
}

export function createObsidianScenery(){
 const geometries=new Map(),materials=new Map();
 const geometry=(key,build)=>{if(!geometries.has(key))geometries.set(key,build());return geometries.get(key);};
 const material=(key,options)=>{if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial(options));return materials.get(key);};
 function mesh(parent,g,m,position,scale){const object=new THREE.Mesh(g,m);object.position.fromArray(position);if(scale)object.scale.fromArray(scale);parent.add(object);return object;}
 function decorate(root,{narrow,place,theme='naruto'}){
  const pods=[],disk=geometry('disk',()=>new THREE.CylinderGeometry(1,1,.16,48,1)),ring=geometry('ring',()=>new THREE.TorusGeometry(1,.014,5,64));
  const metal=material('metal',{color:'#1c2430',metalness:.68,roughness:.32});
  const jade=material(`${theme}:jade`,{color:theme==='one-piece'?'#243c49':theme==='dragon-ball'?'#243e38':'#24313d',metalness:.46,roughness:.21,emissive:'#344859',emissiveIntensity:.11});
  const trim=material(`${theme}:trim`,{color:theme==='dragon-ball'?'#bea16c':'#bd9d86',metalness:.62,roughness:.28,emissive:'#9a6b51',emissiveIntensity:.14});
  const moon=material('moon',{color:'#dfbf97',metalness:.3,roughness:.3,emissive:'#e6ab7b',emissiveIntensity:.52});
  for(const side of [-1,1]){
   const group=new THREE.Group();group.name=`obsidian-${narrow?'wall-niche':'side-pod'}-${side}`;
   group.position.set(side*(narrow?(theme==='dragon-ball'?5.5:5.35):11.45),narrow?7.25:.48,narrow?-5.4:-1.3);root.add(group);
   const w=narrow?.53:1.63,d=narrow?.43:2.42,floaters=[];
   mesh(group,disk,metal,[0,-.09,0],[w,.9,d]);
   mesh(group,disk,jade,[0,.02,0],[w*.94,.62,d*.96]);
   const rim=mesh(group,ring,trim,[0,.085,0],[w,1,d]);rim.rotation.x=Math.PI/2;rim.scale.set(w,d,1);
   if(narrow){
    // Bracket touches the back wall: this reads as a niche, not another island.
    const bracket=geometry('bracket',()=>new THREE.BoxGeometry(1,1,1));
    mesh(group,bracket,metal,[side*.30,-.24,-.18],[.10,.48,.44]);
    if(theme==='one-piece'){
     if(side<0)place('lantern',group,{height:1.05,y:.10,rotation:.35});
     else place('coral',group,{width:.86,y:.10,rotation:side*.3});
    }
    else if(theme==='dragon-ball'){
     const crystal=place('quartz',group,{height:side<0?.94:.72,y:.18,rotation:side*.3});
     if(crystal)floaters.push({object:crystal,y:.18});
    }else if(side<0)place('bonsai',group,{height:1.22,y:.10,rotation:.4});
    else place('bamboo',group,{height:1.15,y:.10,rotation:side*.3});
   }else{
    // An architectural rail joins the planted tray to the lowest stage tread.
    const rail=geometry('rail',()=>new THREE.BoxGeometry(1,1,1));
    mesh(group,rail,metal,[-side*1.1,-.08,1.1],[1.7,.18,.42]);
    if(theme==='one-piece'){
     if(side<0){
      place('lantern',group,{height:2.0,x:-.14,y:.12,z:-.42,rotation:.4});
      place('coral',group,{width:1.32,x:.45,y:.10,z:.58,rotation:-.65});
     }else{
      place('coral',group,{width:2.15,x:.18,y:.12,z:-.45,rotation:.35});
      place('lantern',group,{height:.92,x:-.55,y:.10,z:.82,rotation:-.4});
     }
     place('grass',group,{height:.46,x:side*.78,y:.10,z:.75,rotation:side*.7});
    }else if(theme==='dragon-ball'){
     const crystal=place('quartz',group,{height:side<0?1.95:1.48,x:side*.14,y:.35,z:-.45,rotation:side*.5});
     if(crystal)floaters.push({object:crystal,y:.35});
     place('crystal',group,{height:side<0?.54:.66,x:-side*.60,y:.12,z:.6,rotation:-side*.5});
     place('grass',group,{height:.42,x:side*.7,y:.10,z:.6,rotation:side*.7});
     const orbit=mesh(group,ring,trim,[side*.14,1.25,-.45],[1.12,1.12,1.12]);orbit.rotation.x=.8;orbit.rotation.z=side*.35;
    }else{
     if(side<0)place('bonsai',group,{height:2.95,x:0,y:.10,z:-.32,rotation:.4});
     else{
      place('bamboo',group,{height:3.1,x:.28,y:.10,z:-.60,rotation:.3});
      place('bamboo',group,{height:1.88,x:-.46,y:.10,z:.18,rotation:-.6});
     }
     place('grass',group,{height:.64,x:side*.56,y:.10,z:.80,rotation:side*.7});
     if(side>0){place('grass',group,{height:.72,x:.28,y:1.72,z:-.60,rotation:.9});place('grass',group,{height:.50,x:-.46,y:1.20,z:.18,rotation:-.4});}
    }
    // A small architectural lamp, kept warm and subordinate to the character.
    mesh(group,disk,metal,[-side*.53,.15,1.34],[.26,2,.26]);
    mesh(group,disk,moon,[-side*.53,.31,1.34],[.19,.5,.19]);
    mesh(group,disk,metal,[-side*.53,.41,1.34],[.31,.6,.31]);
   }
   pods.push({group,side,kind:narrow?'wall-niche':'side-pod',floaters});
  }
  return pods;
 }
 return {decorate,get resourceCount(){return geometries.size+materials.size;},dispose(){for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();geometries.clear();materials.clear();}};
}
