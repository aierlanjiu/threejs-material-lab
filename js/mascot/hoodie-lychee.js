import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import { materialSet, mesh, sphere, tube, ring, sprig, RindShell, FaceRig, applyShellVariant, damp, batchStaticParts, PALETTE } from './fidelity-kit.js';
import { HOODIE, hoodieHeadShape, hoodieBodyShape } from './reference-proportions.js';

export class HoodieLychee {
  constructor() {
    this.group=new THREE.Group();this.group.name='HoodieLychee';this.mats=materialSet();
    this.shellMat=this.mats.shell;this.jadeFaceMat=this.mats.flesh;this.liningMat=this.mats.lining;this.bootMat=this.mats.boots;
    this.retractProgress=0;this.targetRetract=0;this.currentEmotion='normal';this.variant='default';this.actions={};this.reducedMotion=false;
    this.buildGeometry();
  }
  buildGeometry() {
    const m=this.mats;this.body=new THREE.Group();this.group.add(this.body);
    this.torso=new RindShell(m.shell,{radius:1,aperture:0,count:220,shape:hoodieBodyShape,seed:14,packing:.76,relief:.75});
    this.torso.group.position.set(0,.93,-.02);this.body.add(this.torso.group);
    for(const side of [-1,1]){
      const sleeve=new RindShell(m.shell,{radius:.255,aperture:0,count:55,scale:[1.08,1.20,1.02],seed:side+5,packing:.9,relief:.85});
      sleeve.group.position.set(side*.62,1.10,.19);sleeve.group.rotation.z=side*-.45;this.body.add(sleeve.group);
    }
    tube(this.body,m.seal,[[0,.51,.44],[0,.75,.616],[0,1.17,.56]],.009);
    for(const side of [-1,1])tube(this.body,m.boots,[[side*.10,.61,.57],[side*.36,.65,.56],[side*.53,.79,.51]],.011);
    this.headGroup=new THREE.Group();this.headGroup.position.y=HOODIE.headCenter;this.group.add(this.headGroup);
    this.shell=new RindShell(m.shell,{radius:1,aperture:HOODIE.aperture,count:450,shape:hoodieHeadShape,tilt:HOODIE.tilt,seed:3,packing:.90,relief:.89});
    this.hoodieShell=this.shell.group;this.headGroup.add(this.hoodieShell);
    const points=[];
    for(let i=0;i<72;i++){
      const a=i/72*Math.PI*2,theta=HOODIE.aperture+.008*Math.sin(a*18);
      points.push(this.shell.mapPoint(Math.sin(theta)*Math.cos(a),Math.sin(theta)*Math.sin(a),Math.cos(theta),new THREE.Vector3()).toArray());
    }
    this.hoodRim=tube(this.headGroup,m.lining,points,.032,true,100);
    this.face=new FaceRig(m.flesh,{width:.70,height:.47,depth:.23,centerZ:.58,eyeX:.345,eyeY:.027,eyeSize:1.26,mouthY:-.14,boundary:points.map(p=>[p[0],p[1]+.33,p[2]]),centerZ:.77,depth:.27});
    this.face.group.position.y=-.33;this.headGroup.add(this.face.group);this.faceHoleGroup=this.face.group;this.faceMesh=this.face.face;
    this.leftEye=this.face.eyes[0];this.rightEye=this.face.eyes[1];this.blushMat=this.face.blushMat;
    this.leafGroup=sprig(m,{scale:1.6});this.leafGroup.position.set(-.08,.93,-.03);this.leafGroup.rotation.set(-.12,.10,-.20);this.headGroup.add(this.leafGroup);batchStaticParts(this.leafGroup);
    this.drawstringGroup=new THREE.Group();this.drawstringGroup.position.set(0,1.38,.72);this.body.add(this.drawstringGroup);
    this.strings=[];this.hands=[];
    for(const side of [-1,1]){
      const g=new THREE.Group();g.position.set(side*.30,0,.07);
      tube(g,m.cord,[[0,.02,0],[side*.01,-.13,.03],[side*.05,-.30,.045],[side*.10,-.44,.055]],.029);
      for(let i=0;i<3;i++)sphere(g,m.cord,[side*.008+(i-1)*.032,.005+(i%2)*.025,.023],[.039,.039,.039],14);
      for(let i=0;i<4;i++){const a=i*Math.PI/2;sphere(g,m.cord,[side*.10+Math.cos(a)*.03,-.455,.055+Math.sin(a)*.025],[.029,.058,.028],14);}
      sphere(g,m.stem,[side*.10,-.510,.055],[.031,.055,.03],16);this.drawstringGroup.add(g);this.strings.push(g);batchStaticParts(g);
      const hand=new THREE.Group();hand.position.set(side*.335,-.09,.13);
      sphere(hand,m.flesh,[0,0,0],[.185,.20,.148],28);sphere(hand,m.flesh,[-side*.117,-.025,.082],[.069,.085,.062],20);
      this.drawstringGroup.add(hand);this.hands.push(hand);batchStaticParts(hand);
    }
    [this.stringL,this.stringR]=this.strings;[this.handL,this.handR]=this.hands;
    this.feetGroup=new THREE.Group();this.body.add(this.feetGroup);
    for(const side of [-1,1]){
      const foot=new THREE.Group();foot.position.set(side*.365,.005,.04);
      mesh(foot,new THREE.CylinderGeometry(1,1,.09,40),m.sole,[0,.045,.095],[.288,1,.355]);
      sphere(foot,m.boots,[0,.20,.12],[.276,.20,.336],32);
      mesh(foot,new THREE.CylinderGeometry(.214,.235,.20,32),m.boots,[0,.305,-.025]);
      ring(foot,m.boots,.217,.02,[0,.406,-.025]).rotation.x=Math.PI/2;
      mesh(foot,new THREE.CylinderGeometry(.177,.185,.095,28),m.lining,[0,.427,-.025]);
      sphere(foot,m.lining,[side*.223,.336,-.013],[.024,.060,.058],20);
      this.feetGroup.add(foot);batchStaticParts(foot);
    }
  }
  setMaterialVariant(variant){this.variant=['default','corduroy','cinnabar_jade'].includes(variant)?variant:'default';applyShellVariant(this.mats,this.variant);this.bootMat.color.set(this.variant==='corduroy'?0x7c5238:this.variant==='cinnabar_jade'?0x8f2129:PALETTE.bootRed);}
  triggerAction(action){if(['retract_shell','retract'].includes(action))this.targetRetract=1;else if(['pop_out','open'].includes(action))this.targetRetract=0;else if(['nod','shake','wave','think'].includes(action))this.actions[action]=0;}
  setEmotion(e){this.currentEmotion=e;this.face.setEmotion(e);}
  playNodAnimation(){this.triggerAction('nod');}playShakeAnimation(){this.triggerAction('shake');}playWaveAnimation(){this.triggerAction('wave');}
  update(time,delta=.016,audioLevel=0,rhythm=null){
    const dt=Math.min(delta,.05),reduced=this.reducedMotion;this.audioLevel=audioLevel;
    this.retractProgress=damp(this.retractProgress,this.targetRetract,reduced?18:5.5,dt);if(Math.abs(this.retractProgress-this.targetRetract)<.001)this.retractProgress=this.targetRetract;
    const p=this.retractProgress,k=1-p,bass=!reduced&&rhythm?.isPlaying?rhythm.bass:0,mid=!reduced&&rhythm?.isPlaying?rhythm.mid:0,pulse=!reduced&&rhythm?.isPlaying?rhythm.beatPulse:0;
    this.group.position.y=rhythm?.isPlaying?Math.sin((rhythm.beatPhase||0)*Math.PI)*(bass*.085+pulse*.028):0;
    this.group.rotation.z=reduced?0:Math.sin(time*1.2)*.007*k+mid*Math.sin(time*2)*.018;
    this.headGroup.position.y=HOODIE.headCenter-p*(HOODIE.headCenter-.84);this.headGroup.scale.set(1-bass*.018,1+bass*.023,1-bass*.018);
    this.shell.setAperture(HOODIE.aperture*k+.006*p);
    this.hoodRim.visible=p<.55;this.hoodRim.scale.setScalar(Math.max(.005,k));this.hoodRim.position.set(0,-p*.35,p*.6);
    this.face.group.visible=p<.90;this.face.group.scale.setScalar(Math.max(.01,1-p*.75));this.face.group.position.set(0,-.33,-p*.40);
    this.body.visible=p<.985;this.body.scale.setScalar(Math.max(.003,k));this.body.position.y=p*.6;
    this.hands.forEach((h,i)=>{const side=i?1:-1;h.position.x=side*(.335-p*.17);h.position.y=-.09+p*.10;h.rotation.z=0;});
    this.strings.forEach((s,i)=>{const side=i?1:-1;s.position.x=side*(.30-p*.17);s.rotation.z=reduced?0:side*Math.sin(time*2.3)*(bass*.09+.012)*k;});
    this.leafGroup.rotation.z=-.20+(reduced?0:Math.sin(time*1.65)*.028);this.headGroup.rotation.set(0,0,0);
    for(const [action,elapsed] of Object.entries(this.actions)){
      const t=elapsed+dt,duration=action==='wave'?1.65:1.1,e=Math.sin(Math.PI*Math.min(t/duration,1));this.actions[action]=t;
      if(!reduced){if(action==='nod')this.headGroup.rotation.x=Math.sin(t*11)*.055*e*k;if(action==='shake')this.headGroup.rotation.y=Math.sin(t*13)*.075*e*k;if(action==='wave'){this.handL.position.y+=.25*e;this.handL.position.x-=.17*e;this.handL.rotation.z=Math.sin(t*16)*.32*e;}if(action==='think')this.headGroup.rotation.z=-.05*e;}
      if(t>=duration)delete this.actions[action];
    }
    this.face.update(time,dt,audioLevel,reduced);this.jadeFaceMat.emissiveIntensity=.07+audioLevel*.035;
  }
}
