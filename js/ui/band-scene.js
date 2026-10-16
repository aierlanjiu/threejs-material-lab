import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {bandRoster} from '../audio/band-parts.js';
import {formationAt,sampleBandMotion,bandEase} from '../audio/band-layout.js';
import {stageSpec,stageBandLayout,stageHeightAt,stageLightingAt} from '../audio/band-stage-layout.js';
import {bandPet,petFrameAt} from '../avatar/band-pets.js';
import {defaultBandSettings,settingsForMember} from './band-settings.js';
import {createConcertStage} from './band-stage.js';
import {createEnergyWings,energyWingAttachment} from './band-energy-wings.js';
import {particleWingState,stageEffectsAt} from '../audio/band-effects-timeline.js';

export async function createBandScene(container,{safeTop=0,safeBottom=15,cubeDesign=null}={}){
 const renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 if('transmissionResolutionScale' in renderer)renderer.transmissionResolutionScale=.5;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.className='lu-band-canvas';container.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.1,220);scene.background=new THREE.Color('#111b28');
 const room=new THREE.Scene();room.background=new THREE.Color('#364656');
 for(const [color,x,y,z,w,h] of [['#ffd3a0',-8,9,8,3,7],['#a3cbdf',9,8,4,2,6],['#fff0d1',0,12,-3,9,1],['#403044',0,2,-14,14,5]]){
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(color==='#403044'?.3:2.2),side:THREE.DoubleSide}));panel.position.set(x,y,z);panel.lookAt(0,2,0);room.add(panel);
 }
 const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;
 room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xd5e9ff,0x273b53,1.15));
 const fill=new THREE.DirectionalLight(0xffe8ce,2.1);fill.position.set(-8,18,12);fill.castShadow=true;
 const rimLight=new THREE.DirectionalLight(0x93d9ee,1.3);rimLight.position.set(10,9,-8);scene.add(rimLight);
 Object.assign(fill.shadow.camera,{left:-24,right:24,top:24,bottom:-24,far:75});fill.shadow.mapSize.set(512,512);fill.shadow.bias=-.0004;scene.add(fill);
 const loader=new THREE.TextureLoader(),textures=new Map();
 const textureFor=url=>{if(!textures.has(url))textures.set(url,loader.loadAsync(url).then(t=>{t.colorSpace=THREE.SRGBColorSpace;return t;}).catch(error=>{textures.delete(url);throw error;}));return textures.get(url);};
 const defaultPrism=()=>{const m=new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:0,roughness:.045,transmission:.94,thickness:1.2,ior:1.52,dispersion:.18,
  attenuationColor:new THREE.Color('#dae3ed'),attenuationDistance:3,iridescence:.32,iridescenceIOR:1.35,iridescenceThicknessRange:[90,320],clearcoat:1,clearcoatRoughness:0,transparent:true,opacity:.86,side:THREE.DoubleSide,envMapIntensity:1.1});m.userData.family='prism';return m;};
 const theatre=createConcertStage(scene,{createMaterial:()=>cubeDesign?.createStageMaterial?.()||defaultPrism(),textureFor,onChange:()=>{if(active)render();}});
 let members=[],theme='one-piece',narrow=false,active=false,revision=0,disposed=false,last=null,designKey=cubeDesign?.getKey?.()||'prism',captureSize=null;
 let lastUpdateKey='',lastCameraFit=null,placementRevision=0,drag=null;
 const placements=new Map();
 const limits=()=>({x:narrow?5.6:10.5,back:-3.7,front:narrow?6.3:8.1});
 function placed(point){const l=limits(),s=stageSpec(narrow),x=point.x*l.x;
  let z=l.back+point.z*(l.front-l.back);
  if(!narrow)z=Math.min(z,s.back+Math.sqrt(Math.max(0,s.radii[0]**2-x*x))-.7);
  return [x,stageHeightAt(x,z,narrow)+.045,z];}
 function rayPoint(x,y,plane){const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
  return ray.ray.intersectPlane(plane,new THREE.Vector3());}
 function startDrag(id,x,y){const member=members.find(m=>m.role.id===id);if(!member)return;
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-member.group.position.y),hit=rayPoint(x,y,plane);if(!hit)return;
  drag={id,plane,hit,origin:member.group.position.clone(),previous:placements.get(id)};}
 function moveDrag(id,x,y){if(drag?.id!==id)return;const hit=rayPoint(x,y,drag.plane);if(!hit)return;const l=limits(),p=drag.origin.clone().add(hit.sub(drag.hit));
  placements.set(id,{x:THREE.MathUtils.clamp(p.x/l.x,-1,1),z:THREE.MathUtils.clamp((p.z-l.back)/(l.front-l.back),0,1)});placementRevision++;lastUpdateKey='';}
 function endDrag(id,{cancelled=false}={}){if(drag?.id!==id)return;if(cancelled){if(drag.previous)placements.set(id,drag.previous);else placements.delete(id);}drag=null;placementRevision++;lastUpdateKey='';}
 function resetPositions(){placements.clear();drag=null;placementRevision++;lastUpdateKey='';}
 const dimensions=()=>captureSize?{w:captureSize.logicalWidth,h:captureSize.logicalHeight}:{w:container.clientWidth,h:container.clientHeight};
 const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;
 const hc=haloCanvas.getContext('2d'),gradient=hc.createRadialGradient(64,64,4,64,64,64);
 gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.3,'#ffffff88');gradient.addColorStop(1,'#ffffff00');hc.fillStyle=gradient;hc.fillRect(0,0,128,128);
 const haloTexture=new THREE.CanvasTexture(haloCanvas),spots=[];
 for(let i=0;i<10;i++){
  const light={position:new THREE.Vector3(),target:{position:new THREE.Vector3()},color:new THREE.Color(),intensity:0};
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(3.1,2.5),new THREE.MeshBasicMaterial({map:haloTexture,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));halo.rotation.x=-Math.PI/2;scene.add(halo);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.85,1,24,1,true),new THREE.ShaderMaterial({uniforms:{uOpacity:{value:0},uTint:{value:new THREE.Color('#ffe6b1')}},vertexShader:'varying vec2 vUv;varying vec3 vNormal,vView;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalMatrix*normal;vView=-mv.xyz;gl_Position=projectionMatrix*mv;}',fragmentShader:'varying vec2 vUv;varying vec3 vNormal,vView;uniform float uOpacity;uniform vec3 uTint;void main(){float soft=pow(abs(dot(normalize(vNormal),normalize(vView))),1.5);float axial=smoothstep(0.,.12,vUv.y)*(.55+.45*vUv.y);gl_FragColor=vec4(uTint,uOpacity*soft*axial);}',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));scene.add(beam);spots.push({light,halo,beam});
 }
 const leadLight=new THREE.SpotLight(0xffedcd,0,90,.35,.85,1.5);scene.add(leadLight,leadLight.target);
 function disposeGroup(group){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.customDepthMaterial?.dispose();});}
 function releaseMembers(){for(const m of members){m.wings?.dispose();scene.remove(m.group);disposeGroup(m.group);m.texture.dispose();m.labelTexture.dispose();}members=[];}
 function labelFor(role){const canvas=document.createElement('canvas');canvas.width=384;canvas.height=64;const ctx=canvas.getContext('2d');
  ctx.font='500 29px sans-serif';ctx.textAlign='center';ctx.fillStyle='#f2e7d5';ctx.shadowColor='#15101a';ctx.shadowBlur=6;ctx.fillText(role.name,192,42);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
 async function configure(nextTheme=theme){
  if(members.length&&theme===nextTheme)return;theme=nextTheme;const token=++revision,roles=bandRoster(theme);
  const loaded=await Promise.all(roles.map(r=>textureFor(bandPet(r.id).asset)));
  if(disposed||token!==revision)return;releaseMembers();lastUpdateKey='';
  members=roles.map((role,i)=>{
   const pet=bandPet(role.id),group=new THREE.Group(),body=new THREE.Group();group.add(body);scene.add(group);
   const texture=loaded[i].clone();texture.repeat.set(1/pet.frameCount,1);texture.offset.set(0,0);texture.needsUpdate=true;
   const art=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.035,depthWrite:true,toneMapped:false}));art.castShadow=true;body.add(art);
   art.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:texture,alphaTest:.22});
   const reflectionMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.15,depthWrite:false,depthTest:false,toneMapped:false,color:'#a9c4da'});
   reflectionMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a*=pow(1.0-vMapUv.y,2.0);\n#include <opaque_fragment>');};
   const reflection=new THREE.Mesh(new THREE.PlaneGeometry(1,1),reflectionMaterial);group.add(reflection);
   const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.4),new THREE.MeshBasicMaterial({map:haloTexture,color:'#08111f',transparent:true,opacity:.48,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.05;group.add(shadow);
   const labelTexture=labelFor(role),label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture,transparent:true,depthWrite:false,toneMapped:false}));label.scale.set(2.3,.38,1);group.add(label);
   const wings=['vocals','guitar'].includes(role.instrumentKind)?createEnergyWings(group,{samples:144,compactSamples:96}):null;
   return {role,pet,group,body,art,reflection,shadow,label,labelTexture,texture,wings,frame:0,sample:null,pose:null};
  });
  resize();await theatre.setTheme(theme);if(active)render();
 }
 function fitCamera(layouts,settings,lighting,wingState){
  const angle=THREE.MathUtils.degToRad((narrow?36:24)-(lighting.chorusView||0)*(narrow?4:5)),up=new THREE.Vector3(0,Math.cos(angle),-Math.sin(angle)),out=new THREE.Vector3(0,Math.sin(angle),Math.cos(angle)),points=[];
  for(const positions of layouts)positions.forEach((p,i)=>{const v=settingsForMember(settings,members[i].role.id),h=3.05*v.actorSize;
   for(const x of [-h*.47,h*.47])for(const y of [0,h+.12])points.push(new THREE.Vector3(p[0]+x,p[1]+y,p[2]));});
  if(wingState?.power>.01)for(const positions of layouts)positions.forEach((p,i)=>{if(!members[i].wings||last?.frame.parts[i]?.userMuted)return;const h=3.05*settingsForMember(settings,members[i].role.id).actorSize,w=h*.78*wingState.spread*wingState.power;for(const x of [-w,w])for(const y of [.10,.87])points.push(new THREE.Vector3(p[0]+x,p[1]+h*y,p[2]));});
  const s=stageSpec(narrow);
  if(narrow){points.push(new THREE.Vector3(0,0,s.front+.3));}
  else for(const x of [-s.width/2-.8,s.width/2+.8])for(const y of [0,s.rigHeight+.8])points.push(new THREE.Vector3(x,y,s.back-1.5));
  if(!narrow)for(let i=0;i<=16;i++){const a=i/16*Math.PI;points.push(new THREE.Vector3(Math.cos(a)*(s.radii[0]+.8),0,s.back+Math.sin(a)*(s.radii[0]+.8)));}
  const vs=points.map(p=>p.dot(up)),ds=points.map(p=>p.dot(out));
  const centerV=(Math.min(...vs)+Math.max(...vs))/2,centerZ=(Math.min(...ds)+Math.max(...ds))/2;
  const target=up.clone().multiplyScalar(centerV).addScaledVector(out,centerZ),{w,h}=dimensions();
  const lead=Math.max(0,last?.frame.leadIndex||0),previous=Math.max(0,last?.frame.previousLeadIndex||0),mix=bandEase(((last?.frame.time||0)-(last?.frame.section?.start||0))/2.5);
  target.x=THREE.MathUtils.clamp(THREE.MathUtils.lerp(layouts[1][previous]?.[0]||0,layouts[1][lead]?.[0]||0,mix)*.045*(lighting.verse||0),-.38,.38);
  const top=narrow?Math.min(safeTop,64):24,bottom=Math.min(safeBottom,72),available=Math.max(.28,(h-top-bottom)/h),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  const distance=Math.max(3,...points.map(p=>p.dot(out)-centerZ+Math.max(Math.abs(p.x-target.x)/(tan*camera.aspect*.95),Math.abs(p.dot(up)-centerV)/(tan*available*.96))));
  const scale=narrow?1+((lighting.cameraScale||1)-1)*.25:(lighting.cameraScale||1);camera.position.copy(target).addScaledVector(out,distance*scale);camera.lookAt(target);camera.setViewOffset(w,h,0,-(top-bottom)/2,w,h);camera.updateProjectionMatrix();
  camera.position.x+=(lighting.cameraShift||0)*(narrow?.3:1);camera.position.y+=lighting.cameraLift||0;camera.lookAt(target);
  lastCameraFit={distance:distance*scale,angle:THREE.MathUtils.radToDeg(angle),section:lighting.section,actorFraming:narrow};
 }
 function setSpot(spot,member,power,color,index){
  const target=member?.group.position||new THREE.Vector3(),s=stageSpec(narrow);
  spot.light.position.set((index%5-2)*(narrow?2.1:6.3),8.4,s.back-.6);spot.light.intensity=power*30;spot.light.color.copy(color);spot.light.target.position.copy(target).add(new THREE.Vector3(0,1,0));
  spot.halo.position.copy(target);spot.halo.position.y+=.025;spot.halo.material.color.copy(color);spot.halo.material.opacity=power*.24;
  const end=target.clone();end.y+=(member?.art.scale.y||3.3)+.15;
  const start=spot.light.position,direction=start.clone().sub(end),length=direction.length();spot.beam.position.copy(start).add(end).multiplyScalar(.5);spot.beam.scale.y=length;spot.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());spot.beam.material.uniforms.uOpacity.value=power?Math.min(.14,.08+power*.05):0;spot.beam.material.uniforms.uTint.value.copy(color);spot.beam.visible=power>.07;
 }
 function update(frame,{settings=defaultBandSettings(),focus=null,reduced=false,score=null,parts=[],easterEgg=null,effectsFrame=null}={}){
  if(!members.length||disposed)return;
  const updateKey=`${frame.time}|${focus}|${reduced}|${placementRevision}|${frame.parts.map(p=>p.activity.toFixed(3)+':'+Boolean(p.userMuted)).join(',')}|${easterEgg?.id||''}|${easterEgg?.time||0}|${JSON.stringify(settings)}|${cubeDesign?.getKey?.()||designKey}`;
  if(updateKey===lastUpdateKey&&last?.options.score===score&&last?.options.parts===parts)return;
  lastUpdateKey=updateKey;last={frame,options:{settings,focus,reduced,score,parts,easterEgg}};
  const fx=effectsFrame||stageEffectsAt(score,frame.time,settings.effects||'auto',reduced?null:easterEgg);
  const wingState=particleWingState(score,frame.time,{mode:settings.effects,reduced});
  const lighting=stageLightingAt(score,frame.time,fx,reduced);
  const wingFocus=members.some((m,i)=>m.wings&&!frame.parts[i]?.userMuted&&(parts[i]?.events?.length||score?.source==='demo'))?wingState.power:0;
  lighting.flash=(lighting.flash||0)*(1-wingFocus*.6);
  fill.intensity=2.1+(lighting.flash||0)*.9;fill.color.set('#ffe8ce').lerp(new THREE.Color('#ffcc82'),(lighting.flash||0)*.45);renderer.toneMappingExposure=1+(lighting.flash||0)*.16;
  const nextKey=cubeDesign?.getKey?.()||designKey;if(nextKey!==designKey){designKey=nextKey;theatre.refreshMaterial();}
  const moving=settings.lightMode==='move',leader=Math.max(0,frame.leadIndex),previousLeader=Math.max(0,frame.previousLeadIndex);
  const formation=formationAt(frame.time,score,focus||moving?'solo':settings.formation);
  const spread=settings.spread*(narrow?.90:1),from=stageBandLayout(members.length,formation.previousId,narrow,moving?previousLeader:leader,spread),to=stageBandLayout(members.length,formation.id,narrow,leader,spread);
  const next=stageBandLayout(members.length,formation.nextId,narrow,Math.max(0,frame.nextLeadIndex),spread);
  const manual=to.map((p,i)=>placements.has(members[i].role.id)?placed(placements.get(members[i].role.id)):p);
  fitCamera([from,to,next,manual],settings,lighting,wingState);
  members.forEach((member,i)=>{
   const sample=frame.parts[i]||{activity:0,energy:0,attack:0,notePulse:0,lead:false},part=parts[i]||member.role,v=settingsForMember(settings,member.role.id);
   const progress=moving&&frame.previousLeadIndex>=0?bandEase((frame.time-(frame.section?.start||0))/1.6):formation.mix;
   const mix=reduced?(progress>.5?1:0):progress;
   member.group.position.fromArray(from[i]).lerp(new THREE.Vector3(...to[i]),mix);
   member.group.position.x+=Math.sign(member.group.position.x)*v.gap*.6;
   member.group.position.y=stageHeightAt(member.group.position.x,member.group.position.z,narrow)+.045;
   if(placements.has(member.role.id))member.group.position.fromArray(placed(placements.get(member.role.id)));
   const pose=sampleBandMotion(sample,frame.time,score?.bpmEstimate||120,{technique:part.technique,index:i,actorMotion:v.actorMotion,instrumentMotion:v.instrumentMotion,reduced});
   member.body.position.set(pose.actor.position[0],pose.actor.position[1]*.7,0);
   member.body.rotation.z=pose.actor.rotation[2]+(sample.attack||0)*THREE.MathUtils.degToRad(v.instrumentRotation)*.08*v.instrumentSize;
   const h=3.05*v.actorSize;
   member.art.position.set(0,h*(member.pet.baseline-.5),0);member.art.scale.set(h*.8,h,1);
   member.art.rotation.y=Math.atan2(camera.position.x-member.group.position.x,camera.position.z-member.group.position.z)+THREE.MathUtils.degToRad(v.actorRotation)*.32;
   member.reflection.position.set(0,-h*(member.pet.baseline-.5)*.30,.012);member.reflection.scale.set(h*.8,-h*.30,1);member.reflection.rotation.y=member.art.rotation.y;
   member.frame=petFrameAt(frame.time,score?.bpmEstimate||120,sample.activity,{reduced,speed:v.instrumentMotion*(.6+v.instrumentSize*.5),index:i,attack:sample.attack});member.texture.offset.x=member.frame/4;
   member.art.material.opacity=settings.contrast?.92+sample.activity*.08:1;
   member.art.material.color.setRGB(.94+sample.activity*.06,.95+sample.activity*.05,.98-lighting.climax*.025);
   member.reflection.material.opacity=.12+lighting.lift*.055+(lighting.flash||0)*.07;
   member.label.position.set(0,h+.2,.36);member.label.visible=!!focus&&focus===member.role.id;member.label.material.opacity=1;
   member.shadow.scale.setScalar(v.actorSize);member.shadow.material.opacity=.40+sample.activity*.09;
   member.sample=sample;member.pose=pose;
  });
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const occluders=wingState.power>.005?members.map(m=>{const box=new THREE.Box3().setFromObject(m.body),points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(camera));return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),bottom:Math.min(...points.map(p=>p.y)),top:Math.max(...points.map(p=>p.y))};}):[];
  members.forEach((m,i)=>m.wings?.update({time:frame.time,state:(!m.sample?.userMuted&&(parts[i]?.events?.length||score?.source==='demo'))?wingState:{power:0},narrow,height:m.art.scale.y,body:m.body,art:m.art,shoulder:energyWingAttachment(m.role.id),occluders:occluders.filter((_,j)=>j!==i)}));
  lighting.wingPower=wingFocus;
  lighting.wingZones=members.filter(m=>m.wings?.mesh.visible).map(m=>{
   const mesh=m.wings.mesh,points=[];mesh.updateWorldMatrix(true,false);
   for(const x of [-.78,.78])for(const y of [.08,.87])points.push(new THREE.Vector3(x,y,-.05).applyMatrix4(mesh.matrixWorld).project(camera));
   const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),bottom=Math.min(...points.map(p=>p.y)),top=Math.max(...points.map(p=>p.y));
   return {x:(left+right)/2,y:(bottom+top)/2,width:Math.max(.02,(right-left)/2),height:Math.max(.02,(top-bottom)/2)};
  });
  spots.forEach((spot,i)=>setSpot(spot,null,0,new THREE.Color('#ffe6c4'),i));
  if(settings.lightMode==='multi')members.forEach((m,i)=>setSpot(spots[i],m,m.sample.activity*(m.sample.lead?1.2:.65),new THREE.Color('#ffe4bd').lerp(new THREE.Color(m.role.accent),.2),i));
  else if(frame.leadIndex>=0){const m=members[leader];setSpot(spots[0],m,m.sample.activity*1.25+(focus?.15:0),new THREE.Color('#ffe4bd'),leader);}
  const lead=members[leader];leadLight.position.copy(spots[0].light.position);leadLight.target.position.copy(lead.group.position).add(new THREE.Vector3(0,1,0));leadLight.intensity=frame.leadIndex>=0?lead.sample.activity*35:0;
  const s=stageSpec(narrow),rows=Array.from({length:s.levels},(_,level)=>{const row=members.filter(m=>Math.round((m.group.position.y-.395)/s.step)===level);return row.length?row.reduce((total,m)=>total+m.sample.activity,0)/row.length:0;});
  theatre.update(frame.time,fx,reduced,lighting,renderer.domElement.height,rows);
  if(active)render();
 }
 function resize(){const {w,h}=dimensions();if(!w||!h||disposed)return;narrow=w/h<.85;
  lastUpdateKey='';
  renderer.setSize(captureSize?.width||w,captureSize?.height||h,false);camera.aspect=w/h;camera.fov=narrow?34:30;theatre.setLayout(narrow);
  if(last)update(last.frame,last.options);else if(members.length)update({time:0,parts:[],leadIndex:-1,previousLeadIndex:-1,nextLeadIndex:-1,section:null});
 }
 function render(){if(!disposed)renderer.render(scene,camera);}
 const observer=new ResizeObserver(resize);observer.observe(container);
 const raycaster=new THREE.Raycaster();
 function pickMember(clientX,clientY){
  if(!active)return null;const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),camera);
  const hits=raycaster.intersectObjects(members.map(m=>m.art));
  for(const hit of hits){const member=members.find(m=>m.art===hit.object);
   if(!member.hitCanvas){const c=document.createElement('canvas');c.width=member.texture.image.width;c.height=member.texture.image.height;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(member.texture.image,0,0);member.hitCanvas={c,ctx};}
   const uv=hit.uv.clone();member.texture.transformUv(uv);const {c,ctx}=member.hitCanvas;
   if(ctx.getImageData(Math.min(c.width-1,Math.floor(uv.x*c.width)),Math.min(c.height-1,Math.floor(uv.y*c.height)),1,1).data[3]<40)continue;
   return member.role.id;
  }
  return null;
 }
 renderer.domElement.addEventListener('pointerup',event=>{
  const id=pickMember(event.clientX,event.clientY);if(id)renderer.domElement.dispatchEvent(new CustomEvent('band-member-select',{detail:id}));
 });
 function setActive(value){active=value;container.hidden=!value;if(value){resize();render();}}
 function setCaptureSize(width,height,logicalWidth,logicalHeight){if(captureSize?.width===width&&captureSize?.height===height)return;captureSize={width,height,logicalWidth,logicalHeight};renderer.setPixelRatio(1);resize();}
 function endCapture(){if(!captureSize)return;captureSize=null;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));resize();}
 function dispose(){disposed=true;observer.disconnect();releaseMembers();theatre.dispose();environment.dispose();haloTexture.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});for(const t of textures.values())t.then(texture=>texture.dispose()).catch(()=>{});renderer.dispose();renderer.domElement.remove();}
 const currentFormation=()=>last?formationAt(last.frame.time,last.options.score,last.options.focus||last.options.settings.lightMode==='move'?'solo':last.options.settings.formation).id:null;
 return {configure,update,resize,setActive,setCaptureSize,endCapture,dispose,pickMember,startDrag,moveDrag,endDrag,resetPositions,canvas:renderer.domElement,get narrow(){return narrow;},get captureActive(){return !!captureSize;},get formation(){return currentFormation();},get diagnostics(){return {active,theme,narrow,captureSize,formation:currentFormation(),stage:theatre.diagnostics,petCount:members.length,wings:{...particleWingState(last?.options.score,last?.frame.time||0,{mode:last?.options.settings.effects,reduced:last?.options.reduced}),members:members.filter(m=>m.wings).map(m=>({id:m.role.id,...m.wings.diagnostics}))},placements:Object.fromEntries(placements),dragging:drag?.id||null,
  cueSource:last?.options.score?.stageCues?.source||'demo',chorusCandidates:last?.options.score?.stageCues?.choruses||[],camera:{position:camera.position.toArray(),fov:camera.fov,aspect:camera.aspect,...lastCameraFit},beams:spots.map(s=>s.beam.visible?s.beam.material.uniforms.uOpacity.value:0),members:members.map(m=>{const box=new THREE.Box3().setFromObject(m.body),points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(camera));
   return {id:m.role.id,technique:m.role.technique,activity:m.sample?.activity||0,position:m.group.position.toArray(),petFrame:m.frame,asset:m.pet.asset,actorRotation:m.art.rotation.toArray().slice(0,3),instrumentRotation:m.body.rotation.toArray().slice(0,3),actorScale:m.art.scale.toArray(),instrumentScale:m.body.scale.toArray(),actorFade:m.art.material.opacity,
    bounds:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.max(...points.map(p=>p.y)),bottom:Math.min(...points.map(p=>p.y))}};}),lights:spots.map(s=>s.light.intensity),drawCalls:renderer.info.render.calls};}};
}
