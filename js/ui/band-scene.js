import {createFestivalStage} from './band-festival-stage.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {bandRoster} from '../audio/band-parts.js';
import {formationAt,sampleBandMotion,bandEase} from '../audio/band-layout.js';
import {stageSpec,stageBandLayout,stageHeightAt,stageLightingAt,stageLimits,spatialStageAt,spatialStemMap} from '../audio/band-stage-layout.js';
import {bandBeatAt} from '../audio/band-beat.js';
import {bandPet,petFrameAt} from '../avatar/band-pets.js';
import {defaultBandSettings,settingsForMember} from './band-settings.js';
import {loadConcertModels} from './band-concert-props.js';
import {createEnergyWings,energyWingAttachment} from './band-energy-wings.js';
import {createBandGlow} from './band-glow.js';
import {particleWingState,stageEffectsAt} from '../audio/band-effects-timeline.js';

export async function createBandScene(container,{safeTop=0,safeBottom=15,cubeDesign=null,concertLook=new URLSearchParams(globalThis.location?.search||'').get('concertLook')}={}){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.setClearColor('#111b28',1);
 if('transmissionResolutionScale' in renderer)renderer.transmissionResolutionScale=.5;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.className='lu-band-canvas';container.append(renderer.domElement);
 const glow=createBandGlow(renderer,{threshold:.72,knee:.18,downscale:4});
 let glowStrength=0;
 let lookSnapshot=null,snapshotPending=false;
 function cancelLookSnapshot(){if(!lookSnapshot)return;lookSnapshot.animation?.cancel();lookSnapshot.animation=null;lookSnapshot.canvas.hidden=true;lookSnapshot.canvas.style.display='none';snapshotPending=false;}
 function captureLookSnapshot(){
  if(!lookSnapshot){const canvas=document.createElement('canvas'),scratch=document.createElement('canvas');canvas.className='lu-band-look-snapshot';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';canvas.hidden=true;container.append(canvas);lookSnapshot={canvas,scratch,animation:null};}
  const {canvas,scratch}=lookSnapshot,alpha=canvas.hidden?0:Number(getComputedStyle(canvas).opacity);
  scratch.width=canvas.width;scratch.height=canvas.height;if(alpha>0)scratch.getContext('2d').drawImage(canvas,0,0);
  lookSnapshot.animation?.cancel();lookSnapshot.animation=null;
  canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
  if(alpha>0){ctx.globalAlpha=alpha;ctx.drawImage(scratch,0,0,canvas.width,canvas.height);ctx.globalAlpha=1;}
  canvas.hidden=false;canvas.style.display='block';canvas.style.opacity='1';snapshotPending=true;
 }
 function fadeLookSnapshot(){if(!snapshotPending||!lookSnapshot)return;snapshotPending=false;
  const animation=lookSnapshot.canvas.animate([{opacity:1},{opacity:0}],{duration:550,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'});lookSnapshot.animation=animation;
  animation.onfinish=()=>{if(lookSnapshot?.animation===animation)cancelLookSnapshot();};
 }
 function drawTo(ctx,width=ctx.canvas.width,height=ctx.canvas.height){ctx.drawImage(renderer.domElement,0,0,width,height);if(lookSnapshot&&!lookSnapshot.canvas.hidden){ctx.save();ctx.globalAlpha=Number(getComputedStyle(lookSnapshot.canvas).opacity);ctx.drawImage(lookSnapshot.canvas,0,0,width,height);ctx.restore();}}
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.1,220);scene.background=new THREE.Color('#111b28');
 const room=new THREE.Scene();room.background=new THREE.Color('#364656');
 for(const [color,x,y,z,w,h] of [['#ffd3a0',-8,9,8,3,7],['#a3cbdf',9,8,4,2,6],['#fff0d1',0,12,-3,9,1],['#403044',0,2,-14,14,5]]){
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(color==='#403044'?.3:2.2),side:THREE.DoubleSide}));panel.position.set(x,y,z);panel.lookAt(0,2,0);room.add(panel);
 }
 const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;
 room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xfff4e2,0x48606c,0.95));
 const fill=new THREE.DirectionalLight(0xffe8ce,1.85);fill.position.set(-8,18,12);fill.castShadow=true;
 const rimLight=new THREE.DirectionalLight(0x78d4ea,1.8);rimLight.position.set(10,9,-8);scene.add(rimLight);
 Object.assign(fill.shadow.camera,{left:-24,right:24,top:24,bottom:-24,far:75});fill.shadow.mapSize.set(1024,1024);fill.shadow.bias=-.0004;scene.add(fill);
 const loader=new THREE.TextureLoader(),textures=new Map(),maxAniso=Math.min(8,renderer.capabilities.getMaxAnisotropy?.()||4);
 const textureFor=url=>{if(!textures.has(url))textures.set(url,loader.loadAsync(url).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=maxAniso;return t;}).catch(error=>{textures.delete(url);throw error;}));return textures.get(url);};
 let prewarmHandle=null,prewarmReady=false,prewarmStarted=false,prewarmBusy=false,prewarmLoaded=0;
 const prewarmQueue=[],prewarmFailures=[];
 function cancelPrewarm(){if(prewarmHandle===null)return;if(globalThis.cancelIdleCallback)cancelIdleCallback(prewarmHandle);else clearTimeout(prewarmHandle);prewarmHandle=null;}
 function schedulePrewarm(){
  if(disposed||!active||document.hidden||!prewarmReady||prewarmHandle!==null||prewarmBusy)return;
  if(!prewarmStarted){prewarmStarted=true;const urls=new Set(['one-piece','naruto','dragon-ball'].filter(t=>t!==theme).flatMap(t=>bandRoster(t).map(r=>bandPet(r.id).asset)));prewarmQueue.push(...[...urls].filter(url=>!textures.has(url)));}
  if(!prewarmQueue.length)return;
  const work=deadline=>{
   prewarmHandle=null;if(disposed||!active||document.hidden)return;
   if(deadline&&!deadline.didTimeout&&deadline.timeRemaining()<4){schedulePrewarm();return;}
   while(prewarmQueue.length&&textures.has(prewarmQueue[0]))prewarmQueue.shift();
   const url=prewarmQueue.shift();if(!url)return;prewarmBusy=true;
   textureFor(url).then(()=>{prewarmLoaded++;}).catch(()=>prewarmFailures.push(url)).finally(()=>{prewarmBusy=false;schedulePrewarm();});
  };
  prewarmHandle=globalThis.requestIdleCallback?requestIdleCallback(work,{timeout:2000}):setTimeout(()=>work(null),1500);
 }
 const onVisibility=()=>{if(document.hidden)cancelPrewarm();else schedulePrewarm();};
 const modelBundle=await loadConcertModels({concertLook});
 const festivalTextures={};await Promise.all(['cream','island'].map(async id=>{try{festivalTextures[id]=await textureFor(new URL(`../../assets/band-festival/${id}.jpg`,import.meta.url).href);}catch(error){console.warn('Festival background unavailable',id,error);}}));
 const theatre=createFestivalStage(scene,{modelBundle,festivalTextures});
 let frameStats=null;
 let members=[],theme='one-piece',narrow=false,active=false,revision=0,disposed=false,last=null,designKey=cubeDesign?.getKey?.()||'prism',captureSize=null;
 document.addEventListener('visibilitychange',onVisibility);
 let lastUpdateKey='',lastCameraFit=null,placementRevision=0,drag=null;
 const dragPhysics=new Map();let lastMotionNow=performance.now();
 function physicsFor(id){if(!dragPhysics.has(id))dragPhysics.set(id,{lift:0,tiltX:0,tiltZ:0,landingPulse:0,landingAge:1,lastX:0,lastZ:0});return dragPhysics.get(id);}
 let projectionVersion=0,projectedVersion=-1,lastProjectedMembers=[],renderCount=0;
 const projectionBox=new THREE.Box3(),projectionCorners=Array.from({length:8},()=>new THREE.Vector3());
 const projectedShoulder=new THREE.Vector3(),projectedFoot=new THREE.Vector3();
 function projectMembers(){
  if(projectedVersion===projectionVersion)return lastProjectedMembers;
  lastProjectedMembers=members.map(m=>{
   projectionBox.setFromObject(m.body);let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity,i=0;
   for(const x of [projectionBox.min.x,projectionBox.max.x])for(const y of [projectionBox.min.y,projectionBox.max.y])for(const z of [projectionBox.min.z,projectionBox.max.z]){
    const p=projectionCorners[i++].set(x,y,z).project(camera);left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.max(top,p.y);bottom=Math.min(bottom,p.y);
   }
   projectedShoulder.set(0,m.art.scale.y*.48,0).applyMatrix4(m.body.matrixWorld).project(camera);
   projectedFoot.set(0,.06,0).applyMatrix4(m.group.matrixWorld).project(camera);
   return {id:m.role.id,technique:m.role.technique,activity:m.sample?.activity||0,userMuted:Boolean(m.sample?.userMuted),position:m.group.position.toArray(),spatial:m.spatial||spatialStageAt(m.group.position.x,m.group.position.z,narrow),petFrame:m.frame,asset:m.pet.asset,
    centerNdc:{x:(left+right)/2,y:(top+bottom)/2},shoulderNdc:{x:projectedShoulder.x,y:projectedShoulder.y},footNdc:{x:projectedFoot.x,y:projectedFoot.y},bounds:{left,right,top,bottom}};
  });
  projectedVersion=projectionVersion;return lastProjectedMembers;
 }
 const placements=new Map();
 const limits=()=>stageLimits(narrow);
 function placed(point){const l=limits(),s=stageSpec(narrow),x=point.x*l.x;
  let z=l.back+point.z*(l.front-l.back);
  if(!narrow)z=Math.min(z,s.back+Math.sqrt(Math.max(0,s.radii[0]**2-x*x))-.7);
  return [x,stageHeightAt(x,z,narrow)+.045,z];}
 function rayPoint(x,y,plane){const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
  return ray.ray.intersectPlane(plane,new THREE.Vector3());}
 function startDrag(id,x,y){const member=members.find(m=>m.role.id===id);if(!member)return;
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-member.group.position.y),hit=rayPoint(x,y,plane);if(!hit)return;
  const physics=physicsFor(id);physics.lastX=member.group.position.x;physics.lastZ=member.group.position.z;physics.landingAge=1;
  drag={id,plane,hit,origin:member.group.position.clone(),previous:placements.get(id)};lastUpdateKey='';}
 function moveDrag(id,x,y){if(drag?.id!==id)return;const hit=rayPoint(x,y,drag.plane);if(!hit)return;const l=limits(),p=drag.origin.clone().add(hit.sub(drag.hit));
  const pt={x:THREE.MathUtils.clamp(p.x/l.x,-1,1),z:THREE.MathUtils.clamp((p.z-l.back)/(l.front-l.back),0,1)};
  placements.delete(id);placements.set(id,pt);
  const member=members.find(m=>m.role.id===id);
  if(member){const pos=placed(pt);member.group.position.fromArray(pos);member.spatial=spatialStageAt(pos[0],pos[2],narrow);}
  placementRevision++;lastUpdateKey='';}
 function endDrag(id,{cancelled=false}={}){if(drag?.id!==id)return;if(cancelled){if(drag.previous){placements.delete(id);placements.set(id,drag.previous);}else placements.delete(id);}const physics=physicsFor(id);physics.landingAge=cancelled?1:0;physics.landingPulse=cancelled?0:1;drag=null;placementRevision++;lastUpdateKey='';}
 function resetPositions(){placements.clear();dragPhysics.clear();drag=null;placementRevision++;lastUpdateKey='';}
 const dimensions=()=>captureSize?{w:captureSize.logicalWidth,h:captureSize.logicalHeight}:{w:container.clientWidth,h:container.clientHeight};
 const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;
 const hc=haloCanvas.getContext('2d'),gradient=hc.createRadialGradient(64,64,4,64,64,64);
 gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.3,'#ffffff88');gradient.addColorStop(1,'#ffffff00');hc.fillStyle=gradient;hc.fillRect(0,0,128,128);
 const haloTexture=new THREE.CanvasTexture(haloCanvas),spots=[];
 function ringMaterial(role){
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
   uniforms:{uColor:{value:new THREE.Color(role.accent||'#ffd28a')},uOpacity:{value:.18},uActivity:{value:0},uSolo:{value:0},uMuted:{value:0},uTime:{value:0}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 vUv;uniform vec3 uColor;uniform float uOpacity,uActivity,uSolo,uMuted,uTime;
    void main(){vec2 p=vUv*2.-1.;float r=length(p),theta=atan(p.y,p.x);
     float acoustic=1.-smoothstep(.012,.036,abs(r-.68));
     float phase=fract(r*2.2-uTime*(.8+uActivity*1.4));
     float ripple=(1.-smoothstep(.025,.10,abs(phase-.5)))*(.12+uActivity*.32);
     float segments=mix(1.,smoothstep(.15,.38,fract((theta+3.14159265)*4.77465)),max(uMuted,uSolo*.7));
     float edge=smoothstep(.36,.43,r)*(1.-smoothstep(.93,.98,r));
     float alpha=clamp((acoustic*(.88+uActivity*.45)+ripple*(1.-uMuted)*1.5)*segments*edge*uOpacity*1.8,0.,1.);
     vec3 col=mix(uColor*1.45,vec3(.58,.62,.65),uMuted*.7);
     gl_FragColor=vec4(col,alpha);}`});
  Object.defineProperty(material,'opacity',{configurable:true,get(){return this.uniforms.uOpacity.value;},set(value){this.uniforms.uOpacity.value=value;}});
  return material;
 }
 for(let i=0;i<10;i++){
  const light={position:new THREE.Vector3(),target:{position:new THREE.Vector3()},color:new THREE.Color(),intensity:0};
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(3.1,2.5),new THREE.MeshBasicMaterial({map:haloTexture,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));halo.rotation.x=-Math.PI/2;scene.add(halo);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.85,1,24,1,true),new THREE.ShaderMaterial({uniforms:{uOpacity:{value:0},uTint:{value:new THREE.Color('#ffe6b1')}},vertexShader:'varying vec2 vUv;varying vec3 vNormal,vView;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalMatrix*normal;vView=-mv.xyz;gl_Position=projectionMatrix*mv;}',fragmentShader:'varying vec2 vUv;varying vec3 vNormal,vView;uniform float uOpacity;uniform vec3 uTint;void main(){float soft=pow(abs(dot(normalize(vNormal),normalize(vView))),1.5);float axial=smoothstep(0.,.12,vUv.y)*(.55+.45*vUv.y);gl_FragColor=vec4(uTint,uOpacity*soft*axial);}',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));scene.add(beam);spots.push({light,halo,beam});
 }
 const leadLight=new THREE.SpotLight(0xffedcd,0,90,.35,.85,1.5);scene.add(leadLight,leadLight.target);
 function disposeGroup(group){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.customDepthMaterial?.dispose();});}
 function releaseMembers(){for(const m of members){m.wings?.dispose();scene.remove(m.group);disposeGroup(m.group);m.texture.dispose();m.labelTexture.dispose();}members=[];dragPhysics.clear();projectionVersion++;}
 function labelFor(role){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=144;const ctx=canvas.getContext('2d'),accent=role.accent||'#d8ad72';
  ctx.beginPath();ctx.roundRect(2,2,764,140,70);ctx.fillStyle='rgba(14,16,22,.82)';ctx.fill();ctx.strokeStyle=accent;ctx.globalAlpha=.45;ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=1;
  ctx.beginPath();ctx.arc(48,72,8,0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();
  const subtitle=role.instrument||role.technique||'';ctx.textAlign='left';ctx.fillStyle='#f5ecde';ctx.font='600 44px "Noto Serif SC", "PingFang SC", serif';ctx.fillText(role.name,78,subtitle?63:89,650);
  if(subtitle){ctx.font='500 26px "PingFang SC", sans-serif';ctx.fillStyle='#d8ad72';ctx.fillText(subtitle,80,106,640);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=maxAniso;texture.minFilter=THREE.LinearFilter;return texture;}
 async function configure(nextTheme=theme){
  if(members.length&&theme===nextTheme)return;theme=nextTheme;const token=++revision,roles=bandRoster(theme);
  const loaded=await Promise.all(roles.map(r=>textureFor(bandPet(r.id).asset)));
  if(disposed||token!==revision)return;releaseMembers();lastUpdateKey='';
  members=roles.map((role,i)=>{
   const pet=bandPet(role.id),group=new THREE.Group(),body=new THREE.Group();group.add(body);scene.add(group);
   const texture=loaded[i].clone();texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=maxAniso;texture.repeat.set(1/pet.frameCount,1);texture.offset.set(0,0);texture.needsUpdate=true;
   const art=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.035,depthWrite:true,toneMapped:false}));art.castShadow=true;body.add(art);
   art.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:texture,alphaTest:.22});
   const reflectionMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.15,depthWrite:false,depthTest:false,toneMapped:false,color:'#a9c4da'});
   reflectionMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a*=pow(1.0-vMapUv.y,2.0);\n#include <opaque_fragment>');};
   const reflection=new THREE.Mesh(new THREE.PlaneGeometry(1,1),reflectionMaterial);group.add(reflection);
   const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.4),new THREE.MeshBasicMaterial({map:haloTexture,color:'#08111f',transparent:true,opacity:.48,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.05;group.add(shadow);
   const ring=new THREE.Mesh(new THREE.PlaneGeometry(2.35,1.38),ringMaterial(role));ring.rotation.x=-Math.PI/2;ring.position.y=.058;group.add(ring);
   const labelTexture=labelFor(role),label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture,transparent:true,depthWrite:false,toneMapped:false}));label.scale.set(2.45,.46,1);group.add(label);
   // The roster starts with the singer and the two front-line partners in every theme.
   const wings=i<3?createEnergyWings(group,{samples:144,compactSamples:96}):null;
   return {role,pet,group,body,art,reflection,shadow,ring,label,labelTexture,texture,wings,frame:0,sample:null,pose:null};
  });
  resize();await theatre.setTheme(theme);prewarmReady=true;if(active)render();
 }
 function fitCamera(layouts,settings,lighting,wingState,cameraPose=null){
  const pitchOffset=cameraPose?.pitchOffset||0;
  const angle=THREE.MathUtils.degToRad((narrow?36:24)-(lighting.chorusView||0)*(narrow?4:5)+pitchOffset),up=new THREE.Vector3(0,Math.cos(angle),-Math.sin(angle)),out=new THREE.Vector3(0,Math.sin(angle),Math.cos(angle)),points=[];
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
  const top=safeTop>20?(narrow?64:42):(narrow?Math.min(safeTop,64):24),bottom=safeBottom>20?(narrow?152:108):Math.min(safeBottom,72),available=Math.max(.28,(h-top-bottom)/h),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  let distance=Math.max(3,...points.map(p=>p.dot(out)-centerZ+Math.max(Math.abs(p.x-target.x)/(tan*camera.aspect*.95),Math.abs(p.dot(up)-centerV)/(tan*available*.96))));
  const scale=narrow?1+((lighting.cameraScale||1)-1)*.25:(lighting.cameraScale||1);
  distance*=scale;
  if(cameraPose){
   const focusId=cameraPose.focusId,focusMix=THREE.MathUtils.clamp(cameraPose.focusMix||0,0,1);
   if(focusId&&focusMix>0){
    const idx=members.findIndex(m=>m.role.id===focusId||m.role.id.endsWith('/'+focusId));
    if(idx>=0&&layouts[1][idx]){
     const mp=layouts[1][idx],mh=3.05*settingsForMember(settings,members[idx].role.id).actorSize;
     const focusTarget=new THREE.Vector3(mp[0],mp[1]+mh*(cameraPose.focusHeight??.52),mp[2]);
     target.lerp(focusTarget,focusMix);
    }
   }
   if(cameraPose.targetOffsetX)target.x+=cameraPose.targetOffsetX;
   if(cameraPose.targetOffsetY)target.y+=cameraPose.targetOffsetY;
   if(cameraPose.targetOffsetZ)target.z+=cameraPose.targetOffsetZ;
   if(cameraPose.zoom&&cameraPose.zoom>0)distance/=cameraPose.zoom;
  }
  camera.position.copy(target).addScaledVector(out,distance);camera.lookAt(target);camera.setViewOffset(w,h,0,-(top-bottom)/2,w,h);camera.updateProjectionMatrix();
  camera.position.x+=(lighting.cameraShift||0)*(narrow?.3:1)+(cameraPose?.panX||0);
  camera.position.y+=(lighting.cameraLift||0)+(cameraPose?.liftY||0);
  camera.lookAt(target);
  lastCameraFit={distance,angle:THREE.MathUtils.radToDeg(angle),section:lighting.section,actorFraming:narrow,cameraPose:cameraPose||null};
 }
 function setSpot(spot,member,power,color,index){
  const target=member?.group.position||new THREE.Vector3(),s=stageSpec(narrow);
  spot.light.position.set((index%5-2)*(narrow?2.1:6.3),8.4,s.back-.6);spot.light.intensity=power*85;spot.light.color.copy(color);spot.light.target.position.copy(target).add(new THREE.Vector3(0,1,0));
  spot.halo.position.copy(target);spot.halo.position.y+=.025;spot.halo.material.color.copy(color);spot.halo.material.opacity=power*.58;
  const end=target.clone();end.y+=(member?.art.scale.y||3.3)+.15;
  const start=spot.light.position,direction=start.clone().sub(end),length=direction.length();spot.beam.position.copy(start).add(end).multiplyScalar(.5);spot.beam.scale.y=length;spot.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());spot.beam.material.uniforms.uOpacity.value=power?Math.min(.45,.14+power*.26):0;spot.beam.material.uniforms.uTint.value.copy(color);spot.beam.visible=power>.07;
 }
 function update(frame,{settings=defaultBandSettings(),focus=null,reduced=false,score=null,parts=[],easterEgg=null,effectsFrame=null,cameraPose=null}={}){
  if(!members.length||disposed)return;
  const motionNow=performance.now(),dt=Math.min(.05,Math.max(0,(motionNow-lastMotionNow)/1000));lastMotionNow=motionNow;
  const tactileActive=Boolean(drag)||[...dragPhysics.values()].some(p=>p.lift>.001||Math.abs(p.tiltZ)>.001||Math.abs(p.tiltX)>.001||p.landingAge<.45);
  const updateKey=`${frame.time}|${focus}|${reduced}|${placementRevision}|${frame.parts.map(p=>p.activity.toFixed(3)+':'+Boolean(p.userMuted)).join(',')}|${easterEgg?.id||''}|${easterEgg?.time||0}|${JSON.stringify(settings)}|${cubeDesign?.getKey?.()||designKey}|${JSON.stringify(cameraPose)}`;
  if(updateKey===lastUpdateKey&&last?.options.score===score&&last?.options.parts===parts&&!tactileActive&&!theatre.transitioning)return;
  const nextLook=settings.stageLook||'cream';
  if(nextLook!==theatre.look&&active&&renderCount>0&&!reduced)captureLookSnapshot();
  if(reduced)cancelLookSnapshot();
  theatre.setLook(nextLook,{immediate:reduced||!active||renderCount===0});
  lastUpdateKey=updateKey;last={frame,options:{settings,focus,reduced,score,parts,easterEgg,cameraPose}};
  const fx=effectsFrame||stageEffectsAt(score,frame.time,settings.effects||'auto',reduced?null:easterEgg);
  const wingState=particleWingState(score,frame.time,{mode:settings.effects,reduced});
  const lighting=stageLightingAt(score,frame.time,fx,reduced);
  const beat=bandBeatAt(score,frame.time),beatPulse=reduced?0:beat.pulse,downbeat=reduced?0:beat.downbeat;
  // Climax wings are stage decoration; recorded vocals correctly have no MIDI events.
  const wingFocus=members.some((m,i)=>m.wings&&!frame.parts[i]?.userMuted)?wingState.power:0;
  lighting.flash=(lighting.flash||0)*(1-wingFocus*.6);
  glowStrength=reduced?0:Math.min(.65,.07+(lighting.climax||0)*.16+wingFocus*.18+downbeat*.08+beatPulse*.03+(lighting.flash||0)*.15);
  const isIsland=settings.stageLook==='island';
  fill.intensity=(isIsland?1.95:1.80)+(lighting.flash||0)*.9+downbeat*.24;
  fill.color.set(isIsland?'#ffe0ba':'#fff0da').lerp(new THREE.Color(isIsland?'#ffb86c':'#ffd494'),((lighting.flash||0)+downbeat*.28)*.48);
  rimLight.color.set(isIsland?(theme==='naruto'?'#ffb48a':'#5fd4de'):(theme==='dragon-ball'?'#9ce0c2':theme==='naruto'?'#b8c4ee':'#88dce0'));
  rimLight.intensity=(isIsland?1.75:1.60)+(lighting.climax||0)*.28+beatPulse*.12;
  renderer.toneMappingExposure=1.02+(lighting.flash||0)*.16+downbeat*.04;
  const nextKey=cubeDesign?.getKey?.()||designKey;if(nextKey!==designKey){designKey=nextKey;theatre.refreshMaterial();}
  // A theme resize can still carry the preceding, longer roster's frame.
  const moving=settings.lightMode==='move',leader=Math.min(members.length-1,Math.max(0,frame.leadIndex)),previousLeader=Math.min(members.length-1,Math.max(0,frame.previousLeadIndex));
  const formation=formationAt(frame.time,score,focus||moving?'solo':settings.formation);
  const spread=settings.spread*(narrow?.90:1),from=stageBandLayout(members.length,formation.previousId,narrow,moving?previousLeader:leader,spread),to=stageBandLayout(members.length,formation.id,narrow,leader,spread);
  const next=stageBandLayout(members.length,formation.nextId,narrow,Math.max(0,frame.nextLeadIndex),spread);
  const manual=to.map((p,i)=>placements.has(members[i].role.id)?placed(placements.get(members[i].role.id)):p);
  fitCamera([from,to,next,manual],settings,lighting,wingState,cameraPose);
  members.forEach((member,i)=>{
   const sample=frame.parts[i]||{activity:0,energy:0,attack:0,notePulse:0,lead:false},part=parts[i]||member.role,v=settingsForMember(settings,member.role.id);
   const progress=moving&&frame.previousLeadIndex>=0?bandEase((frame.time-(frame.section?.start||0))/1.6):formation.mix;
   const mix=reduced?(progress>.5?1:0):progress;
   member.group.position.fromArray(from[i]).lerp(new THREE.Vector3(...to[i]),mix);
   member.group.position.x+=Math.sign(member.group.position.x)*v.gap*.6;
   member.group.position.y=stageHeightAt(member.group.position.x,member.group.position.z,narrow)+.045;
   if(placements.has(member.role.id))member.group.position.fromArray(placed(placements.get(member.role.id)));
   member.spatial=spatialStageAt(member.group.position.x,member.group.position.z,narrow);
   const pose=sampleBandMotion(sample,frame.time,score?.bpmEstimate||120,{technique:part.technique,index:i,actorMotion:v.actorMotion,instrumentMotion:v.instrumentMotion,reduced,beatPulse,downbeat});
   member.body.position.set(pose.actor.position[0],pose.actor.position[1]*.7,0);
   member.body.rotation.z=pose.actor.rotation[2]+(sample.attack||0)*THREE.MathUtils.degToRad(v.instrumentRotation)*.08*v.instrumentSize;
   const physics=physicsFor(member.role.id),dragging=drag?.id===member.role.id,blend=1-Math.exp(-18*dt);
   const vx=(member.group.position.x-physics.lastX)/Math.max(dt,.001),vz=(member.group.position.z-physics.lastZ)/Math.max(dt,.001);
   physics.lastX=member.group.position.x;physics.lastZ=member.group.position.z;
   if(reduced){physics.lift=physics.tiltX=physics.tiltZ=physics.landingPulse=0;physics.landingAge=1;}
   else{
    physics.lift=THREE.MathUtils.lerp(physics.lift,dragging?.24:0,blend);
    physics.tiltZ=THREE.MathUtils.lerp(physics.tiltZ,dragging?THREE.MathUtils.clamp(-vx*.18,-.16,.16):0,blend);
    physics.tiltX=THREE.MathUtils.lerp(physics.tiltX,dragging?THREE.MathUtils.clamp(vz*.12,-.10,.10):0,blend);
    if(!dragging)physics.landingAge+=dt;
    physics.landingPulse=physics.landingAge<.45?Math.exp(-physics.landingAge*7)*Math.cos(physics.landingAge*22):0;
   }
   member.body.position.y+=physics.lift+physics.landingPulse*.055;member.body.rotation.z+=physics.tiltZ;member.body.rotation.x=physics.tiltX;
   const isMuted=Boolean(sample.userMuted),isFocused=Boolean(focus&&focus===member.role.id),isOtherFocused=Boolean(focus&&focus!==member.role.id);
   const h=3.05*v.actorSize*(isFocused?1.06:1);
   member.art.position.set(0,h*(member.pet.baseline-.5),0);member.art.scale.set(h*.8,h,1);
   member.art.rotation.y=Math.atan2(camera.position.x-member.group.position.x,camera.position.z-member.group.position.z)+THREE.MathUtils.degToRad(v.actorRotation)*.32;
   member.reflection.position.set(0,-h*(member.pet.baseline-.5)*.30,.012);member.reflection.scale.set(h*.8,-h*.30,1);member.reflection.rotation.y=member.art.rotation.y;
   member.frame=petFrameAt(frame.time,score?.bpmEstimate||120,sample.activity,{reduced,speed:v.instrumentMotion*(.6+v.instrumentSize*.5),index:i,attack:Math.max(sample.attack||0,downbeat*sample.activity*.65)});member.texture.offset.x=member.frame/4;
   if(isMuted){
    member.art.material.opacity=.46;
    member.art.material.color.setRGB(.44,.48,.56);
    member.reflection.material.opacity=.035;
    member.ring.material.opacity=.03;
   }else if(isOtherFocused){
    member.art.material.opacity=.72;
    member.art.material.color.setRGB(.64,.68,.76);
    member.reflection.material.opacity=.07;
    member.ring.material.opacity=.08+sample.activity*.08;
   }else{
    member.art.material.opacity=isFocused?1:(settings.contrast?.92+sample.activity*.08:1);
    member.art.material.color.setRGB(isFocused?1:.94+sample.activity*.06,isFocused?1:.95+sample.activity*.05,isFocused?1:.98-lighting.climax*.025);
    member.reflection.material.opacity=.13+lighting.lift*.06+(lighting.flash||0)*.08+(isFocused?.09:0)+downbeat*.04;
    member.ring.material.opacity=Math.min(.95,isFocused?.75+beatPulse*.20:(.14+sample.activity*.42+beatPulse*.14+downbeat*.12));
   }
   member.ring.scale.setScalar(v.actorSize*(isFocused?1.18+beatPulse*.08:1+sample.activity*.08+beatPulse*.04));
   member.ring.scale.multiplyScalar(1+Math.max(0,physics.landingPulse)*.15);
   const ring=member.ring.material.uniforms;ring.uActivity.value=Math.min(1,sample.activity+beatPulse*.18);ring.uSolo.value=isFocused?1:0;ring.uMuted.value=isMuted?1:0;ring.uTime.value=frame.time;
   member.label.position.set(0,h+.2+physics.lift,.36);member.label.visible=!!focus&&focus===member.role.id;member.label.material.opacity=1;
   member.shadow.scale.setScalar(v.actorSize);member.shadow.material.opacity=isMuted?.24:.40+sample.activity*.09;
   const liftMix=physics.lift/.24;member.shadow.scale.multiplyScalar(1+liftMix*.14);member.shadow.material.opacity*=1-liftMix*.28;
   member.sample=sample;member.pose=pose;
  });
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  projectionVersion++;
  const occluders=wingState.power>.005?projectMembers().map(m=>m.bounds):[];
  const wingOverride=cameraPose?.wingPower;
  const effectiveWingState=typeof wingOverride==='number'?{power:wingOverride,spread:Math.min(1,wingOverride*1.08),dissolve:0}:wingState;
  members.forEach((m,i)=>{
   const hasSoloWings=Boolean(focus&&focus===m.role.id&&typeof wingOverride==='number'&&wingOverride>.01);
   const wState=!m.sample?.userMuted?(hasSoloWings?effectiveWingState:effectiveWingState):{power:0};
   m.wings?.update({time:frame.time,state:wState,narrow,height:m.art.scale.y,body:m.body,art:m.art,shoulder:energyWingAttachment(m.role.id),occluders:occluders.filter((_,j)=>j!==i)});
  });
  lighting.wingPower=Math.max(wingFocus,typeof wingOverride==='number'?wingOverride:0);
  lighting.wingZones=members.filter(m=>m.wings?.mesh.visible).map(m=>{
   const mesh=m.wings.mesh,points=[];mesh.updateWorldMatrix(true,false);
   for(const x of [-.78,.78])for(const y of [.08,.87])points.push(new THREE.Vector3(x,y,-.05).applyMatrix4(mesh.matrixWorld).project(camera));
   const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),bottom=Math.min(...points.map(p=>p.y)),top=Math.max(...points.map(p=>p.y));
   return {x:(left+right)/2,y:(bottom+top)/2,width:Math.max(.02,(right-left)/2),height:Math.max(.02,(top-bottom)/2)};
  });
  spots.forEach((spot,i)=>setSpot(spot,null,0,new THREE.Color('#ffe6c4'),i));
  const focusedIndex=focus?members.findIndex(m=>m.role.id===focus):-1;
  if(focusedIndex>=0){
   const m=members[focusedIndex];
   setSpot(spots[0],m,1.45+beatPulse*.28,new THREE.Color('#ffe8be').lerp(new THREE.Color(m.role.accent||'#ffd28a'),.35),focusedIndex);
  }else if(settings.lightMode==='multi'){
   members.forEach((m,i)=>setSpot(spots[i],m,(m.sample.userMuted?0:m.sample.activity*(m.sample.lead?1.25:.68)+downbeat*.15),new THREE.Color('#ffe4bd').lerp(new THREE.Color(m.role.accent),.24),i));
  }else if(frame.leadIndex>=0){
   const m=members[leader];setSpot(spots[0],m,(m.sample.userMuted?0:m.sample.activity*1.28+downbeat*.18),new THREE.Color('#ffe4bd'),leader);
  }
  const lead=members[focusedIndex>=0?focusedIndex:leader];leadLight.position.copy(spots[0].light.position);leadLight.target.position.copy(lead.group.position).add(new THREE.Vector3(0,1,0));leadLight.intensity=focusedIndex>=0?95+beatPulse*22:(frame.leadIndex>=0&&!lead.sample.userMuted?lead.sample.activity*68+downbeat*15:0);
  const s=stageSpec(narrow),rows=Array.from({length:s.levels},(_,level)=>{const row=members.filter(m=>Math.round((m.group.position.y-.395)/s.step)===level);return row.length?row.reduce((total,m)=>total+m.sample.activity,0)/row.length:0;});
  theatre.update(frame.time,fx,reduced,lighting,renderer.domElement.height,rows,settings.effects||'auto');
  if(active)render();
 }
 function resize(){const {w,h}=dimensions();if(!w||!h||disposed)return;narrow=w/h<.85;
  cancelLookSnapshot();
  lastUpdateKey='';
  renderer.setSize(captureSize?.width||w,captureSize?.height||h,false);camera.aspect=w/h;camera.fov=narrow?34:30;theatre.setLayout(narrow);
  if(last)update(last.frame,last.options);else if(members.length)update({time:0,parts:[],leadIndex:-1,previousLeadIndex:-1,nextLeadIndex:-1,section:null});
 }
 function render(){if(!disposed){const autoReset=renderer.info.autoReset,start=performance.now();renderer.info.autoReset=false;renderer.info.reset();try{renderer.render(scene,camera);if(glowStrength>.002&&!last?.options?.reduced)glow.apply(glowStrength);fadeLookSnapshot();schedulePrewarm();frameStats={renderCount:++renderCount,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,cpuMs:performance.now()-start,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length};}finally{renderer.info.autoReset=autoReset;}}}
 const observer=new ResizeObserver(resize);observer.observe(container);
 const raycaster=new THREE.Raycaster();
 function pickMember(clientX,clientY){
  if(!active)return null;const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/rectHeight(r))*2-1,camera);
  function rectHeight(rect){return rect.height||1;}
  raycaster.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),camera);
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
 function setActive(value){active=value;container.hidden=!value;if(value){resize();render();schedulePrewarm();}else{cancelLookSnapshot();cancelPrewarm();}}
 function setCaptureSize(width,height,logicalWidth,logicalHeight){if(captureSize?.width===width&&captureSize?.height===height)return;captureSize={width,height,logicalWidth,logicalHeight};renderer.setPixelRatio(1);resize();}
 function endCapture(){if(!captureSize)return;captureSize=null;renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));resize();}
 function dispose(){disposed=true;cancelPrewarm();document.removeEventListener('visibilitychange',onVisibility);cancelLookSnapshot();lookSnapshot?.canvas.remove();lookSnapshot=null;observer.disconnect();releaseMembers();theatre.dispose();glow.dispose();environment.dispose();haloTexture.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});for(const t of textures.values())t.then(texture=>texture.dispose()).catch(()=>{});renderer.dispose();renderer.domElement.remove();}
 const currentFormation=()=>last?formationAt(last.frame.time,last.options.score,last.options.focus||last.options.settings.lightMode==='move'?'solo':last.options.settings.formation).id:null;
 const currentSpatial=()=>spatialStemMap(
  members.map(m=>({id:m.role.id,position:m.group.position.toArray(),activity:m.sample?.activity||0,userMuted:Boolean(m.sample?.userMuted),spatial:m.spatial||spatialStageAt(m.group.position.x,m.group.position.z,narrow)})),
  last?.options?.parts||[],
  {narrow,draggingId:drag?.id||null,placedIds:[...placements.keys()]}
 );
 return {configure,update,resize,setActive,drawTo,setCaptureSize,endCapture,dispose,pickMember,startDrag,moveDrag,endDrag,resetPositions,canvas:renderer.domElement,get narrow(){return narrow;},get captureActive(){return !!captureSize;},get formation(){return currentFormation();},get spatial(){return currentSpatial();},get dragging(){return drag?.id||null;},get memberProjections(){return projectMembers();},get diagnostics(){const spatial=currentSpatial(),projected=projectMembers();return {active,theme,narrow,captureSize,formation:currentFormation(),stage:theatre.diagnostics,glow:{strength:glow.strength},petCount:members.length,prewarm:{started:prewarmStarted,busy:prewarmBusy,pending:prewarmQueue.length,loaded:prewarmLoaded,failed:[...prewarmFailures]},wings:{...particleWingState(last?.options.score,last?.frame.time||0,{mode:last?.options.settings.effects,reduced:last?.options.reduced}),members:members.filter(m=>m.wings).map(m=>({id:m.role.id,...m.wings.diagnostics}))},placements:Object.fromEntries(placements),dragging:drag?.id||null,spatial,
  cueSource:last?.options.score?.stageCues?.source||'demo',chorusCandidates:last?.options.score?.stageCues?.choruses||[],camera:{position:camera.position.toArray(),fov:camera.fov,aspect:camera.aspect,...lastCameraFit},propsBounds:theatre.projectProps(camera),fullFrame:frameStats,beams:spots.map(s=>s.beam.visible?s.beam.material.uniforms.uOpacity.value:0),members:members.map((m,i)=>({...projected[i],actorRotation:m.art.rotation.toArray().slice(0,3),instrumentRotation:m.body.rotation.toArray().slice(0,3),actorScale:m.art.scale.toArray(),instrumentScale:m.body.scale.toArray(),actorFade:m.art.material.opacity,ringOpacity:m.ring.material.opacity,ringShader:{activity:m.ring.material.uniforms.uActivity.value,solo:m.ring.material.uniforms.uSolo.value,muted:m.ring.material.uniforms.uMuted.value},labelSize:[m.labelTexture.image.width,m.labelTexture.image.height],dragPhysics:{...physicsFor(m.role.id)}
  })),lights:spots.map(s=>s.light.intensity),drawCalls:renderer.info.render.calls};}};
}
