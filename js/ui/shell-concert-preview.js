// Standalone review surface. The embedded GLB is exactly the delivered mesh.
const host = document.getElementById('stage');
const status = document.getElementById('status');
const source = JSON.parse(document.getElementById('shell-data').textContent);
host.style.background = "#dfb2a0";
let renderer, controls, disposed = false;

try {
  const THREE = await import('three');
  const [{GLTFLoader}, {OrbitControls}, {Water}, {Reflector}, {RectAreaLightUniformsLib}, {EffectComposer}, {RenderPass}, {ShaderPass}, {UnrealBloomPass}, {OutputPass}] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/objects/Water.js'),
    import('three/addons/objects/Reflector.js'),
    import('three/addons/lights/RectAreaLightUniformsLib.js'),
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/ShaderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
  ]);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 700);
  renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0, 0);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '拖动旋转舞台，滚轮缩放；方向键旋转，加减号缩放，Home 恢复正面');
  host.append(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 14;
  controls.maxDistance = 220;
  controls.minPolarAngle = .35;
  controls.maxPolarAngle = Math.PI * .49;
  controls.target.set(0, 4.1, -.7);

  const skyTexture=await new THREE.TextureLoader().loadAsync(source.sky);
  skyTexture.colorSpace=THREE.SRGBColorSpace;
  skyTexture.mapping=THREE.EquirectangularReflectionMapping;
  // Use a power-of-two cube instead of the automatic 887px sky conversion.
  const skyCube=new THREE.WebGLCubeRenderTarget(512,{type:THREE.HalfFloatType,
    generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  skyCube.fromEquirectangularTexture(renderer,skyTexture);
  scene.background=skyCube.texture;
  scene.backgroundRotation.y=Math.PI/2;
  scene.fog=new THREE.FogExp2('#b79daa',.0035);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromCubemap(skyCube.texture);
  scene.environment=environment.texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fff0d9', '#697179', 1.35));
  const key = new THREE.DirectionalLight('#ffe0bd', 2.3);
  key.position.set(-6, 10, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left:-15,right:15,top:15,bottom:-15,near:.5,far:55});
  key.shadow.normalBias=.035;
  key.shadow.bias=-.0002;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffd6a2', 5.1);
  rim.position.set(-5, 9, -10);
  scene.add(rim);
  const composerTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
  composerTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const composer = new EffectComposer(renderer,composerTarget);
  // r166 clones the depth texture while sharing its Source. Give the second
  // framebuffer its own storage, so reading depth cannot sample an attachment
  // of the framebuffer currently receiving the full-screen colour pass.
  composer.renderTarget2.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  composer.addPass(new RenderPass(scene,camera));
  // Use the colour pass's real depth, including sprite alpha tests. A generic
  // override depth material would incorrectly blur whole rectangular cards.
  const dof=new ShaderPass({
    uniforms:{tDiffuse:{value:null},tDepth:{value:null},texel:{value:new THREE.Vector2(1,1)},
      focus:{value:22},nearClip:{value:camera.near},farClip:{value:camera.far}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse,tDepth;uniform vec2 texel;
      uniform float focus,nearClip,farClip;varying vec2 vUv;
      void main(){float d=texture2D(tDepth,vUv).r;
        float z=nearClip*farClip/(farClip-(farClip-nearClip)*d);
        float coc=max(smoothstep(4.,12.,focus-z),.55*smoothstep(45.,130.,z-focus));
        vec2 r=texel*1.8*coc;vec4 c=texture2D(tDiffuse,vUv)*.24;
        c+=(texture2D(tDiffuse,vUv+vec2(r.x,0.))+texture2D(tDiffuse,vUv-vec2(r.x,0.))
          +texture2D(tDiffuse,vUv+vec2(0.,r.y))+texture2D(tDiffuse,vUv-vec2(0.,r.y)))*.12;
        c+=(texture2D(tDiffuse,vUv+r)+texture2D(tDiffuse,vUv-r)
          +texture2D(tDiffuse,vUv+vec2(r.x,-r.y))+texture2D(tDiffuse,vUv+vec2(-r.x,r.y)))*.07;
        gl_FragColor=c;}`,
  });
  dof.material.depthTest=false;dof.material.depthWrite=false;
  composer.addPass(dof);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1,1),.22,.48,1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const bytes = Uint8Array.from(atob(source.model), c => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  const stage = gltf.scene;
  stage.name = 'delivered-shell-concert';
  scene.add(stage);
  stage.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.envMapIntensity = .8;
    }
  });

  const landscapeBytes=Uint8Array.from(atob(source.environment),c=>c.charCodeAt(0));
  const landscape=(await new GLTFLoader().parseAsync(landscapeBytes.buffer,'')).scene;
  landscape.name='delivered-lagoon-environment';
  scene.add(landscape);
  const mother=new THREE.PointLight('#ffd6a1',4,8,2);
  mother.position.set(0,2.20,-3.2);
  scene.add(mother);
  for(let i=0;i<8;i++){
    const globe=stage.getObjectByName(`Pendant_${String(i).padStart(2,'0')}_opal_globe`);
    const lamp=new THREE.PointLight('#ffe0ad',3.2,8,2);
    globe.getWorldPosition(lamp.position);
    scene.add(lamp);
  }
  for(let i=0;i<24;i+=3){
    const pearl=landscape.getObjectByName(`Lagoon_floating_pearl_${String(i).padStart(2,'0')}`);
    const lamp=new THREE.PointLight('#ffe0ad',.9,2.5,2);
    pearl.getWorldPosition(lamp.position);lamp.position.z+=.22;scene.add(lamp);
  }
  RectAreaLightUniformsLib.init();
  const overlapFill=new THREE.RectAreaLight('#eaf2df',.65,4,3);
  overlapFill.position.set(0,4.8,-1.0);overlapFill.lookAt(0,4.8,-4.0);scene.add(overlapFill);
  for(const [cy,rx,ry,top] of [[.25,7.6,4.45,.43],[.95,6.8,3.35,.83],[1.60,5.9,2.82,1.22],[2.30,5.0,2.20,1.60]]){
    for(const a of [-.55,0,.55]){
      const x=rx*Math.sin(a),y=cy-ry*Math.cos(a);
      const lamp=new THREE.RectAreaLight('#ffd6a2',3.5,2.5,.10);
      lamp.position.set(x,top-.09,-y-.06);lamp.lookAt(x,top-.36,-y+.55);scene.add(lamp);
    }
  }
  // Tileable analytic ripples feed Three.js's reflective Water implementation.
  const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=256;
  const context=normalCanvas.getContext('2d');const normalPixels=context.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const a=x*Math.PI*2/256,b=y*Math.PI*2/256;
    const nx=.26*Math.cos(3*a+2*b)+.14*Math.cos(7*a-5*b);
    const ny=.23*Math.sin(2*a-4*b)+.13*Math.sin(5*a+9*b);
    const inv=1/Math.hypot(nx,ny,1),i=(y*256+x)*4;
    normalPixels.data[i]=128+127*nx*inv;normalPixels.data[i+1]=128+127*ny*inv;
    normalPixels.data[i+2]=128+127*inv;normalPixels.data[i+3]=255;
  }
  context.putImageData(normalPixels,0,0);
  const normals=new THREE.CanvasTexture(normalCanvas);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;
  const water=new Water(new THREE.PlaneGeometry(1200,1200),{
    textureWidth:512,textureHeight:512,waterNormals:normals,
    sunDirection:new THREE.Vector3(-.5,.09,-.86).normalize(),sunColor:0xffc58c,
    waterColor:0x4a9b96,distortionScale:1.1,alpha:1,fog:true,
  });
  water.rotation.x=-Math.PI/2;water.position.y=-.035;scene.add(water);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(65,65),new THREE.ShadowMaterial({opacity:.12}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-.015;shadow.receiveShadow=true;scene.add(shadow);

  // Real planar captures add the nearby cast and lamps to the marble; an
  // environment map alone cannot contain these scene-local reflections.
  const marbleMirrors=[];
  const mirrorShader={...Reflector.ReflectorShader,fragmentShader:`
    uniform sampler2D tDiffuse;varying vec4 vUv;
    void main(){gl_FragColor=vec4(texture2DProj(tDiffuse,vUv).rgb,.52);}`};
  let reflectionBusy=false;
  for(const name of ['01_Lagoon_foundation','02_Lower_ensemble_deck','03_Middle_ensemble_deck','04_Back_ensemble_deck','05_Solo_bridge','06_Foreground_solo_island']){
    const supportSurface=stage.getObjectByName(name);
    const bounds=new THREE.Box3().setFromObject(supportSurface);
    const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const resolution=innerWidth<600?256:512;
    const mirror=new Reflector(new THREE.CircleGeometry(1,96),{
      shader:mirrorShader,textureWidth:resolution,textureHeight:resolution,multisample:0,clipBias:0});
    mirror.name='MarbleReflection_'+name;mirror.rotation.x=-Math.PI/2;
    mirror.scale.set(size.x*.5-.06,size.z*.5-.06,1);
    mirror.position.set(center.x,bounds.max.y+.002,center.z);
    mirror.material.transparent=true;mirror.material.depthWrite=false;mirror.material.toneMapped=false;
    const capture=mirror.onBeforeRender;
    mirror.onBeforeRender=function(renderer,scene,camera){
      if(reflectionBusy)return;
      reflectionBusy=true;
      const visibility=marbleMirrors.map(m=>m.visible),waterVisible=water.visible,supportVisible=supportSurface.visible;
      try{
        for(const m of marbleMirrors)m.visible=false;
        water.visible=false;
        supportSurface.visible=false;
        capture.call(this,renderer,scene,camera);
      }finally{
        marbleMirrors.forEach((m,i)=>{m.visible=visibility[i];});
        supportSurface.visible=supportVisible;
        water.visible=waterVisible;reflectionBusy=false;
      }
    };
    marbleMirrors.push(mirror);scene.add(mirror);
  }

  const cast = new THREE.Group();
  cast.name = 'existing-cast-scale-preview';
  scene.add(cast);
  const textureLoader = new THREE.TextureLoader();
  const footprints=new THREE.Group();footprints.name='cast-contact-footprints';scene.add(footprints);
  const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;
  const contactContext=contactCanvas.getContext('2d');
  const gradient=contactContext.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(36,30,26,.70)');
  gradient.addColorStop(.45,'rgba(36,30,26,.30)');
  gradient.addColorStop(1,'rgba(36,30,26,0)');
  contactContext.fillStyle=gradient;contactContext.fillRect(0,0,128,128);
  const contactTexture=new THREE.CanvasTexture(contactCanvas);contactTexture.colorSpace=THREE.SRGBColorSpace;
  await Promise.all(source.anchors.map(async anchor => {
    const texture = await textureLoader.loadAsync(source.cast[anchor.id]);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.repeat.x = .25;
    texture.offset.x = (anchor.frame ?? 2) / 4;
    const aspect = texture.image.width / 4 / texture.image.height;
    const width = anchor.height * aspect;
    const material = new THREE.MeshStandardMaterial({map:texture,color:'#fff0e1',
      emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.10,
      roughness:.58,metalness:0,envMapIntensity:.35,alphaTest:.08,side:THREE.DoubleSide});
    const actor = new THREE.Mesh(new THREE.PlaneGeometry(width, anchor.height), material);
    actor.name = anchor.id;
    actor.position.fromArray(anchor.position);
    // Measured alpha baseline: 19px, or 20px for Chopper, in the 320px sheet.
    const footMargin=(anchor.id.endsWith('/chopper')?20:19)/320;
    actor.position.y += anchor.height*(.5-footMargin)-.018;
    actor.userData.anchor = anchor.position;
    actor.castShadow=true;actor.receiveShadow=true;
    cast.add(actor);
    const foot=new THREE.Mesh(new THREE.PlaneGeometry(width*.76,.40),
      new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,polygonOffset:true,
        polygonOffsetFactor:-1,toneMapped:false}));
    foot.name='Contact_'+anchor.id;foot.rotation.x=-Math.PI/2;
    foot.renderOrder=2; // Keep the contact above the translucent marble reflection.
    foot.position.fromArray(anchor.position);foot.position.y-=.018;
    footprints.add(foot);
  }));

  const views = {
    front: new THREE.Vector3(1.0, 6.8, 29.5),
    side: new THREE.Vector3(24, 11, 18),
    back: new THREE.Vector3(0, 10, -27),
  };
  let selectedView = 'front';
  function preset(id) {
    selectedView = id;
    const position = views[id];
    const multiplier = Math.max(1, .98 / camera.aspect);
    camera.position.copy(controls.target).add(position.clone().sub(controls.target).multiplyScalar(multiplier));
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    // Fit the delivered stage in every aspect ratio, including the wider fan.
    const bounds=new THREE.Box3().setFromObject(stage);
    for(let iteration=0;iteration<5;iteration++){
      let required=1;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        const point=new THREE.Vector3(x,y,z).project(camera);
        required=Math.max(required,Math.abs(point.x)/.91,Math.abs(point.y)/.84);
      }
      if(required<=1.005)break;
      camera.position.sub(controls.target).multiplyScalar(required*1.015).add(controls.target);
      camera.lookAt(controls.target);camera.updateMatrixWorld();
    }
    controls.update();
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === id));
    draw();
  }
  function draw() {
    if (disposed) return;
    for (const actor of cast.children) {
      actor.rotation.y = Math.atan2(camera.position.x - actor.position.x, camera.position.z - actor.position.z);
    }
    const focusPoint=new THREE.Vector3(0,1.5,4.15).applyMatrix4(camera.matrixWorldInverse);
    dof.uniforms.focus.value=-focusPoint.z;
    dof.uniforms.tDepth.value=composer.readBuffer.depthTexture;
    composer.render();
  }
  function resize() {
    renderer.setSize(host.clientWidth, host.clientHeight);
    composer.setSize(host.clientWidth, host.clientHeight);
    dof.uniforms.texel.value.set(1/(host.clientWidth*renderer.getPixelRatio()),1/(host.clientHeight*renderer.getPixelRatio()));
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    if (selectedView) preset(selectedView); else draw();
  }
  controls.addEventListener('change', draw);
  controls.addEventListener('start', () => {
    selectedView = null;
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', 'false');
  });
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => preset(button.dataset.view));
  document.getElementById('castToggle').addEventListener('click', event => {
    cast.visible = !cast.visible;
    footprints.visible=cast.visible;
    event.currentTarget.setAttribute('aria-pressed', String(cast.visible));
    draw();
  });
  const fullScreen = document.getElementById('fullScreen');
  if (!document.fullscreenEnabled) fullScreen.hidden = true;
  fullScreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      status.textContent = '当前浏览器不支持全屏，可使用窗口最大化查看。';
    }
  });
  renderer.domElement.addEventListener('keydown', event => {
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'Home') { event.preventDefault(); preset('front'); return; }
    if (event.key === 'ArrowLeft') spherical.theta -= .12;
    else if (event.key === 'ArrowRight') spherical.theta += .12;
    else if (event.key === 'ArrowUp') spherical.phi = Math.max(controls.minPolarAngle, spherical.phi - .08);
    else if (event.key === 'ArrowDown') spherical.phi = Math.min(controls.maxPolarAngle, spherical.phi + .08);
    else if (event.key === '+' || event.key === '=') spherical.radius = Math.max(controls.minDistance, spherical.radius / 1.12);
    else if (event.key === '-') spherical.radius = Math.min(controls.maxDistance, spherical.radius * 1.12);
    else return;
    event.preventDefault();
    selectedView = null;
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', 'false');
    draw();
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    status.classList.add('error');
    status.textContent = '三维画面已暂停，请刷新页面重新载入。';
  });
  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', () => {
    disposed = true;
    controls.dispose();
    scene.traverse(object => {
      object.geometry?.dispose();
      for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        material.map?.dispose();
        material.dispose();
      }
    });
    environment.dispose();
    skyTexture.dispose();
    skyCube.dispose();
    normals.dispose();
    water.getRenderTarget?.().dispose();
    for(const mirror of marbleMirrors)mirror.dispose();
    dof.dispose();
    composer.dispose();
    renderer.dispose();
  }, {once: true});
  resize();
  status.textContent = '拖动旋转 · 滚轮或双指缩放';
  document.body.dataset.stageReady = 'true';
  // Read-only inspection for review, no controls or private application state.
  window.shellConcertReview = () => ({
    ready: true, modelSHA256: source.sha256, environmentSHA256: source.environmentSHA256,
    foregroundShells:2, floatingPearls:24, castMode:"2.5D",
    contactShadows:footprints.children.length,contactShadowsVisible:footprints.visible,
    depthOfField:{focus:'luffy',maxBlurPixels:1.8,alphaAware:true},
    marbleReflectionPlanes:marbleMirrors.length,marbleReflectionMix:.52,pendantGlobes:8,
    anchors: source.anchors.length, cast: cast.children.length, castVisible: cast.visible,
    view: selectedView, camera: camera.position.toArray(),
    size: {width: host.clientWidth, height: host.clientHeight},
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
    triangles: renderer.info.render.triangles, calls: renderer.info.render.calls,
  });
  window.shellConcertReview.pick = (x,y) => {
    const rect=renderer.domElement.getBoundingClientRect();
    const ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
    return ray.intersectObjects(scene.children,true).slice(0,5).map(hit=>({name:hit.object.name,
      distance:hit.distance,point:hit.point.toArray(),bounds:new THREE.Box3().setFromObject(hit.object).getSize(new THREE.Vector3()).toArray()}));
  };
} catch (error) {
  console.error('Shell concert preview:', error);
  status.classList.add('error');
  status.textContent = '无法载入三维预览。请确认浏览器支持 WebGL，并能连接 jsDelivr 后刷新页面。';
  document.body.dataset.stageReady = 'false';
  controls?.dispose();
  renderer?.dispose();
}
