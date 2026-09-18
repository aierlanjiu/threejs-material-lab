import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/GLTFLoader.js/+esm';

const damping=(a,b,rate,dt)=>THREE.MathUtils.damp(a,b,rate,dt);
function clearVisor(m){
  m.transmission=1;m.roughness=.012;m.thickness=.003;m.ior=1.08;
  m.envMapIntensity=.25;m.specularIntensity=.3;m.clearcoat=0;m.side=THREE.FrontSide;
}
const variants={
  hoodie:['default','corduroy','cinnabar_jade'],
  astro:['default','titanium_holographic','optic_crystal'],
};

/** Approved Hunyuan surfaces, with Blender skin weights and standard glTF morphs. */
export class BlenderLychee {
  static async load(role) {
    const url=new URL(`../../assets/mascots/blender/${role}-lychee.glb`,import.meta.url);
    const gltf=await new GLTFLoader().loadAsync(url.href);
    return new BlenderLychee(role,gltf.scene);
  }
  constructor(role,group){
    this.role=role;this.group=group;this.group.name=`Blender_${role}`;
    this.source='Hunyuan 3D Pro + Blender rig';this.variant='default';this.currentEmotion='normal';
    this.actions={};this.reducedMotion=false;this.retractProgress=0;this.targetRetract=0;
    this.face={targetLook:new THREE.Vector2()};this.parts={};this.materials=new Map();this.mats={};
    this.bones={};this.morphMeshes=[];this.morphValues={blink:0,smile:0,curious:0,shy:0,mouth_open:0};
    group.updateMatrixWorld(true);
    group.traverse(o=>{
      if(o.userData.li_part)this.parts[o.userData.li_part]=o;
      if(o.isBone){
        // GLTFLoader strips dots reserved by Three.js property bindings.
        const name=o.name.replace(/^(Clavicle|Arm|UpperArm|LowerArm|Hand|Thigh|Calf|Foot)([LR])$/,'$1.$2');
        this.bones[name]=o;
      }
      if(!o.isMesh)return;
      if(o.morphTargetDictionary)this.morphMeshes.push(o);
      o.receiveShadow=true;
      const mats=Array.isArray(o.material)?o.material:[o.material];
      for(const m of mats){
        m.envMapIntensity=.78;
        if(m.name.startsWith('Rind'))this.mats.shell=m;
        if(m.name.startsWith('Boots'))this.mats.boots=m;
        if(m.name.startsWith('Suit'))this.suitMat=m;
        if(m.name.startsWith('Visor'))clearVisor(m);
        if(m.name.startsWith('Face')){m.roughness=.30;m.clearcoat=.16;m.emissive.set('#ffe4d6');m.emissiveIntensity=.025;}
        if(m.name.startsWith('Eyes · clear outer lens')){m.transmission=1;m.ior=1.36;m.roughness=.02;m.clearcoat=1;m.clearcoatRoughness=.02;m.envMapIntensity=.45;m.side=THREE.FrontSide;}
        if(!this.materials.has(m))this.materials.set(m,m.clone());
      }
      o.castShadow=mats.some(m=>/Rind|Boots|Suit/.test(m.name));
    });
    this.head=this.bones.Head;this.body=this.bones.Body;
    this.eyes=[];this.mouth=this.parts.Face;
    this.arms=[this.bones['UpperArm.L'],this.bones['UpperArm.R']];
    this.home=new Map();
    for(const o of Object.values(this.bones))this.home.set(o,{position:o.position.clone(),scale:o.scale.clone(),quaternion:o.quaternion.clone(),worldInverse:o.getWorldQuaternion(new THREE.Quaternion()).invert()});
    this.materials.forEach((base,m)=>{base.envMapIntensity=m.envMapIntensity;});
  }
  setMaterialVariant(id){
    this.variant=variants[this.role].includes(id)?id:'default';
    for(const [m,base] of this.materials){
      m.copy(base);
      const rind=m.name.startsWith('Rind'),suit=m.name.startsWith('Suit'),boot=m.name.startsWith('Boots');
      if(this.variant==='corduroy'&&(rind||boot)){
        m.vertexColors=false;m.color.set(rind?'#a17b58':'#705342');m.roughness=.92;m.metalness=0;m.clearcoat=0;m.sheen=.9;m.sheenRoughness=.85;m.sheenColor?.set('#e7ccb0');
      }
      if(this.variant==='cinnabar_jade'){
        if(rind||boot){m.vertexColors=false;m.color.set('#ad2937');m.roughness=.21;m.clearcoat=.95;m.clearcoatRoughness=.15;}
        if(m.name.startsWith('Lining')){m.color.set('#dbba7f');m.metalness=.55;m.roughness=.30;}
      }
      if(this.variant==='titanium_holographic'&&suit){m.color.set('#adb9ba');m.metalness=.88;m.roughness=.28;m.iridescence=.24;m.iridescenceIOR=1.32;m.iridescenceThicknessRange=[170,340];}
      if(this.variant==='optic_crystal'&&suit){m.color.set('#c5e4df');m.metalness=0;m.roughness=.13;m.transmission=.32;m.thickness=.16;m.ior=1.42;m.clearcoat=.8;}
      if(m.name.startsWith('Visor'))clearVisor(m);
      m.needsUpdate=true;
    }
  }
  setEmotion(emotion){this.currentEmotion=emotion;}
  triggerAction(name){
    if(name==='retract_shell')this.targetRetract=1;
    if(name==='pop_out')this.targetRetract=0;
    this.actions[name]=0;
  }
  update(time,dt,audio=0,rhythm={}){
    dt=Math.min(dt,.08);
    for(const name of Object.keys(this.actions)){this.actions[name]+=dt;if(this.actions[name]>2.8)delete this.actions[name];}
    const envelope=name=>{const t=this.actions[name];return t==null?0:Math.sin(Math.PI*Math.min(t/2.8,1));};
    const beat=this.reducedMotion?0:(rhythm.bass||0)*.075;
    const idle=this.reducedMotion?0:Math.sin(time*1.65)*.007;
    const float=envelope('zero_g_float')*.16+envelope('jetpack_boost')*.22;
    const root=this.bones.Root;
    if(root){const h=this.home.get(root);root.position.copy(h.position);root.position.y+=idle+beat+float;}
    this.retractProgress=damping(this.retractProgress,this.targetRetract,5,dt);
    const pose=(name,rotations=[])=>{
      const bone=this.bones[name];if(!bone)return;const h=this.home.get(bone),q=h.quaternion.clone();
      for(const [axis,angle] of rotations){const v=new THREE.Vector3(...axis).applyQuaternion(h.worldInverse);q.multiply(new THREE.Quaternion().setFromAxisAngle(v,angle));}
      bone.quaternion.slerp(q,1-Math.exp(-10*dt));
    };
    const X=[1,0,0],Y=[0,1,0],Z=[0,0,1],mood=this.currentEmotion;
    pose('Root',[[Z,this.reducedMotion?0:Math.sin(time*1.1)*.006+(rhythm.mid||0)*Math.sin(time*4)*.022]]);
    pose('Spine',[[X,this.retractProgress*.055]]);
    if(this.head){
      const home=this.home.get(this.head);
      this.head.position.copy(home.position);this.head.position.y-=this.retractProgress*.11;
      const nod=envelope('nod')*Math.sin((this.actions.nod||0)*9)*.10;
      const shake=envelope('shake')*Math.sin((this.actions.shake||0)*11)*.16;
      const tilt=mood==='curious'?.11:mood==='shy'?-.075:envelope('think')*.08;
      pose('Head',[[X,nod+(mood==='shy'?.045:0)+this.retractProgress*.06],[Y,shake+this.face.targetLook.x*.035],[Z,tilt]]);
    }
    const phase=(time+1.7)%4.7;
    const blink=this.reducedMotion?0:phase<.22?Math.sin(phase/.22*Math.PI)**2:0;
    const targets={blink:Math.max(blink,mood==='sleepy'?.86:this.retractProgress*.65),smile:mood==='happy'||mood==='energetic'?1:0,curious:mood==='curious'?1:0,shy:mood==='shy'?1:0,mouth_open:THREE.MathUtils.clamp(audio,0,1)};
    for(const name of Object.keys(this.morphValues)){
      this.morphValues[name]=damping(this.morphValues[name],targets[name],name==='blink'?35:name==='mouth_open'?20:7,dt);
      for(const mesh of this.morphMeshes){const index=mesh.morphTargetDictionary[name];if(index!==undefined)mesh.morphTargetInfluences[index]=this.morphValues[name];}
    }
    const wave=envelope('wave'),salute=envelope('salute');
    pose('UpperArm.L',[[Z,wave*.43],[X,-wave*.24]]);
    pose('LowerArm.L',[[Z,wave*.25]]);
    pose('Hand.L',[[Y,wave*Math.sin(time*14)*.26]]);
    pose('UpperArm.R',[[Z,-salute*1.50],[X,-salute*.24]]);
    pose('LowerArm.R',[[Z,-salute*1.05]]);
    pose('Hand.R',[[X,salute*.22]]);
    pose('Leaf_Antenna',[[Z,this.reducedMotion?0:Math.sin(time*2.2)*.018+envelope('antenna_beacon')*.04]]);
    const pulse=envelope('visor_hud_pulse'),beacon=envelope('antenna_beacon');
    for(const [m,base] of this.materials){
      if(m.name.startsWith('HUD'))m.emissiveIntensity=2.5+pulse*3;
      if(m.name.startsWith('Beacon'))m.emissiveIntensity=base.emissiveIntensity+(/thruster/.test(m.name)?envelope('jetpack_boost')*4:beacon*4);
      if(m.name.startsWith('Face'))m.color.copy(base.color).lerp(new THREE.Color('#ffdfdb'),this.morphValues.shy*.12);
    }
  }
}
