import { instrumentsForTheme, instrumentById } from '../avatar/instrument-manifest.js';
import { drawScore } from './score-panel.js';
const themes={
  'one-piece':{label:'海贼王',accent:'#c97c64',wallpaper:'op_luffy_kaido'},
  'dragon-ball':{label:'龙珠',accent:'#8dad8e',wallpaper:'db_goku_vegeta'},
  naruto:{label:'火影忍者',accent:'#a393c0',wallpaper:'naruto_naruto_sasuke'}
};
const container=document.querySelector('#studyScene'), grid=document.querySelector('#studyAssetGrid');
const mobile=matchMedia('(max-width:600px)'), reduced=matchMedia('(prefers-reduced-motion:reduce)');
let theme=new URLSearchParams(location.search).get('theme') || 'one-piece';if(!themes[theme])theme='one-piece';
let previewMode=new URLSearchParams(location.search).get('mode')==='gravity'?'gravity':'mechanical';
let selected=instrumentsForTheme(theme)[0].id, view=null,revision=0;
function renderUI(){
  const roles=instrumentsForTheme(theme),item=instrumentById(selected);
  document.body.style.setProperty('--study-accent',themes[theme].accent);
  const wallpaper=new URL(`../../images/wallpapers/${themes[theme].wallpaper}${mobile.matches?'':'_wide'}.jpg`,import.meta.url).href;
  document.body.style.setProperty('--study-wallpaper',`url('${wallpaper}')`);
  document.querySelectorAll('.study-themes button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===theme)));
  document.querySelectorAll('.study-layouts button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===previewMode)));
  document.querySelector('.study-stage').dataset.mode=previewMode;
  document.querySelector('#studyScaleCaption').textContent=previewMode==='gravity'?'乐器设计预览 · 表情与乐器 1∶1 等大晶体':'乐器设计预览 · 主晶体与 40% 伴生晶体';
  document.querySelector('#studyCount').textContent=`${themes[theme].label} · ${roles.length} 位角色`;
  grid.replaceChildren(...roles.map(role=>{
    const button=document.createElement('button');button.type='button';button.className='study-asset-card';button.dataset.role=role.id;
    button.setAttribute('aria-pressed',String(role.id===selected));button.setAttribute('aria-label',`${role.name} · ${role.instrument}`);
    const art=document.createElement('div');art.className='study-card-art';
    const face=new Image();face.src=`./assets/live-avatars/${role.id}/still.png`;face.alt='';
    const instrument=new Image();instrument.src=role.asset;instrument.alt=role.instrument;art.append(face,instrument);
    const name=document.createElement('strong');name.textContent=role.name;
    const title=document.createElement('span');title.textContent=role.instrument;
    const motif=document.createElement('small');motif.textContent=role.motif;
    button.append(art,name,title,motif);return button;
  }));
  document.querySelector('#studyScoreTitle').textContent=`${item.name} · 乐谱排版`;
  drawScore(document.querySelector('#studyScoreCanvas'),{family:item.family,demo:true,accent:item.accent});
}
function displayedRoles(){
  const roles=instrumentsForTheme(theme),defaults=roles.slice(0,4);
  if(mobile.matches)return [instrumentById(selected)];
  return defaults.some(item=>item.id===selected)?defaults:[instrumentById(selected),...defaults.slice(0,3)];
}
async function rebuild(){
  renderUI();const token=++revision,roles=displayedRoles();
  const labels=document.querySelector('#studyPairLabels');labels.replaceChildren(...roles.map(role=>{const node=document.createElement('div');const name=document.createElement('strong');name.textContent=role.name;const instrument=document.createElement('span');instrument.textContent=role.instrument;node.append(name,instrument);return node;}));
  if(!view)return;
  await view.setRoles(roles,token,()=>revision);view.resize();
}
const updateURL=()=>history.replaceState(null,'',`?theme=${theme}&mode=${previewMode}`);
document.querySelector('.study-themes').addEventListener('click',event=>{const button=event.target.closest('button[data-theme]');if(!button)return;theme=button.dataset.theme;selected=instrumentsForTheme(theme)[0].id;updateURL();rebuild();});
document.querySelector('.study-layouts').addEventListener('click',event=>{const button=event.target.closest('button[data-mode]');if(!button)return;previewMode=button.dataset.mode;updateURL();rebuild();});
grid.addEventListener('click',event=>{const button=event.target.closest('button[data-role]');if(!button)return;selected=button.dataset.role;rebuild();});
mobile.addEventListener('change',()=>rebuild());
renderUI();

async function createPreview(){
  const base='https://cdn.jsdelivr.net/npm/three@0.166.1';
  const [THREE,{RoundedBoxGeometry},{RoomEnvironment},{renderLiveAvatar}]=await Promise.all([
    import(`${base}/+esm`),import(`${base}/examples/jsm/geometries/RoundedBoxGeometry.js/+esm`),
    import(`${base}/examples/jsm/environments/RoomEnvironment.js/+esm`),import('../avatar/live.js')
  ]);
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'default'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;container.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.1,80);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room);
  scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0x434353,2));
  const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(-3,6,8);scene.add(light);
  const geometry=new RoundedBoxGeometry(1.4,1.4,1.4,4,.075),faceGeometry=new THREE.PlaneGeometry(1.26,1.26);
  const rim=new THREE.Path(),half=.694,radius=.075;
  rim.moveTo(-half+radius,-half);rim.lineTo(half-radius,-half);rim.quadraticCurveTo(half,-half,half,-half+radius);
  rim.lineTo(half,half-radius);rim.quadraticCurveTo(half,half,half-radius,half);
  rim.lineTo(-half+radius,half);rim.quadraticCurveTo(-half,half,-half,half-radius);
  rim.lineTo(-half,-half+radius);rim.quadraticCurveTo(-half,-half,-half+radius,-half);
  const rimGeometry=new THREE.BufferGeometry().setFromPoints(rim.getPoints(56).map(point=>new THREE.Vector3(point.x,point.y,0)));
  function addRim(group){for(const z of [.705,-.705]){const edge=new THREE.LineLoop(rimGeometry,new THREE.LineBasicMaterial({color:'#ede2cf',transparent:true,opacity:z>0?.44:.15,depthWrite:false}));edge.position.z=z;group.add(edge);}}
  const loader=new THREE.TextureLoader(),assetCache=new Map();
  let pairs=[],running=false,lastFrame=0,frameId,disposed=false;
  const textureFor=asset=>{if(!assetCache.has(asset))assetCache.set(asset,loader.loadAsync(asset).then(texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;return texture;}));return assetCache.get(asset);};
  function releasePairs(){for(const pair of pairs){scene.remove(pair.group);pair.group.traverse(object=>{if(object.material){if(object.userData.ownGeometry)object.geometry.dispose();object.material.dispose();}});pair.texture.dispose();}pairs=[];}
  function renderOnce(){if(!disposed)renderer.render(scene,camera);}
  function animate(time){if(!running||disposed)return;frameId=requestAnimationFrame(animate);if(time-lastFrame<80)return;lastFrame=time;
    for(const pair of pairs){pair.group.position.y=Math.sin(time/1700+pair.index*.6)*.018;if(!pair.pending){pair.pending=true;renderLiveAvatar(pair.role.id,pair.canvas,time/1000,'calm',{reduced:reduced.matches}).then(changed=>{if(changed)pair.texture.needsUpdate=true;}).catch(()=>{}).finally(()=>{pair.pending=false;});}}
    renderOnce();
  }
  function setRunning(){running=!document.hidden&&!reduced.matches;cancelAnimationFrame(frameId);if(running)frameId=requestAnimationFrame(animate);else renderOnce();}
  function resize(){const width=container.clientWidth,height=container.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);
    const gravity=previewMode==='gravity';
    const visibleHeight=mobile.matches?(gravity?3.65:3.45):Math.max(3.6,(gravity?15.4:11.6)/camera.aspect),distance=visibleHeight/2/Math.tan(THREE.MathUtils.degToRad(15));
    camera.position.set(0,distance*.08,distance);camera.lookAt(0,-.05,0);camera.updateProjectionMatrix();renderOnce();}
  async function setRoles(roles,token,current){
    const textures=await Promise.all(roles.map(role=>textureFor(role.asset)));
    const canvases=await Promise.all(roles.map(async role=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;await renderLiveAvatar(role.id,canvas,0,'calm',{reduced:false});return canvas;}));
    if(disposed||token!==current())return;
    releasePairs();
    pairs=roles.map((role,index)=>{
      const gravity=previewMode==='gravity',group=new THREE.Group();
      group.position.x=mobile.matches?(gravity?-.784:-.32):(index-1.5)*(gravity?3.6:2.75)-(gravity?.784:0);
      group.rotation.y=gravity?-.06:-.14;scene.add(group);
      const material=new THREE.MeshPhysicalMaterial({color:new THREE.Color(role.accent).lerp(new THREE.Color('#e1dee3'),.78),metalness:0,roughness:.1,transmission:.82,thickness:.45,ior:1.46,transparent:true,opacity:.48,envMapIntensity:1.1,depthWrite:false});
      group.add(new THREE.Mesh(geometry,material));
      addRim(group);
      const canvas=canvases[index],texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const face=new THREE.Mesh(faceGeometry,new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));face.position.z=.715;face.renderOrder=2;group.add(face);
      const companion=new THREE.Group();
      if(gravity){companion.position.set(1.12*1.4,0,0);companion.scale.setScalar(1);}
      else{companion.position.set(.63*1.4,-.34*1.4,.25*1.4);companion.scale.setScalar(.4);}
      group.add(companion);
      companion.add(new THREE.Mesh(geometry,material.clone()));
      addRim(companion);
      const decal=new THREE.Mesh(new THREE.PlaneGeometry(1.58,1.58),new THREE.MeshBasicMaterial({map:textures[index],transparent:true,depthWrite:false,toneMapped:false}));decal.userData.ownGeometry=true;decal.position.z=.715;decal.renderOrder=3;companion.add(decal);
      return {group,role,index,canvas,texture,pending:false,companion};
    });resize();setRunning();
  }
  const observer=new ResizeObserver(resize);observer.observe(container);document.addEventListener('visibilitychange',setRunning);reduced.addEventListener('change',setRunning);
  function dispose(){disposed=true;cancelAnimationFrame(frameId);observer.disconnect();document.removeEventListener('visibilitychange',setRunning);reduced.removeEventListener('change',setRunning);releasePairs();geometry.dispose();faceGeometry.dispose();rimGeometry.dispose();for(const pending of assetCache.values())pending.then(texture=>texture.dispose());env.dispose();renderer.dispose();}
  window.addEventListener('pagehide',dispose,{once:true});
  return {setRoles,resize,get diagnostics(){return {mode:previewMode,pairs:pairs.map(pair=>({id:pair.role.id,companionScale:pair.companion.scale.x})),reduced:reduced.matches};}};
}
try{view=await createPreview();window.luInstrumentStudy=view;await rebuild();}
catch(error){console.error('Instrument preview unavailable:',error);document.querySelector('#studyFallback').hidden=false;}
