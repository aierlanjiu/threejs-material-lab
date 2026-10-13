import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {RoundedBoxGeometry} from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/geometries/RoundedBoxGeometry.js/+esm';
import {RoomEnvironment} from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/environments/RoomEnvironment.js/+esm';
import {bandRoster} from '../audio/band-parts.js';
import {formationAt,layoutBand,sampleBandMotion,bandEase} from '../audio/band-layout.js';
import {defaultBandSettings,settingsForMember} from './band-settings.js';
import {renderLiveAvatar} from '../avatar/live.js';
import {applySurfaceContent} from './cube-surface.js';
const D=1.4,wallpapers={'one-piece':'op_luffy_kaido','dragon-ball':'db_goku_vegeta',naruto:'naruto_naruto_sasuke'};
const techniqueLabels={voice:'主唱',pluck:'弦乐',strike:'打击',sustain:'延音',keys:'键盘',wind:'吹奏'};
const lerp=(a,b,t)=>a+(b-a)*t;

export async function createBandScene(container,{safeTop=0,safeBottom=15,cubeDesign=null}={}){
 const renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.domElement.className='lu-band-canvas';container.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.1,180);scene.background=new THREE.Color('#111116');
 const pmrem=new THREE.PMREMGenerator(renderer),room=cubeDesign?.environmentScene||new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
 scene.environment=environment.texture;if(!cubeDesign?.environmentScene)room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xfff3df,0x252331,1.3));const fill=new THREE.DirectionalLight(0xffedda,1.4);fill.position.set(-4,8,10);scene.add(fill);
 const loader=new THREE.TextureLoader(),textures=new Map();
 const textureFor=url=>{if(!textures.has(url))textures.set(url,loader.loadAsync(url).then(t=>{t.colorSpace=THREE.SRGBColorSpace;return t;}));return textures.get(url);};
 function defaultCube(texture){
  const material=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.025,transmission:.96,thickness:1.2,ior:1.52,dispersion:.18,clearcoat:1,clearcoatRoughness:0,
   attenuationColor:new THREE.Color('#c94f64').lerp(new THREE.Color(0xffffff),.18),attenuationDistance:1.2,transparent:true,opacity:.86,side:THREE.DoubleSide,envMapIntensity:1.25});
  applySurfaceContent(material,texture,'conformal',.94,[0,1,0,1]);const group=new THREE.Group(),mesh=new THREE.Mesh(new RoundedBoxGeometry(1,1,1,8,.20),material);mesh.renderOrder=5;group.add(mesh);return group;
 }
 const createCube=cubeDesign?.createCube||defaultCube;
 let members=[],theme='one-piece',narrow=false,active=false,revision=0,disposed=false,last=null,backgroundTexture=null,backgroundRevision=0,designKey=cubeDesign?.getKey()||'crystal',captureSize=null;
 const dimensions=()=>captureSize?{w:captureSize.logicalWidth,h:captureSize.logicalHeight}:{w:container.clientWidth,h:container.clientHeight};
 const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;const hc=haloCanvas.getContext('2d'),gradient=hc.createRadialGradient(64,64,4,64,64,64);
 gradient.addColorStop(0,'#fff5d9');gradient.addColorStop(.28,'#fff5d988');gradient.addColorStop(1,'#fff5d900');hc.fillStyle=gradient;hc.fillRect(0,0,128,128);
 const haloTexture=new THREE.CanvasTexture(haloCanvas),spots=[];
 for(let i=0;i<10;i++){
  const light=new THREE.SpotLight(0xffedcd,0,100,.31,.8,1);light.position.set((i%5-2)*4,24,10);scene.add(light,light.target);
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.MeshBasicMaterial({map:haloTexture,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));halo.rotation.x=-Math.PI/2;scene.add(halo);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.03,1.1,1,16,1,true),new THREE.MeshBasicMaterial({color:0xffe6b1,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));scene.add(beam);spots.push({light,halo,beam});
 }
 function prepareMaterials(group){group.traverse(o=>{if(!o.material)return;const mat=o.material;
  const original=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat);mat.transparent=true;
  mat.userData.bandBase={color:mat.color.clone(),roughness:mat.roughness,env:mat.envMapIntensity,transmission:mat.transmission||0,clearcoat:mat.clearcoat||0,emissive:mat.emissive?.clone(),emissiveIntensity:mat.emissiveIntensity||0};
  mat.userData.bandFade={value:1};mat.customProgramCacheKey=()=>key()+'-lu-band-v2';
  mat.onBeforeCompile=(shader,r)=>{original.call(mat,shader,r);shader.uniforms.luBandFade=mat.userData.bandFade;
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float luBandFade;').replace('#include <opaque_fragment>','#include <opaque_fragment>\ngl_FragColor.a *= luBandFade;');};mat.needsUpdate=true;
 });}
 function disposeGroup(group){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 function mountCube(mount,texture){const group=createCube(texture);prepareMaterials(group);mount.add(group);}
 function refreshCubes(){const next=cubeDesign?.getKey()||designKey;if(next===designKey)return;designKey=next;
  for(const m of members)for(const [mount,texture] of [[m.face,m.faceTexture],[m.instrument,m.instrumentTexture]]){for(const child of [...mount.children]){mount.remove(child);disposeGroup(child);}mountCube(mount,texture);}
 }
 function releaseMembers(){for(const m of members){scene.remove(m.group);disposeGroup(m.group);m.faceTexture.dispose();m.labelTexture.dispose();}members=[];}
 async function background(){const token=++backgroundRevision,current=theme,url=new URL(`../../images/wallpapers/${wallpapers[theme]}${narrow?'':'_wide'}.jpg`,import.meta.url).href;
  const texture=await textureFor(url);if(disposed||token!==backgroundRevision||current!==theme)return;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.max(256,Math.round(1024/camera.aspect));const ctx=canvas.getContext('2d'),img=texture.image;
  ctx.fillStyle='#111116';ctx.fillRect(0,0,canvas.width,canvas.height);
  const blurRadius=narrow?5:8,pad=blurRadius*2,dw=canvas.width+pad*2,dh=canvas.height+pad*2,scale=Math.max(dw/img.width,dh/img.height);
  ctx.filter=`blur(${blurRadius}px) contrast(0.92) brightness(0.95)`;ctx.globalAlpha=.29;
  ctx.drawImage(img,(canvas.width-img.width*scale)/2,(canvas.height-img.height*scale)/2,img.width*scale,img.height*scale);ctx.filter='none';
  backgroundTexture?.dispose();backgroundTexture=new THREE.CanvasTexture(canvas);backgroundTexture.colorSpace=THREE.SRGBColorSpace;scene.background=backgroundTexture;if(active)render();
 }
 function labelFor(role){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=72;const ctx=canvas.getContext('2d');ctx.font='29px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ede2cf';ctx.shadowColor='#111116';ctx.shadowBlur=5;ctx.fillText(`${role.name} · ${techniqueLabels[role.technique]}`,256,44);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
 async function configure(nextTheme=theme){if(members.length&&theme===nextTheme)return;theme=nextTheme;const token=++revision,roles=bandRoster(theme);
  const icons=await Promise.all(roles.map(r=>textureFor(r.asset))),canvases=await Promise.all(roles.map(async role=>{const c=document.createElement('canvas');c.width=c.height=256;await renderLiveAvatar(role.id,c,0,'calm',{reduced:true});return c;}));
  if(disposed||token!==revision)return;releaseMembers();
  members=roles.map((role,i)=>{const group=new THREE.Group(),body=new THREE.Group(),face=new THREE.Group(),instrument=new THREE.Group();group.add(body);body.add(face,instrument);scene.add(group);
   const faceTexture=new THREE.CanvasTexture(canvases[i]);faceTexture.colorSpace=THREE.SRGBColorSpace;mountCube(face,faceTexture);mountCube(instrument,icons[i]);
   const labelTexture=labelFor(role),label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture,transparent:true,depthWrite:false,toneMapped:false}));group.add(label);
   const auraMesh=new THREE.Mesh(new THREE.RingGeometry(.28*D,.78*D,32),new THREE.MeshBasicMaterial({color:new THREE.Color(role.accent),transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
   auraMesh.rotation.x=-Math.PI/2;auraMesh.position.y=-.68*D;group.add(auraMesh);
   const scratch=document.createElement('canvas');scratch.width=scratch.height=256;
   return {role,group,body,face,instrument,aura:auraMesh,faceTexture,instrumentTexture:icons[i],canvas:canvases[i],scratch,label,labelTexture,pending:false,desiredTime:0,sample:null,pose:null};});
  resize();await background();
 }
 function fitPositions(layouts,settings){
  const angle=THREE.MathUtils.degToRad(narrow?13:26),up=new THREE.Vector3(0,Math.cos(angle),-Math.sin(angle)),out=new THREE.Vector3(0,Math.sin(angle),Math.cos(angle)),points=[];
  for(const positions of layouts)positions.forEach((p,i)=>{const values=settingsForMember(settings,members[i].role.id),width=(values.actorSize+values.instrumentSize+values.gap)*.58*D+.25*D,height=Math.max(values.actorSize,values.instrumentSize)*.65*D+.16*D;
   const center=new THREE.Vector3(...p).multiplyScalar(D);for(const x of [-width,width])for(const y of [-height-.35*D,height+.25*D])for(const z of [-height,height])points.push(center.clone().add(new THREE.Vector3(x,y,z)));});
  const vertical=points.map(p=>p.dot(up)),depth=points.map(p=>p.dot(out)),xs=points.map(p=>p.x);
  const centerV=(Math.min(...vertical)+Math.max(...vertical))/2,centerZ=(Math.min(...depth)+Math.max(...depth))/2,centerX=(Math.min(...xs)+Math.max(...xs))/2;
  const target=up.clone().multiplyScalar(centerV).addScaledVector(out,centerZ);target.x=centerX;
  const {w,h}=dimensions(),top=narrow?safeTop:30,available=Math.max(.28,(h-top-safeBottom)/h),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  const distance=Math.max(3,...points.map(p=>p.dot(out)-centerZ+Math.max(Math.abs(p.x-centerX)/(tan*camera.aspect*.93),Math.abs(p.dot(up)-centerV)/(tan*available*.96))));
  return {target,distance,out,top};
 }
 function fitCamera(from,to,next,cue,settings){const union=fitPositions([from,to],settings),current=fitPositions([to],settings);let fit=union,mix=0;
  if(cue.auto){if(cue.phase>1.6){mix=bandEase((cue.phase-1.6)/1.2);fit={...current,target:union.target.clone().lerp(current.target,mix),distance:lerp(union.distance,current.distance,mix)};}
   if(cue.untilNext<1.2){const upcoming=fitPositions([to,next],settings),p=bandEase(1-cue.untilNext/1.2);fit={...current,target:current.target.clone().lerp(upcoming.target,p),distance:lerp(current.distance,upcoming.distance,p)};}}
  camera.position.copy(fit.target).addScaledVector(fit.out,fit.distance);camera.lookAt(fit.target);const {w,h}=dimensions();camera.setViewOffset(w,h,0,-(fit.top-safeBottom)/2,w,h);camera.updateProjectionMatrix();
 }
 function materialState(mount,sample,settings,actor,accent){const amount=settings.contrast?sample.activity:1;
  const isLead=!!sample.lead,attack=sample.attack||0;
  mount.traverse(o=>{const mat=o.material,base=mat?.userData.bandBase;if(!base)return;
   mat.userData.bandFade.value=actor?lerp(.90,1,amount):lerp(.84,1,amount);
   mat.roughness=settings.contrast?lerp(Math.max(.14,base.roughness*1.05),base.roughness,amount):base.roughness;
   mat.envMapIntensity=base.env*(settings.contrast?lerp(.95,1.30,amount):1);
   if('transmission'in mat)mat.transmission=base.transmission*(settings.contrast?lerp(.96,.82,amount):1);
   if('clearcoat'in mat)mat.clearcoat=settings.contrast?lerp(Math.max(.55,base.clearcoat*.85),Math.max(.85,base.clearcoat),amount):base.clearcoat;
   mat.color.copy(base.color);if(settings.contrast&&amount<.01)mat.color.lerp(new THREE.Color('#9aa0aa'),.05);
   if(mat.emissive&&base.emissive){mat.emissive.copy(base.emissive);const glow=(isLead?.35+attack*.25:.18)*amount;if(settings.contrast&&glow>0){mat.emissive.lerp(accent,glow);mat.emissiveIntensity=base.emissiveIntensity+glow*1.15;}}
  });return amount;
 }
 function setSpot(spot,target,power,color){spot.light.intensity=power*16;spot.light.color.copy(color);spot.light.target.position.copy(target);
  spot.halo.position.copy(target);spot.halo.position.y-=.7*D;spot.halo.material.color.copy(color);spot.halo.material.opacity=power*.32;
  const start=spot.light.position,direction=start.clone().sub(target),length=direction.length();spot.beam.position.copy(start).add(target).multiplyScalar(.5);spot.beam.scale.y=length;spot.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());spot.beam.material.opacity=power*.036;spot.beam.material.color.copy(color);
 }
 function update(frame,{settings=defaultBandSettings(),focus=null,reduced=false,score=null,parts=[]}={}){
  if(!members.length||disposed)return;last={frame,options:{settings,focus,reduced,score,parts}};refreshCubes();
  let spread=settings.spread;for(const m of members){const v=settingsForMember(settings,m.role.id);spread=Math.max(spread,settings.spread*(v.actorSize+v.instrumentSize+v.gap+.42)/2.6);}
  const moving=settings.lightMode==='move',leader=Math.max(0,frame.leadIndex),previousLeader=Math.max(0,frame.previousLeadIndex),nextLeader=Math.max(0,frame.nextLeadIndex);
  const formation=formationAt(frame.time,score,focus||moving?'solo':settings.formation);
  const previousForm=formation.previousId,elapsed=frame.section?frame.time-frame.section.start:formation.phase;
  const usePrevious=moving&&frame.previousLeadIndex>=0;
  const from=layoutBand(members.length,previousForm,narrow,usePrevious?previousLeader:leader,spread),to=layoutBand(members.length,formation.id,narrow,leader,spread);
  const next=layoutBand(members.length,moving?'solo':formation.nextId,narrow,moving?nextLeader:leader,spread);
  const phase=moving?elapsed:formation.phase,untilNext=moving?(frame.section?.end||frame.time+8)-frame.time:16-formation.phase;
  fitCamera(from,to,next,{...formation,auto:formation.auto||moving,phase,untilNext},settings);
  members.forEach((member,i)=>{
   const sample=frame.parts[i]||{activity:0,energy:0,attack:0,notePulse:0,lead:false},part=parts[i]||member.role,values=settingsForMember(settings,member.role.id);
   let mix=formation.mix;if(moving&&usePrevious&&leader!==previousLeader)mix=i===previousLeader?bandEase(elapsed/.75):i===leader?bandEase((elapsed-.8)/.8):bandEase(elapsed/1.6);
   if(reduced)mix=mix>.5?1:0;member.group.position.fromArray(from[i]).lerp(new THREE.Vector3(...to[i]),mix).multiplyScalar(D);
   const pose=sampleBandMotion(sample,frame.time,score?.bpmEstimate||120,{technique:part.technique,index:i,actorMotion:values.actorMotion,instrumentMotion:values.instrumentMotion,reduced});
   member.body.rotation.fromArray(pose.group.rotation);member.body.position.fromArray(pose.group.position).multiplyScalar(D);
   const faceX=-(values.instrumentSize+values.gap)*D/2,instrumentX=(values.actorSize+values.gap)*D/2;
   member.face.position.fromArray(pose.actor.position).multiplyScalar(D);member.face.position.x+=faceX;member.face.rotation.fromArray(pose.actor.rotation);member.face.rotation.y+=THREE.MathUtils.degToRad(values.actorRotation);member.face.scale.fromArray(pose.actor.scale).multiplyScalar(values.actorSize*D);
   member.instrument.position.fromArray(pose.instrument.position).multiplyScalar(D);member.instrument.position.x+=instrumentX;member.instrument.position.y-=(1-values.instrumentSize)*.12*D;
   member.instrument.rotation.fromArray(pose.instrument.rotation);member.instrument.rotation.y+=THREE.MathUtils.degToRad(values.instrumentRotation);member.instrument.scale.fromArray(pose.instrument.scale).multiplyScalar(values.instrumentSize*D);
   member.label.position.set(0,-Math.max(values.actorSize,values.instrumentSize)*D/2-.36*D,.4*D);member.label.scale.set(Math.max(1.8,values.actorSize+values.instrumentSize+values.gap)*D,.40*D,1);member.label.material.opacity=lerp(.84,1,sample.activity);
   if(member.aura){const isLead=!!sample.lead,att=sample.attack||0;member.aura.material.opacity=sample.activity>.02?Math.min(.65,(isLead?.46:.24)*sample.activity+att*.20):.04;}
   const color=new THREE.Color(member.role.accent);materialState(member.face,sample,settings,true,color);materialState(member.instrument,sample,settings,false,color);
   member.sample=sample;member.pose=pose;member.desiredTime=frame.time;
   if(!member.pending){member.pending=true;const time=frame.time,epoch=revision;renderLiveAvatar(member.role.id,member.scratch,time,sample.activity>.25?'happy':'calm',{reduced}).then(()=>{
    if(disposed||epoch!==revision||Math.abs(member.desiredTime-time)>.1)return;member.canvas.getContext('2d').clearRect(0,0,256,256);member.canvas.getContext('2d').drawImage(member.scratch,0,0);member.faceTexture.needsUpdate=true;
   }).catch(console.warn).finally(()=>member.pending=false);}
  });
  spots.forEach(s=>setSpot(s,new THREE.Vector3(),0,new THREE.Color('#fff0d3')));
  if(settings.lightMode==='multi')members.forEach((m,i)=>{const isLead=m.sample.lead,att=m.sample.attack||0;const power=m.sample.activity*(isLead?1.25+att*.35:.75);setSpot(spots[i],m.group.position,power,new THREE.Color('#ffedd3').lerp(new THREE.Color(m.role.accent),isLead?.35:.22));});
  else if(frame.leadIndex>=0){const m=members[leader],att=m.sample.attack||0,power=m.sample.activity*1.35+att*.35+(focus?.16:0);setSpot(spots[0],m.group.position,power,new THREE.Color('#ffedd3').lerp(new THREE.Color(m.role.accent),.28));}
  if(active)render();
 }
 function resize(){const {w,h}=dimensions();if(!w||!h)return;const previous=narrow;narrow=w/h<.85;renderer.setSize(captureSize?.width||w,captureSize?.height||h,false);camera.aspect=w/h;camera.fov=narrow?34:30;
  if(last)update(last.frame,last.options);else if(members.length)update({time:0,parts:[],leadIndex:-1,previousLeadIndex:-1,nextLeadIndex:-1,section:null});
  if(previous!==narrow)background().catch(console.warn);
 }
 function render(){if(!disposed)renderer.render(scene,camera);}
 const observer=new ResizeObserver(resize);observer.observe(container);
 function setActive(value){active=value;container.hidden=!value;if(value){resize();render();}}
 function setCaptureSize(width,height,logicalWidth,logicalHeight){if(captureSize?.width===width&&captureSize?.height===height)return;captureSize={width,height,logicalWidth,logicalHeight};renderer.setPixelRatio(1);resize();}
 function endCapture(){if(!captureSize)return;captureSize=null;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));resize();}
 function dispose(){disposed=true;observer.disconnect();releaseMembers();environment.dispose();backgroundTexture?.dispose();haloTexture.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});for(const t of textures.values())t.then(texture=>texture.dispose());renderer.dispose();renderer.domElement.remove();}
 const currentFormation=()=>last?formationAt(last.frame.time,last.options.score,last.options.focus||last.options.settings.lightMode==='move'?'solo':last.options.settings.formation).id:null;
 return {configure,update,resize,setActive,setCaptureSize,endCapture,dispose,canvas:renderer.domElement,get captureActive(){return !!captureSize;},get formation(){return currentFormation();},get diagnostics(){return {active,theme,narrow,captureSize,formation:currentFormation(),
  members:members.map(m=>{const box=new THREE.Box3().setFromObject(m.body),points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(camera));
   return {id:m.role.id,technique:m.role.technique,activity:m.sample?.activity||0,position:m.group.position.toArray(),actorRotation:m.face.rotation.toArray().slice(0,3),instrumentRotation:m.instrument.rotation.toArray().slice(0,3),actorScale:m.face.scale.toArray(),instrumentScale:m.instrument.scale.toArray(),actorFade:m.face.children[0]?.children[0]?.material?.userData.bandFade?.value,
    bounds:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.max(...points.map(p=>p.y)),bottom:Math.min(...points.map(p=>p.y))}};}),lights:spots.map(s=>s.light.intensity)};}};
}
