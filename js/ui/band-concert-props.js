import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/GLTFLoader.js/+esm';
import {mergeGeometries} from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/utils/BufferGeometryUtils.js/+esm';
import {stageSpec,stageHeightAt} from '../audio/band-stage-layout.js';
import {sampleConcertMotion,concertIslandSlots} from './band-concert-motion.js';
import {createObsidianScenery,styleObsidianPlant} from './band-concert-obsidian.js';

const assetIds=['island','coral','crystal','bamboo','grass','speaker','monitor','amp','spotlight'];
// Each band scene owns this bundle. Theme/layout changes reuse its geometry.
export async function loadConcertModels({concertLook=''}={}){
 const loader=new GLTFLoader(),models=new Map(),resources=new Set(),errors=[];
 const own=value=>{if(value)resources.add(value);return value;};
 const ids=[...assetIds,'lantern','quartz','bonsai'];
 await Promise.all(ids.map(async id=>{
  try{
   let buffer;
   for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{const response=await fetch(new URL(`../../assets/models/${assetIds.includes(id)?'band-concert':'band-scenography'}/${id}.glb`,import.meta.url),{signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);buffer=await response.arrayBuffer();break;}
    catch(error){if(attempt)throw error;}finally{clearTimeout(timer);}
   }
   const gltf=await loader.parseAsync(buffer,''),source=gltf.scene;source.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),height=size.y||1,batches=new Map();
   source.traverse(node=>{
    if(!node.isMesh)return;
    own(node.geometry);
    const materials=Array.isArray(node.material)?node.material:[node.material];
    for(const material of materials){own(material);for(const value of Object.values(material))if(value?.isTexture)own(value);}
    // GLTFLoader separates glTF primitives, so each imported mesh has one material.
    if(materials.length!==1)throw new Error('Unsupported grouped primitive');
    const material=materials[0],geometry=own(node.geometry.clone());geometry.applyMatrix4(node.matrixWorld);geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(1/height,1/height,1/height);
    if(!batches.has(material))batches.set(material,[]);batches.get(material).push(geometry);
   });
   const parts=[...batches].map(([material,geometries])=>({material,geometry:geometries.length===1?geometries[0]:own(mergeGeometries(geometries,false))}));
   if(parts.some(p=>!p.geometry))throw new Error('Incompatible imported attributes');
   models.set(id,{parts,size:size.divideScalar(height),triangles:parts.reduce((sum,p)=>sum+(p.geometry.index?.count||p.geometry.attributes.position.count)/3,0)});
  }catch(error){errors.push({id,message:error.message});console.warn(`Concert model ${id}:`,error);}
 }));
 let disposed=false;
 return {models,errors,get resourceCount(){return resources.size;},dispose(){if(disposed)return;disposed=true;const images=new Set();for(const resource of resources){if(resource.isTexture&&resource.image?.close)images.add(resource.image);resource.dispose();}for(const image of images)image.close();resources.clear();models.clear();}};
}

export function createConcertProps(scene,{bundle,palettes,concertLook=''}={}){
 const root=new THREE.Group();root.name='concert-imported-models';scene.add(root);
 const materials=new Map(),obsidian=createObsidianScenery();let theme='',narrow=null,islands=[],pods=[],emissions=[],equipment=[],lastState=null,disposed=false;
 const isObsidian=()=>concertLook==='obsidian';
 const has=id=>bundle.models.has(id);
 function clearRoot(){root.traverse(node=>{if(node.isInstancedMesh)node.dispose();});root.clear();}
 function materialFor(id,source,palette){
  const key=`${theme}:${id}:${source.uuid}`;if(materials.has(key))return materials.get(key);
  const material=isObsidian()&&id==='crystal'?new THREE.MeshPhysicalMaterial({clearcoat:1,clearcoatRoughness:.10}):source.clone();material.transparent=false;material.opacity=1;material.depthWrite=true;
  if('transmission' in material)material.transmission=0;
  material.roughness=.48;material.metalness=.08;
  let luminous=false;
  if(id==='island'){material.color.set(source.name==='grass'?(theme==='one-piece'?'#4ba9b7':theme==='dragon-ball'?'#80ba8a':'#849c89'):(theme==='one-piece'?'#456d88':theme==='dragon-ball'?'#686489':'#5f6d83'));material.roughness=.36;material.metalness=.2;}
  if(['coral','bamboo','grass','crystal'].includes(id)){
   const color=id==='crystal'?'#d7ac60':id==='coral'?'#54b9cf':theme==='naruto'?'#64ae8e':palette.cool;
   material.map=null;material.color.set(color);material.emissive.set(color);material.emissiveIntensity=.14;material.roughness=id==='crystal'?.2:.44;material.metalness=id==='crystal'?.4:.12;luminous=true;
  }
  if(isObsidian()&&['bamboo','grass','coral','crystal'].includes(id))styleObsidianPlant(material,id,theme);
  if(isObsidian()&&['lantern','quartz','bonsai'].includes(id)){
   // Keep authored surface detail, with one restrained theatre palette.
   material.color.set(id==='quartz'?'#c8af78':id==='bonsai'?'#899b91':'#b4a08a');
   material.roughness=id==='quartz'?.25:id==='lantern'?.42:.64;material.metalness=id==='lantern'?.36:id==='quartz'?.16:.04;
   material.envMapIntensity=id==='quartz'?.85:.8;
   if(id==='lantern'){material.emissive.set('#a98350');material.emissiveMap=material.map;material.emissiveIntensity=.16;}
   if(id==='quartz'){material.metalness=0;material.roughness=.48;material.metalnessMap=null;material.roughnessMap=null;}
   if(id==='quartz'){material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb=vec3(.82,.59,.29)*sqrt(max(.0,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))));');};material.customProgramCacheKey=()=> 'lu-scenography-quartz-v1';}
  }
  if(id==='speaker'){material.color.set(source.name==='wood'?'#263441':'#75808c');material.metalness=.42;material.roughness=.42;}
  if(id==='monitor'){material.color.set(source.color.getHSL({}).l>.3?palette.warm:'#34404b');material.metalness=.35;}
  if(id==='spotlight'){material.metalness=.5;material.roughness=.32;if(source.name==='Glow'){material.color.set(palette.cool);material.emissive.set(palette.cool);material.emissiveIntensity=.5;luminous=true;}}
  material.userData.concertLuminous=luminous;
  if(luminous)emissions.push(material);materials.set(key,material);return material;
 }
 function place(id,parent,{height=1,width=null,x=0,y=0,z=0,rotation=0,top=false}={}){
  const template=bundle.models.get(id);if(!template)return null;
  const group=new THREE.Group(),scale=width?width/template.size.x:height;group.name=`imported-${id}`;group.scale.setScalar(scale);group.position.set(x,y,z);group.rotation.y=rotation;
  for(const part of template.parts){const mesh=new THREE.Mesh(part.geometry,materialFor(id,part.material,palettes[theme]));mesh.castShadow=false;mesh.receiveShadow=false;if(top)mesh.position.y=-1;group.add(mesh);}
  parent.add(group);return group;
 }
 function batchEquipment(){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),batches=new Map();
  for(const {object} of equipment)object.traverse(mesh=>{if(!mesh.isMesh)return;const key=mesh.geometry.uuid+mesh.material.uuid;if(!batches.has(key))batches.set(key,{geometry:mesh.geometry,material:mesh.material,matrices:[]});batches.get(key).matrices.push(inverse.clone().multiply(mesh.matrixWorld));});
  for(const {geometry,material,matrices} of batches.values()){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=false;root.add(mesh);}
  for(const {object} of equipment)root.remove(object);
 }
 function configure({theme:nextTheme='one-piece',narrow:nextNarrow=false}={}){
  if(disposed||theme===nextTheme&&narrow===nextNarrow)return;
  theme=nextTheme;narrow=nextNarrow;clearRoot();islands=[];pods=[];equipment=[];emissions=[];
  // Reused cached materials must remain in this frame's emission set too.
  for(const [key,material] of materials)if(key.startsWith(theme+':')&&material.userData.concertLuminous)emissions.push(material);
  const s=stageSpec(narrow),back=s.back-1.2;
  for(const side of [-1,1]){
   for(const y of [1.9,3.5]){const object=place('speaker',root,{height:narrow?.92:1.54,x:side*(s.width/2+.13),y:y-(narrow?.46:.77),z:back+1.7});if(object)equipment.push({id:'speaker',object});}
   const x=side*(narrow?(isObsidian()?4.95:5.8):9.9),z=narrow?s.front-.55:s.back+Math.sqrt(s.radii[0]**2-x*x)-.6;
   const monitor=place('monitor',root,{width:narrow?(isObsidian()?.88:1.05):1.4,x,y:stageHeightAt(x,z,narrow)+.04,z,rotation:Math.PI});if(monitor)equipment.push({id:'monitor',object:monitor});
   const ax=side*(narrow?(isObsidian()?5.3:6):11.7),az=narrow?-.4:.5,amp=place('amp',root,{height:isObsidian()&&narrow?.6:.7,x:ax,y:stageHeightAt(ax,az,narrow)+.04,z:az});if(amp)equipment.push({id:'amp',object:amp});
  }
  const width=s.width+1.2;
  for(let i=0;i<8;i++){const object=place('spotlight',root,{height:.76,x:(i/7-.5)*(width-1.7),y:s.rigHeight-.84,z:back+1,rotation:Math.PI});if(object)equipment.push({id:'spotlight',object});}
  batchEquipment();
  if(isObsidian())pods=obsidian.decorate(root,{narrow,place,theme});
  else if(has('island'))for(const slot of concertIslandSlots(narrow)){
   const group=new THREE.Group();group.name=`concert-island-${slot.side}`;group.position.fromArray(slot.position);root.add(group);
   place('island',group,{width:slot.width,top:true,rotation:slot.side*.16});
   const plant=theme==='one-piece'?'coral':theme==='dragon-ball'?'crystal':'bamboo';
   const main=place(plant,group,{height:slot.plantHeight,y:-.02,rotation:slot.side*.35});
   if(theme==='dragon-ball')place('crystal',group,{height:slot.plantHeight*.58,x:slot.width*.22,z:.14,rotation:1.2});
   place('grass',group,{height:slot.plantHeight*(theme==='naruto'?.7:.4),x:-slot.width*.24,y:.015,z:.08,rotation:slot.side});
   islands.push({group,main,...slot});
  }
  root.updateMatrixWorld(true);
 }
 function update({time=0,lighting={},effectsMode='auto',reduced=false}={}){
  if(disposed)return;
  const state=sampleConcertMotion(time,lighting,{effectsMode,reduced});lastState={time,effectsMode,reduced,...state};
  for(const island of islands){const motion=sampleConcertMotion(time,lighting,{effectsMode,reduced,phase:island.phase});island.group.position.y=island.position[1]+motion.float;island.group.rotation.y=motion.yaw;if(theme==='dragon-ball'&&island.main)island.main.rotation.y=island.side*.35+motion.crystalYaw;}
  for(const pod of pods)for(const floater of pod.floaters||[])floater.object.position.y=floater.y+sampleConcertMotion(time,lighting,{effectsMode,reduced,phase:pod.side}).float;
  for(const material of emissions)material.emissiveIntensity=isObsidian()?(.025+state.emission*.16):state.emission;
  root.updateMatrixWorld(true);
 }
 function projectBounds(camera){
  root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  return [...islands,...pods].map(({group,side})=>{const box=new THREE.Box3().setFromObject(group),points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(camera));
   return {side,left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),bottom:Math.min(...points.map(p=>p.y)),top:Math.max(...points.map(p=>p.y)),near:Math.min(...points.map(p=>p.z)),far:Math.max(...points.map(p=>p.z))};});
 }
 return {has,configure,update,projectBounds,get diagnostics(){let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
  const scenicEmission=[...materials].filter(([key])=>key.startsWith(theme+':')&&['lantern','quartz','bonsai'].includes(key.split(':')[1])).map(([key,material])=>({id:key.split(':')[1],intensity:material.emissiveIntensity}));
  return {source:'existing-glb',look:isObsidian()?'obsidian-study':'existing-models',assets:[...bundle.models.keys()],errors:bundle.errors,theme,narrow,islands:islands.length,pods:pods.map(p=>p.kind),floaterY:pods.flatMap(p=>(p.floaters||[]).map(f=>f.object.position.y)),scenicEmission,equipment:equipment.reduce((n,e)=>(n[e.id]=(n[e.id]||0)+1,n),{}),triangles,meshes,materials:materials.size,resources:bundle.resourceCount+obsidian.resourceCount,lastState};},dispose(){if(disposed)return;disposed=true;clearRoot();scene.remove(root);for(const material of materials.values())material.dispose();materials.clear();obsidian.dispose();bundle.dispose();equipment=[];islands=[];pods=[];emissions=[];}};
}
