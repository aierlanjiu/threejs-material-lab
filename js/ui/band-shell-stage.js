import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/GLTFLoader.js/+esm';
import {Water} from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/objects/Water.js/+esm';

// Uses the delivered meshes and authored anchors; live slots stay on real decks.
export async function createShellConcertStage(scene,renderer){
 const base=new URL('../../assets/models/band-shell-concert/',import.meta.url),response=await fetch(new URL('manifest.json',base));
 if(!response.ok)throw Error('珍珠贝壳舞台清单无法读取');const manifest=await response.json();
 const root=new THREE.Group();root.name='delivered-shell-performance';root.visible=false;scene.add(root);
 const loader=new GLTFLoader();
 async function readModel(file){const res=await fetch(new URL(file,base),{signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error(`珍珠贝壳资产 ${res.status}`);const bytes=await res.arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==manifest.sha256[file])throw Error('珍珠贝壳模型摘要不一致');return (await loader.parseAsync(bytes,'')).scene;}
 const [model,landscape]=await Promise.all([readModel(manifest.model),readModel(manifest.environmentModel)]);
 root.add(model,landscape);model.name='delivered-shell-concert';landscape.name='delivered-lagoon-environment';
 for(const group of [model,landscape])group.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.envMapIntensity=.8;});
 const sky=await new THREE.TextureLoader().loadAsync(new URL('sunset-sky.png',base).href);sky.colorSpace=THREE.SRGBColorSpace;
 const cube=new THREE.WebGLCubeRenderTarget(innerWidth<600?256:512,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});cube.fromEquirectangularTexture(renderer,sky);
 const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromCubemap(cube.texture);pmrem.dispose();
 const oldEnvironment=scene.environment,oldBackground=scene.background,oldFog=scene.fog,oldRotation=scene.backgroundRotation.clone();
 const ambient=new THREE.HemisphereLight('#fff0d9','#697179',1.35);root.add(ambient);
 const key=new THREE.DirectionalLight('#ffe0bd',2.3);key.position.set(-6,10,9);key.castShadow=true;key.shadow.mapSize.set(innerWidth<600?1024:2048,innerWidth<600?1024:2048);Object.assign(key.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:.5,far:55});key.shadow.normalBias=.035;key.shadow.bias=-.0002;root.add(key);
 const rim=new THREE.DirectionalLight('#ffd6a2',5.1);rim.position.set(-5,9,-10);root.add(rim);
 const mother=new THREE.PointLight('#ffd6a1',4,8,2);mother.position.set(0,2.20,-3.2);root.add(mother);
 const lamps=[];for(let i=0;i<8;i++){const globe=model.getObjectByName(`Pendant_${String(i).padStart(2,'0')}_opal_globe`),lamp=new THREE.PointLight('#ffe0ad',3.2,8,2);if(!globe)throw Error('珍珠吊灯节点缺失');globe.getWorldPosition(lamp.position);root.add(lamp);lamps.push(lamp);}
 const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=256;const ctx=normalCanvas.getContext('2d'),pixels=ctx.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const a=x*Math.PI*2/256,b=y*Math.PI*2/256,nx=.26*Math.cos(3*a+2*b)+.14*Math.cos(7*a-5*b),ny=.23*Math.sin(2*a-4*b)+.13*Math.sin(5*a+9*b),inv=1/Math.hypot(nx,ny,1),i=(y*256+x)*4;pixels.data[i]=128+127*nx*inv;pixels.data[i+1]=128+127*ny*inv;pixels.data[i+2]=128+127*inv;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
 const normals=new THREE.CanvasTexture(normalCanvas);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;
 const water=new Water(new THREE.PlaneGeometry(1200,1200),{textureWidth:innerWidth<600?256:512,textureHeight:innerWidth<600?256:512,waterNormals:normals,sunDirection:new THREE.Vector3(-.5,.09,-.86).normalize(),sunColor:0xffc58c,waterColor:0x4a9b96,distortionScale:1.1,alpha:1,fog:true});water.rotation.x=-Math.PI/2;water.position.y=-.035;root.add(water);
 const walkable=[];for(const name of ['01_Lagoon_foundation','02_Lower_ensemble_deck','03_Middle_ensemble_deck','04_Back_ensemble_deck','05_Solo_bridge','06_Foreground_solo_island'])model.getObjectByName(name)?.traverse(o=>{if(o.isMesh)walkable.push(o);});
 if(!walkable.length)throw Error('珍珠贝壳演员支撑面缺失');
 const bounds=new THREE.Box3().setFromObject(model),corners=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new THREE.Vector3(x,y,z));
 const rowOrder=['robin','sanji','zoro','usopp','ace','law','nami','chopper','shanks'];
 // Bring the centre player in front of the mother pearl's full radius.
 const floorRay=new THREE.Raycaster(),slots=rowOrder.map((id,i)=>{const x=(i-4)*1.6,z=id==='ace'?-.8:-2.8+Math.abs(i-4)*.675;floorRay.set(new THREE.Vector3(x,15,z),new THREE.Vector3(0,-1,0));model.updateWorldMatrix(true,true);const hit=floorRay.intersectObjects(walkable,false).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.7);if(!hit)throw Error(`演员支撑面缺失: ${id}`);return {id:`one-piece/${id}`,position:[x,hit.point.y,z]};});
 let active=false,lastFit=null;
 const anchorFor=(id,index=0)=>manifest.actorAnchors.find(a=>a.id===id)||manifest.actorAnchors[index%manifest.actorAnchors.length];
 return {
  setActive(value){if(active===value)return;active=value;root.visible=value;if(value){scene.background=cube.texture;scene.environment=environment.texture;scene.backgroundRotation.y=Math.PI/2;scene.fog=new THREE.FogExp2('#b79daa',.0035);}else{scene.background=oldBackground;scene.environment=oldEnvironment;scene.backgroundRotation.copy(oldRotation);scene.fog=oldFog;}},
  anchorFor,
  supportAt(x,z){floorRay.set(new THREE.Vector3(x,15,z),new THREE.Vector3(0,-1,0));return floorRay.intersectObjects(walkable,false).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.7)?.point||null;},
  layout(roles,formation,leadIndex,original){const points=roles.map((r,i)=>i===0?anchorFor('one-piece/luffy').position.slice():(slots.find(s=>s.id===r.id)||slots[i-1]).position.slice());if(formation==='solo'&&leadIndex>0)[points[0],points[leadIndex]]=[points[leadIndex],points[0]];
   else if(['arc','ring','wings'].includes(formation)&&original){const remaining=new Set(points.map((_,i)=>i));return original.map(p=>{let best=-1,cost=Infinity;for(const i of remaining){const q=points[i],v=(q[0]/5.5-p[0]/10.5)**2+((q[2]+2.5)/6.7-(p[2]+3.7)/11.8)**2;if(v<cost){cost=v;best=i;}}remaining.delete(best);return points[best].slice();});}return points;},
  pickFloor(raycaster){model.updateWorldMatrix(true,true);return raycaster.intersectObjects(walkable,false).find(hit=>hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y>.7)?.point||null;},
  fitCamera(camera,{w,h,top=85,bottom=130,focus=null,pose=null}={}){
   camera.fov=38;camera.far=700;const direction=new THREE.Vector3(.25,6.0,30.2).normalize(),target=new THREE.Vector3(0,4.1,-.7),up=new THREE.Vector3(0,direction.z,-direction.y).normalize();
   const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),available=Math.max(.3,(h-top-bottom)/h);
   let distance=Math.max(...corners.map(p=>{const v=p.clone().sub(target);return v.dot(direction)+Math.max(Math.abs(v.x)/(tan*camera.aspect*.91),Math.abs(v.dot(up))/(tan*available*.91));}));
   if(focus&&pose?.focusMix){target.lerp(focus,pose.focusMix);distance/=pose.zoom||1;}
   camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);camera.setViewOffset(w,h,0,-(top-bottom)/2,w,h);camera.updateProjectionMatrix();camera.updateMatrixWorld();
   const projected=corners.map(p=>p.clone().project(camera));lastFit={distance,bounds:{left:Math.min(...projected.map(p=>p.x)),right:Math.max(...projected.map(p=>p.x)),bottom:Math.min(...projected.map(p=>p.y)),top:Math.max(...projected.map(p=>p.y))}};
  },
  update(time,beat=0,reduced=false){water.material.uniforms.time.value=reduced?0:time;rim.intensity=5.1+(reduced?0:beat*.25);lamps.forEach(l=>l.intensity=3.2+(reduced?0:beat*.15));},
  get diagnostics(){return {ready:true,active,asset:manifest.model,sha256:manifest.sha256[manifest.model],environmentAsset:manifest.environmentModel,anchors:manifest.actorAnchors.length,walkableMeshes:walkable.length,levels:6,camera:lastFit};},
  dispose(){root.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();o.shadow?.map?.dispose();});water.getRenderTarget?.()?.dispose();normals.dispose();environment.dispose();cube.dispose();sky.dispose();scene.remove(root);}
 };
}
