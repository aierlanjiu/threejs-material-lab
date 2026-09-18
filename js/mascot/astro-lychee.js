import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import { ASTRO, astroHeadShape } from './reference-proportions.js';
import { materialSet, batchStaticParts, mesh, sphere, rounded, tube, ring, scallopEllipse, sprig, RindShell, FaceRig, surfaceTexture, damp, PALETTE } from './fidelity-kit.js';

export class AstroLychee {
  constructor() {
    this.group = new THREE.Group(); this.group.name = 'AstroLychee'; this.mats = materialSet();
    this.variant = 'default'; this.currentEmotion = 'energetic'; this.isFloating = true; this.actions = {};
    this.hudPulseActive = false; this.beaconBlinkActive = false; this.reducedMotion = false;
    this.initMaterials(); this.buildGeometry();
    batchStaticParts(this.headGroup, [this.shell.group, this.face.group, this.visorMesh, this.hudRing, this.antennaGroup]);
    batchStaticParts(this.bodyGroup, [...this.arms, ...this.legs, this.backpackGroup]);
    [...this.arms, ...this.legs, this.backpackGroup].forEach(g => batchStaticParts(g));
  }
  initMaterials() {
    this.helmetMat = this.mats.shell; this.faceMat = this.mats.flesh;
    this.mats.metal.color.set(0xb8b9b5);this.mats.metal.metalness=.9;this.mats.seal.color.set(0xc74a1a);
    this.suitMat = new THREE.MeshPhysicalMaterial({ color: 0xeae6dc, metalness: .04, roughness: .43, clearcoat: .24, clearcoatRoughness: .3,
      normalMap: surfaceTexture('grain').normal, normalScale: new THREE.Vector2(.13, .13) });
    this.visorMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: .045,
      ior: 1.18, roughness: .012, metalness: 0, clearcoat: .7, clearcoatRoughness: .1,
      attenuationColor: new THREE.Color(0xf4f6ef), attenuationDistance: 5, envMapIntensity: .48 });
    this.hudMat = new THREE.LineBasicMaterial({ color: 0x53c9dd, transparent: false, depthWrite: true, toneMapped: false });
    this.beaconMat = new THREE.MeshStandardMaterial({ color: 0xffb74d, emissive: 0xff7a10, emissiveIntensity: .7, roughness: .2 });
    this.nectarMat = new THREE.MeshPhysicalMaterial({ color: 0xeec9aa, transmission: .50, thickness: .16, roughness: .18, ior: 1.36 });
  }
  buildGeometry() {
    const m = this.mats;
    this.headGroup=new THREE.Group();this.headGroup.position.y=ASTRO.headCenter;this.group.add(this.headGroup);
    this.shell=new RindShell(this.helmetMat,{radius:1,aperture:.96,count:540,shape:astroHeadShape,seed:9,packing:.83,relief:.77});
    this.headGroup.add(this.shell.group);this.helmetMesh=this.shell.group;
    const seal=ring(this.headGroup,m.seal,.868,.039,[0,0,.634]);seal.scale.y=.875;
    const outer=ring(this.headGroup,m.metal,.90,.029,[0,0,.645]);outer.scale.y=.88;
    const inner=ring(this.headGroup,m.metal,.85,.012,[0,0,.665]);inner.scale.y=.89;
    this.face=new FaceRig(this.faceMat,{width:.88,height:.79,depth:.23,centerZ:.65,eyeX:.31,eyeY:-.08,eyeSize:1.16,mouthY:-.28,brows:true,boundary:Array.from({length:72},(_,i)=>{const a=i/72*Math.PI*2;return [Math.cos(a)*.875,Math.sin(a)*.775,.637];})});this.face.group.position.y=-.02;this.face.setEmotion('energetic');this.headGroup.add(this.face.group);
    this.visorMesh=mesh(this.headGroup,new THREE.SphereGeometry(1.02,56,28,0,Math.PI*2,0,1.04),this.visorMat,[0,0,.16],[1,1,.90]);
    this.visorMesh.geometry.rotateX(Math.PI/2);this.visorMesh.scale.y=.90;this.visorMesh.castShadow=false;this.visorMesh.receiveShadow=false;
    const vertices=[];
    for(let i=0;i<96;i++){const a=i/96*Math.PI*2,r=i%4===0?.783:.81;vertices.push(Math.cos(a)*r,Math.sin(a)*r*.89,.71,Math.cos(a)*.829,Math.sin(a)*.829*.89,.71);}
    for(let i=0;i<100;i++){const a=i/100*Math.PI*2;if((i>12&&i<29)||(i>60&&i<81))vertices.push(Math.cos(a)*.79,Math.sin(a)*.79*.89,.72,Math.cos(a+.05)*.79,Math.sin(a+.05)*.79*.89,.72);}
    this.hudRing=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),this.hudMat);this.headGroup.add(this.hudRing);
    for(const side of [-1,1]){
      mesh(this.headGroup,new THREE.CylinderGeometry(.208,.22,.10,32),m.metal,[side*1.052,-.02,.09]).rotation.z=Math.PI/2;
      mesh(this.headGroup,new THREE.CylinderGeometry(.158,.158,.115,28),m.seal,[side*1.070,-.02,.09]).rotation.z=Math.PI/2;
      const led=ring(this.headGroup,this.beaconMat,.132,.016,[side*1.134,-.02,.09]);led.rotation.y=Math.PI/2;
      mesh(this.headGroup,new THREE.CylinderGeometry(.103,.103,.125,24),m.metal,[side*1.088,-.02,.09]).rotation.z=Math.PI/2;
    }
    this.antennaGroup=sprig(m,{scale:1.30});this.antennaGroup.position.set(-.05,.9,-.06);this.antennaGroup.rotation.z=-.09;this.headGroup.add(this.antennaGroup);
    mesh(this.antennaGroup,new THREE.CylinderGeometry(.085,.115,.064,24),m.metal,[0,.002,0]);
    ring(this.antennaGroup,this.beaconMat,.069,.014,[0,.051,0]).rotation.x=Math.PI/2;
    this.beaconLed=sphere(this.antennaGroup,this.beaconMat,[-.006,.061,0],[.042,.024,.042],16);this.beaconLed.castShadow=false;batchStaticParts(this.antennaGroup);
    this.bodyGroup = new THREE.Group(); this.bodyGroup.position.y = ASTRO.bodyCenter;this.bodyGroup.scale.setScalar(ASTRO.bodyScale); this.group.add(this.bodyGroup);
    this.suitMesh = sphere(this.bodyGroup, this.suitMat, [0, 0, 0], [.53, .48, .34], 36);
    // Raised collar, rounded chest console, harness, stitched waist and short pressure hoses.
    mesh(this.bodyGroup, new THREE.CylinderGeometry(.24, .29, .10, 28), m.metal, [0, .36, 0]);
    rounded(this.bodyGroup, m.metal, [.34, .32, .07], .048, [0, .09, .289]);
    rounded(this.bodyGroup, this.suitMat, [.30, .278, .047], .037, [0, .09, .333]);
    const logo = document.createElement('canvas'); logo.width = logo.height = 128; const ctx = logo.getContext('2d');
    ctx.fillStyle = '#b84349'; ctx.beginPath(); ctx.arc(64, 64, 29, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b84349'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(64, 64, 49, 15, -.6, 0, Math.PI * 2); ctx.stroke();
    const tex = new THREE.CanvasTexture(logo); tex.colorSpace = THREE.SRGBColorSpace;
    const badge = mesh(this.bodyGroup, new THREE.PlaneGeometry(.17, .17), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), [-.025, .105, .36]); badge.castShadow = false;
    for (const side of [-1, 1]) {
      tube(this.bodyGroup, m.metal, [[side * .22, .35, .16], [side * .24, .17, .24], [side * .27, -.14, .24], [side * .20, -.32, .23]], .025);
      tube(this.bodyGroup, m.lining, [[side * .16, -.035, .38], [side * .28, -.19, .41], [side * .34, -.20, .23]], .035);
    }
    rounded(this.bodyGroup, m.seal, [.035, .04, .018], .009, [.10, .155, .365]);
    rounded(this.bodyGroup, m.metal, [.035, .04, .018], .009, [.10, .077, .365]);
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .45, .16, 0); arm.rotation.z = side * .36;
      mesh(arm, new THREE.CapsuleGeometry(.125, .20, 6, 18), this.suitMat, [side * .075, -.14, 0]);
      const cuff = mesh(arm, new THREE.CylinderGeometry(.132, .132, .065, 20), m.metal, [side * .075, -.31, 0]);
      sphere(arm, this.suitMat, [side * .075, -.41, .018], [.12, .155, .105], 22);
      sphere(arm, this.suitMat, [side * -.006, -.395, .071], [.046, .072, .049], 16);
      rounded(arm, m.seal, [.087, .093, .02], .016, [side * .075, -.08, .119]);
      this.bodyGroup.add(arm); this.arms.push(arm);
    }
    [this.armL, this.armR] = this.arms;
    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * .265, -.27, 0);
      mesh(leg, new THREE.CapsuleGeometry(.149, .12, 6, 20), this.suitMat, [0, -.035, 0]);
      mesh(leg, new THREE.CylinderGeometry(.15, .15, .046, 24), m.seal, [0, -.07, 0]);
      sphere(leg, this.suitMat, [0, -.40, .06], [.23, .16, .27], 24);
      mesh(leg,new THREE.CylinderGeometry(1,1,.068,32),m.metal,[0,-.53,.07],[.231,1,.270]);
      rounded(leg, m.seal, [.16, .037, .025], .012, [0, -.485, .307]);
      mesh(leg,new THREE.CylinderGeometry(.19,.20,.29,28),this.suitMat,[0,-.24,0]);
      mesh(leg,new THREE.CylinderGeometry(.071,.071,.025,20),m.metal,[side*.205,-.28,.02]).rotation.z=Math.PI/2;
      ring(leg,m.seal,.061,.008,[side*.221,-.28,.02]).rotation.y=Math.PI/2;
      this.bodyGroup.add(leg); this.legs.push(leg);
    }
    [this.legL, this.legR] = this.legs;
    this.backpackGroup = new THREE.Group(); this.backpackGroup.position.set(0, -.015, -.36); this.bodyGroup.add(this.backpackGroup);
    rounded(this.backpackGroup, this.suitMat, [.66, .72, .24], .08, [0, 0, -.055]);
    const rearBadge=mesh(this.backpackGroup,new THREE.PlaneGeometry(.23,.23),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),[0,.125,-.18]);rearBadge.rotation.y=Math.PI;
    for (const side of [-1, 1]) {
      mesh(this.backpackGroup, new THREE.CapsuleGeometry(.091, .23, 6, 18), m.metal, [side * .18, 0, -.20]);
      mesh(this.backpackGroup, new THREE.CylinderGeometry(.094, .094, .18, 18), this.nectarMat, [side * .18, .02, -.20]);
      mesh(this.backpackGroup, new THREE.ConeGeometry(.069, .14, 16), m.metal, [side * .18, -.24, -.20]).rotation.z = Math.PI;
    }
    this.jetMat = new THREE.MeshBasicMaterial({ color: 0xb5ddd0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    this.jets = [];
    for (const side of [-1, 1]) {
      const jet = mesh(this.backpackGroup, new THREE.ConeGeometry(.055, .24, 12), this.jetMat, [side * .18, -.38, -.2]);
      jet.castShadow = false; this.jets.push(jet);
    }
  }
  setMaterialVariant(variant) {
    this.variant = ['default', 'titanium_holographic', 'optic_crystal'].includes(variant) ? variant : 'default';
    const metal = this.variant === 'titanium_holographic', crystal = this.variant === 'optic_crystal';
    this.suitMat.color.set(metal ? 0x8d9a9c : crystal ? 0xf2f4ed : 0xeae6dc);
    this.suitMat.metalness = metal ? .95 : .04; this.suitMat.roughness = metal ? .29 : crystal ? .12 : .43;
    this.suitMat.transmission = crystal ? .72 : 0; this.suitMat.thickness = .36; this.suitMat.ior = 1.46;
    this.suitMat.attenuationColor.set(0xd9e7df); this.suitMat.attenuationDistance = 2;
    this.suitMat.iridescence = metal ? .32 : 0; this.suitMat.iridescenceIOR = 1.3;
    this.suitMat.normalMap = surfaceTexture(metal ? 'brushed' : 'grain').normal;
    this.suitMat.normalScale.setScalar(crystal ? .02 : .13); this.suitMat.clearcoat = crystal ? .8 : .24;
    this.suitMat.needsUpdate = true;
    this.hudMat.color.set(metal ? 0xb3a0d3 : crystal ? 0x88be9f : 0x76b7b8);
    this.helmetMat.color.set(crystal ? 0xd0707a : metal ? 0xa8495a : PALETTE.rind);
  }
  setEmotion(e) { this.currentEmotion = e; this.face.setEmotion(e); }
  triggerAction(action) {
    if (action === 'zero_g_float') { this.isFloating = true; this.actions.float = 0; }
    else if (['visor_hud_pulse', 'antenna_beacon', 'jetpack_boost', 'salute'].includes(action)) this.actions[action] = 0;
  }
  pulseHud() { this.triggerAction('visor_hud_pulse'); }
  blinkBeacon() { this.triggerAction('antenna_beacon'); }
  playBoostAnimation() { this.triggerAction('jetpack_boost'); }
  playSaluteAnimation() { this.triggerAction('salute'); }
  update(time, delta = .016, audioLevel = 0, rhythm = null) {
    const dt = Math.min(delta, .05), reduced = this.reducedMotion;
    this.audioLevel = audioLevel;
    const bass = !reduced && rhythm?.isPlaying ? rhythm.bass : 0, treble = !reduced && rhythm?.isPlaying ? rhythm.treble : 0;
    const pulse = !reduced && rhythm?.isPlaying ? rhythm.beatPulse : 0;
    this.group.position.y = reduced ? .02 : .04 + (this.isFloating ? Math.sin(time * 1.25) * .045 : 0) + bass * .055 + pulse * .04;
    this.group.position.z = 0;
    this.group.rotation.set(0, reduced ? 0 : Math.sin(time * .75) * .04, reduced ? 0 : Math.sin(time * 1.1) * .02);
    this.armR.rotation.set(0, 0, .36); this.armL.rotation.set(0, 0, -.36);
    this.hudPulseActive = this.actions.visor_hud_pulse !== undefined;
    this.beaconBlinkActive = this.actions.antenna_beacon !== undefined;
    let hud = .35 + audioLevel * .32 + pulse * .15, beacon = .7 + audioLevel, jet = 0;
    for (const [action, elapsed] of Object.entries(this.actions)) {
      const t = elapsed + dt, duration = action === 'visor_hud_pulse' ? 2.2 : action === 'salute' ? 1.8 : 1.4;
      this.actions[action] = t; const e = Math.sin(Math.PI * Math.min(1, t / duration));
      if (action === 'visor_hud_pulse') hud += e * (reduced ? .4 : .42 + .12 * Math.sin(t * 8));
      if (action === 'antenna_beacon') beacon += reduced ? .8 : (Math.sin(t * 15) * .5 + .5) * 2.3;
      if (action === 'jetpack_boost') { jet = e * .6; if (!reduced) { this.group.position.y += e * .16; this.group.rotation.x = -.09 * e; } }
      if (action === 'float' && !reduced) this.group.position.y += e * .12;
      if (action === 'salute') { this.armR.rotation.z = .36 + e * 2.2; this.armR.rotation.x = -e * .35; }
      if (t >= duration) delete this.actions[action];
    }
    if (!reduced) this.hudRing.rotation.z += dt * (.045 + treble * .18);
    this.hudMat.color.setRGB(.12+hud*.24,.48+hud*.4,.61+hud*.3); this.beaconMat.emissiveIntensity = beacon; this.jetMat.opacity = jet;
    this.face.update(time, dt, audioLevel, reduced);
    this.antennaGroup.rotation.z = -.09 + (reduced ? 0 : Math.sin(time * 1.2) * .012);
  }
}
