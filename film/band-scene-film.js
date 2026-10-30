import {createFestivalStage} from '../js/ui/band-festival-stage.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {bandRoster} from '../js/audio/band-parts.js';
import {formationAt,sampleBandMotion,bandEase} from '../js/audio/band-layout.js';
import {stageSpec,stageBandLayout,stageHeightAt,stageLightingAt,stageLimits,spatialStageAt,spatialStemMap} from '../js/audio/band-stage-layout.js';
import {bandBeatAt} from '../js/audio/band-beat.js';
import {bandPet,petFrameAt} from '../js/avatar/band-pets.js';
import {defaultBandSettings,settingsForMember} from '../js/ui/band-settings.js';
import {loadConcertModels} from '../js/ui/band-concert-props.js';
import {createEnergyWings,energyWingAttachment} from '../js/ui/band-energy-wings.js';
import {createBandGlow} from '../js/ui/band-glow.js';
import {particleWingState,stageEffectsAt} from '../js/audio/band-effects-timeline.js';

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
 const hemi=new THREE.HemisphereLight(0xfff4e2,0x48606c,0.95);scene.add(hemi);
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
 const festivalTextures={};await Promise.all(['cream','island'].map(async id=>{try{festivalTextures[id]=await textureFor(new URL(`../assets/band-festival/${id}.jpg`,import.meta.url).href);}catch(error){console.warn('Festival background unavailable',id,error);}}));
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
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.85,1,24,1,true),new THREE.ShaderMaterial({uniforms:{uOpacity:{value:0},uTint:{value:new THREE.Color('#ffe6b1')},uTime:{value:0},uSolo:{value:0}},vertexShader:'varying vec2 vUv;varying vec3 vNormal,vView;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalMatrix*normal;vView=-mv.xyz;gl_Position=projectionMatrix*mv;}',fragmentShader:`varying vec2 vUv;varying vec3 vNormal,vView;uniform float uOpacity,uTime,uSolo;uniform vec3 uTint;
   void main(){
    float soft=pow(abs(dot(normalize(vNormal),normalize(vView))),1.35);
    float axial=smoothstep(0.,.10,vUv.y)*(.50+.50*vUv.y)*(1.-smoothstep(.92,1.,vUv.y));
    float ray=0.82+0.18*sin(vUv.x*44.0+uTime*1.6)*cos(vUv.y*12.0-uTime*0.8);
    vec2 g1=floor(vec2(vUv.x*32.0,vUv.y*20.0-uTime*1.8));
    float h1=fract(sin(dot(g1,vec2(12.9898,78.233)))*43758.5453);
    vec2 f1=fract(vec2(vUv.x*32.0,vUv.y*20.0-uTime*1.8))-0.5;
    float mote1=step(0.92,h1)*exp(-dot(f1,f1)*26.0)*(0.5+0.5*sin(uTime*5.0+h1*30.0));
    vec2 g2=floor(vec2(vUv.x*54.0+4.2,vUv.y*34.0-uTime*2.6));
    float h2=fract(sin(dot(g2,vec2(39.346,11.135)))*43758.5453);
    vec2 f2=fract(vec2(vUv.x*54.0+4.2,vUv.y*34.0-uTime*2.6))-0.5;
    float mote2=step(0.94,h2)*exp(-dot(f2,f2)*32.0);
    float dust=(mote1+mote2*0.8)*(0.35+uSolo*0.95);
    vec3 col=uTint*(1.0+dust*1.4)*ray;
    float alpha=clamp((uOpacity*soft*axial*ray)+(dust*soft*axial*uOpacity*1.8),0.,1.);
    gl_FragColor=vec4(col,alpha);
   }`,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));scene.add(beam);spots.push({light,halo,beam});
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
   const wings=createEnergyWings(group,{samples:144,compactSamples:96});
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
 // ── Film fork: every value below is a pure function of the options passed in
 // (song time + director state). No wall clock, no accumulated physics, so any
 // frame can be rendered in isolation and re-rendered bit-identically.
 const shockGeometry=new THREE.PlaneGeometry(1,1);
 const shockMaterial=()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
  uniforms:{uColor:{value:new THREE.Color('#ffd28a')},uAge:{value:9},uPower:{value:0},uRings:{value:3}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 vUv;uniform vec3 uColor;uniform float uAge,uPower,uRings;
   void main(){vec2 p=vUv*2.-1.;float r=length(p);float a=0.;
    for(int i=0;i<4;i++){if(float(i)>=uRings)break;float age=uAge-float(i)*.11;if(age<0.)continue;
     float front=1.-exp(-age*3.2);float w=.018+age*.05;float k=1.-smoothstep(0.,w,abs(r-front));
     a+=k*exp(-age*2.4)*(1.-float(i)*.22);}
    float dust=fract(sin(dot(floor(p*38.),vec2(12.9898,78.233)))*43758.5453);
    float sparkle=step(.965,dust)*exp(-uAge*3.)*(1.-smoothstep(.2,1.,r))*smoothstep(.0,.15,uAge);
    a=(a+sparkle*.9)*uPower*(1.-smoothstep(.94,1.,r));
    gl_FragColor=vec4(uColor*1.6,clamp(a,0.,1.));}`});
 const shocks=Array.from({length:4},()=>{const m=new THREE.Mesh(shockGeometry,shockMaterial());m.rotation.x=-Math.PI/2;m.visible=false;m.renderOrder=3;scene.add(m);return m;});
 function update(frame,{settings=defaultBandSettings(),focus=null,reduced=false,score=null,parts=[],easterEgg=null,effectsFrame=null,cameraPose=null,film={}}={}){
  if(!members.length||disposed)return;
  theatre.setLook(settings.stageLook||'cream',{immediate:true});
  last={frame,options:{settings,focus,reduced,score,parts,easterEgg,cameraPose,film}};
  const fx=effectsFrame||stageEffectsAt(score,frame.time,settings.effects||'auto',null);
  const wingState=film.wings||{power:0,spread:0,dissolve:0};
  const lighting=stageLightingAt(score,frame.time,fx,false);
  const beatPulse=film.beat?.pulse??0,downbeat=film.beat?.downbeat??0;
  lighting.beat=beatPulse;lighting.downbeat=downbeat;
  const bed=THREE.MathUtils.clamp(film.bed||0,0,1),soloId=film.solo?.id||null,soloPower=THREE.MathUtils.clamp(film.solo?.power||0,0,1);
  const wingFocus=wingState.power||0;
  lighting.flash=(lighting.flash||0)*(1-wingFocus*.45);
  glowStrength=Math.min(.75,.08+(lighting.climax||0)*.18+wingFocus*.20+downbeat*.08+beatPulse*.03+(lighting.flash||0)*.15+soloPower*.10)*(film.glow??1);
  const isIsland=settings.stageLook==='island';
  const dim=1-bed*.72;
  fill.intensity=((isIsland?1.95:1.80)+(lighting.flash||0)*.9+downbeat*.24)*dim;
  fill.color.set(isIsland?'#ffe0ba':'#fff0da').lerp(new THREE.Color(isIsland?'#ffb86c':'#ffd494'),((lighting.flash||0)+downbeat*.28)*.48);
  hemi.intensity=.95*(1-bed*.62);
  rimLight.color.set(isIsland?'#5fd4de':'#88dce0');
  rimLight.intensity=((isIsland?1.75:1.60)+(lighting.climax||0)*.28+beatPulse*.12)*(1-bed*.5);
  renderer.toneMappingExposure=(1.02+(lighting.flash||0)*.16+downbeat*.04)*(film.exposure??1)*(1-bed*.10);
  const formationFrom=film.formation?.from||'arc',formationTo=film.formation?.to||formationFrom,formationMix=bandEase(THREE.MathUtils.clamp(film.formation?.mix??1,0,1));
  const from=stageBandLayout(members.length,formationFrom,narrow,0,1),to=stageBandLayout(members.length,formationTo,narrow,0,1);
  if(film.camera){
   const c=film.camera;camera.fov=c.fov||30;camera.clearViewOffset();camera.position.fromArray(c.position);camera.up.set(0,1,0);camera.lookAt(new THREE.Vector3().fromArray(c.target));
   if(c.roll)camera.rotateZ(c.roll);camera.updateProjectionMatrix();
   lastCameraFit={film:true,fov:camera.fov};
  }else fitCamera([from,to,to,to],settings,lighting,{power:0},cameraPose);
  members.forEach((member,i)=>{
   const id=member.role.id,short=id.split('/')[1];
   const sample=frame.parts[i]||{activity:0,energy:0,attack:0,notePulse:0,lead:false,idle:true},part=parts[i]||member.role,v=settingsForMember(settings,id);
   member.group.position.fromArray(from[i]).lerp(new THREE.Vector3(...to[i]),formationMix);
   const pos=film.positions?.[short];
   if(pos){member.group.position.x=pos[0];member.group.position.z=pos[1];}
   member.group.position.y=stageHeightAt(member.group.position.x,member.group.position.z,narrow)+.045;
   member.spatial=spatialStageAt(member.group.position.x,member.group.position.z,narrow);
   const pose=sampleBandMotion(sample,frame.time,score?.bpmEstimate||120,{technique:part.technique,index:i,actorMotion:v.actorMotion,instrumentMotion:v.instrumentMotion,reduced:false,beatPulse,downbeat});
   member.body.position.set(pose.actor.position[0],pose.actor.position[1]*.7,0);
   member.body.rotation.set(0,0,pose.actor.rotation[2]+(sample.attack||0)*THREE.MathUtils.degToRad(v.instrumentRotation)*.08*v.instrumentSize);
   // Technique-specific secondary motion: strike squash, pluck strum tilt, voice resonance.
   const atk=sample.attack||0,tech=part.technique;
   let sx=1,sy=1;
   if(tech==='strike'){sy=1-atk*.045;sx=1+atk*.03;member.body.position.y-=atk*.035;}
   else if(tech==='pluck'){member.body.rotation.z+=(atk*.075)*(i%2?1:-1);}
   else if(tech==='voice'){const res=Math.sin(frame.time*Math.PI*2*6.5)*.006*(sample.activity||0);sx=1+res;sy=1-res*.6+atk*.02;}
   else if(tech==='wind'){sy=1+(sample.activity||0)*.018*Math.sin(frame.time*Math.PI);}
   const ph=film.physics?.[short]||{lift:0,tiltX:0,tiltZ:0,landing:0};
   const mute=THREE.MathUtils.clamp(film.muted?.[short]||0,0,1);
   member.body.position.y+=(ph.lift||0)+(ph.landing||0)*.055-mute*.16;member.body.rotation.z+=ph.tiltZ||0;member.body.rotation.x=ph.tiltX||0;
   const focusMix=soloId?(soloId===short?soloPower:0):0,otherMix=soloId&&soloId!==short?soloPower:0;
   const h=3.05*v.actorSize*(1+focusMix*.06);
   member.art.position.set(0,h*(member.pet.baseline-.5),0);member.art.scale.set(h*.8*sx,h*sy,1);
   member.art.rotation.y=Math.atan2(camera.position.x-member.group.position.x,camera.position.z-member.group.position.z)+THREE.MathUtils.degToRad(v.actorRotation)*.32;
   member.reflection.position.set(0,-h*(member.pet.baseline-.5)*.30,.012);member.reflection.scale.set(h*.8,-h*.30,1);member.reflection.rotation.y=member.art.rotation.y;
   member.frame=mute>.5?0:petFrameAt(frame.time,score?.bpmEstimate||120,sample.activity,{reduced:false,speed:v.instrumentMotion*(.6+v.instrumentSize*.5),index:i,attack:Math.max(sample.attack||0,downbeat*sample.activity*.65)});member.texture.offset.x=member.frame/4;
   const baseOpacity=settings.contrast?.92+sample.activity*.08:1;
   const lerp=THREE.MathUtils.lerp;
   let opacity=lerp(baseOpacity,1,focusMix),r=lerp(.94+sample.activity*.06,1,focusMix),g=lerp(.95+sample.activity*.05,1,focusMix),b=lerp(.98-lighting.climax*.025,1,focusMix);
   let reflection=.13+lighting.lift*.06+(lighting.flash||0)*.08+focusMix*.09+downbeat*.04;
   let ringOpacity=Math.min(.95,lerp(.14+sample.activity*.42+beatPulse*.14+downbeat*.12,.78+beatPulse*.2,focusMix));
   opacity=lerp(opacity,.74,otherMix);r=lerp(r,.58,otherMix);g=lerp(g,.62,otherMix);b=lerp(b,.72,otherMix);reflection=lerp(reflection,.06,otherMix);ringOpacity=lerp(ringOpacity,.07+sample.activity*.06,otherMix);
   opacity=lerp(opacity,.40,mute);r=lerp(r,.46,mute);g=lerp(g,.50,mute);b=lerp(b,.58,mute);reflection=lerp(reflection,.03,mute);ringOpacity=lerp(ringOpacity,.34,mute);
   member.art.material.opacity=opacity;member.art.material.color.setRGB(r,g,b);member.reflection.material.opacity=reflection;member.ring.material.opacity=ringOpacity;
   member.art.material.transparent=true;member.art.material.alphaTest=mute>.05?.02:.035;
   member.ring.scale.setScalar(v.actorSize*(1+sample.activity*.08+beatPulse*.04+focusMix*(.22+beatPulse*.10)));
   member.ring.scale.multiplyScalar(1+Math.max(0,ph.landing||0)*.15);
   const ring=member.ring.material.uniforms;ring.uActivity.value=Math.min(1,sample.activity+beatPulse*.18+focusMix*.3);ring.uSolo.value=focusMix;ring.uMuted.value=mute;ring.uTime.value=frame.time;
   member.label.position.set(0,h+.32+(ph.lift||0),.36);const labelPower=film.labels?.[short]||0;member.label.visible=labelPower>.01;member.label.material.opacity=labelPower;member.label.scale.set(2.45*(.92+.08*labelPower),.46*(.92+.08*labelPower),1);
   member.shadow.scale.setScalar(v.actorSize);member.shadow.material.opacity=lerp(.40+sample.activity*.09,.24,mute)*(1+focusMix*.45);
   const liftMix=(ph.lift||0)/.24;member.shadow.scale.multiplyScalar(1+liftMix*.14-mute*.05);member.shadow.material.opacity*=1-liftMix*.28;
   member.sample=sample;member.pose=pose;
  });
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  projectionVersion++;
  const occluders=wingState.power>.005?projectMembers().map(m=>m.bounds):[];
  members.forEach((m,i)=>{
   const short=m.role.id.split('/')[1],mute=film.muted?.[short]||0;
   const w=film.wingsFor?.[short]??1;
   const wState=mute<.5?{power:wingState.power*w,spread:wingState.spread,dissolve:wingState.dissolve||0}:{power:0};
   m.wings?.update({time:frame.time,state:wState,narrow,height:m.art.scale.y,body:m.body,art:m.art,shoulder:energyWingAttachment(m.role.id),occluders:occluders.filter((_,j)=>j!==i)});
  });
  lighting.wingPower=wingFocus;
  lighting.wingZones=members.filter(m=>m.wings?.mesh.visible).slice(0,2).map(m=>{
   const mesh=m.wings.mesh,points=[];mesh.updateWorldMatrix(true,false);
   for(const x of [-.78,.78])for(const y of [.08,.87])points.push(new THREE.Vector3(x,y,-.05).applyMatrix4(mesh.matrixWorld).project(camera));
   const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),bottom=Math.min(...points.map(p=>p.y)),top=Math.max(...points.map(p=>p.y));
   return {x:(left+right)/2,y:(bottom+top)/2,width:Math.max(.02,(right-left)/2),height:Math.max(.02,(top-bottom)/2)};
  });
  spots.forEach((spot,i)=>{spot.beam.scale.set(1,1,1);spot.halo.scale.setScalar(1);spot.beam.material.uniforms.uTime.value=frame.time;spot.beam.material.uniforms.uSolo.value=0;setSpot(spot,null,0,new THREE.Color('#ffe6c4'),i);});
  const soloIndex=soloId?members.findIndex(m=>m.role.id.endsWith('/'+soloId)):-1;
  members.forEach((m,i)=>{
   const short=m.role.id.split('/')[1],mute=film.muted?.[short]||0;
   if(i===soloIndex&&soloPower>.001)return;
   const p=(m.sample.activity*(m.sample.lead?1.25:.68)+downbeat*.15)*(1-mute)*(1-bed*.92)*(film.spotGain??1);
   setSpot(spots[i],m,p,new THREE.Color('#ffe4bd').lerp(new THREE.Color(m.role.accent),.24),i);
  });
  if(soloIndex>=0&&soloPower>.001){
   const m=members[soloIndex],sp=spots[soloIndex];
   setSpot(sp,m,(1.45+beatPulse*.28)*soloPower,new THREE.Color('#ffd998').lerp(new THREE.Color(m.role.accent||'#ffd28a'),.18),soloIndex);
   // The solo cone drops from directly above-front, like a follow-spot from the fly loft.
   sp.light.position.set(m.group.position.x*.55,11.5,m.group.position.z+3.2);
   const end=m.group.position.clone();end.y+=.02;const dir=sp.light.position.clone().sub(end),len=dir.length();
   sp.beam.position.copy(sp.light.position).add(end).multiplyScalar(.5);sp.beam.scale.set(1.55,len,1.55);sp.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
   sp.beam.material.uniforms.uOpacity.value=Math.min(.78,.32+soloPower*.46);sp.beam.material.uniforms.uSolo.value=soloPower;sp.halo.material.opacity=Math.min(.98,.68*soloPower*1.45);sp.halo.scale.setScalar(1.05+soloPower*.35);sp.beam.visible=true;
  }
  const leader=soloIndex>=0?soloIndex:Math.max(0,Math.min(members.length-1,frame.leadIndex??0)),lead=members[leader];
  if(soloIndex>=0){leadLight.position.set(lead.group.position.x*.55,11.5,lead.group.position.z+3.2);}else leadLight.position.copy(spots[0].light.position);
  leadLight.target.position.copy(lead.group.position).add(new THREE.Vector3(0,1,0));
  leadLight.intensity=soloIndex>=0?(95+beatPulse*22)*soloPower:(frame.leadIndex>=0&&!lead.sample.userMuted?lead.sample.activity*68+downbeat*15:0)*(1-bed);
  leadLight.angle=soloIndex>=0?.24:.35;leadLight.penumbra=.55;
  (film.ripples||[]).slice(0,4).forEach((rp,i)=>{const s=shocks[i];s.visible=rp.power>.001&&rp.age>=0;s.position.set(rp.x,stageHeightAt(rp.x,rp.z,narrow)+.07,rp.z);s.scale.setScalar(rp.size||4.2);
   const u=s.material.uniforms;u.uAge.value=rp.age;u.uPower.value=rp.power;u.uColor.value.set(rp.color||'#ffd28a');u.uRings.value=rp.rings||3;});
  for(let i=(film.ripples||[]).length;i<4;i++)shocks[i].visible=false;
  const s=stageSpec(narrow),rows=Array.from({length:s.levels},(_,level)=>{const row=members.filter(m=>Math.round((m.group.position.y-.395)/s.step)===level);return row.length?row.reduce((total,m)=>total+m.sample.activity,0)/row.length:0;});
  theatre.update(frame.time,fx,false,lighting,renderer.domElement.height,rows,settings.effects||'auto');
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
 return {renderer,camera,scene,theatre,members:()=>members,render,configure,update,resize,setActive,drawTo,setCaptureSize,endCapture,dispose,pickMember,startDrag,moveDrag,endDrag,resetPositions,canvas:renderer.domElement,get narrow(){return narrow;},get captureActive(){return !!captureSize;},get formation(){return currentFormation();},get spatial(){return currentSpatial();},get dragging(){return drag?.id||null;},get memberProjections(){return projectMembers();},get diagnostics(){const spatial=currentSpatial(),projected=projectMembers();return {active,theme,narrow,captureSize,formation:currentFormation(),stage:theatre.diagnostics,glow:{strength:glow.strength},petCount:members.length,prewarm:{started:prewarmStarted,busy:prewarmBusy,pending:prewarmQueue.length,loaded:prewarmLoaded,failed:[...prewarmFailures]},wings:{...particleWingState(last?.options.score,last?.frame.time||0,{mode:last?.options.settings.effects,reduced:last?.options.reduced}),members:members.filter(m=>m.wings).map(m=>({id:m.role.id,...m.wings.diagnostics}))},placements:Object.fromEntries(placements),dragging:drag?.id||null,spatial,
  cueSource:last?.options.score?.stageCues?.source||'demo',chorusCandidates:last?.options.score?.stageCues?.choruses||[],camera:{position:camera.position.toArray(),fov:camera.fov,aspect:camera.aspect,...lastCameraFit},propsBounds:theatre.projectProps(camera),fullFrame:frameStats,beams:spots.map(s=>s.beam.visible?s.beam.material.uniforms.uOpacity.value:0),members:members.map((m,i)=>({...projected[i],actorRotation:m.art.rotation.toArray().slice(0,3),instrumentRotation:m.body.rotation.toArray().slice(0,3),actorScale:m.art.scale.toArray(),instrumentScale:m.body.scale.toArray(),actorFade:m.art.material.opacity,ringOpacity:m.ring.material.opacity,ringShader:{activity:m.ring.material.uniforms.uActivity.value,solo:m.ring.material.uniforms.uSolo.value,muted:m.ring.material.uniforms.uMuted.value},labelSize:[m.labelTexture.image.width,m.labelTexture.image.height],dragPhysics:{...physicsFor(m.role.id)}
  })),lights:spots.map(s=>s.light.intensity),drawCalls:renderer.info.render.calls};}};
}
