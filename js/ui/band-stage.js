import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {stageSpec,stageHeightAt} from '../audio/band-stage-layout.js';
import {createStageFountains} from './band-fountains.js';

const palettes={
 'one-piece':{cool:'#84d8eb',warm:'#ffc786',wall:'#13222c',curtain:'#714843',glass:'#b7e3ee'},
 'dragon-ball':{cool:'#91e4c0',warm:'#ffd190',wall:'#132824',curtain:'#385b51',glass:'#b9e6d6'},
 naruto:{cool:'#b4bafa',warm:'#ffc9ab',wall:'#211e32',curtain:'#733d50',glass:'#d1d0ef'}
};
export function createConcertStage(scene,{createMaterial,textureFor,onChange=()=>{}}={}){
 const root=new THREE.Group(),effects=new THREE.Group();scene.add(root,effects);
 let narrow=null,theme='one-piece',screen=null,glass=[],lamps=[],bubbles=[],beams=[],glows=[],emissives=[],disposed=false,themeRevision=0,lastLighting=null;
 const steel=()=>new THREE.MeshStandardMaterial({color:'#333d49',metalness:.8,roughness:.32});
 const metal=()=>new THREE.MeshStandardMaterial({color:'#c1b69f',metalness:.82,roughness:.23});
 const add=(geometry,material,x=0,y=0,z=0,parent=root)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const box=(w,h,d,mat,x,y,z,parent=root)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);
 function rod(a,b,r=.035,material=steel(),parent=root){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),direction=to.clone().sub(from),g=new THREE.CylinderGeometry(1,1,1,8);g.userData.rod=true;
  const mesh=add(g,material,0,0,0,parent);mesh.scale.set(r,direction.length(),r);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return mesh;
 }
 function batchRods(group){const batches=new Map();group.traverse(o=>{if(o.geometry?.userData.rod){const key=o.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);}});
  for(const rods of batches.values()){if(rods.length<3)continue;group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batch=new THREE.InstancedMesh(rods[0].geometry,rods[0].material,rods.length);
   rods.forEach((o,i)=>{batch.setMatrixAt(i,inverse.clone().multiply(o.matrixWorld));o.parent.remove(o);if(i)o.geometry.dispose();});batch.receiveShadow=true;group.add(batch);}
 }
 function disposeTree(group){const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);if(o.material?.map?.userData.stageBackdrop)o.material.map.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();}
 function platformShape(spec,level){const shape=new THREE.Shape();
  if(narrow){const w=spec.widths[level],d=spec.fronts[level]-spec.back;shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,-d);shape.lineTo(-w/2,-d);shape.closePath();}
  else{const r=spec.radii[level];shape.moveTo(-r,0);shape.absarc(0,0,r,Math.PI,2*Math.PI,false);shape.lineTo(-r,0);}
  return shape;
 }
 function slab(spec,level,height,bevel=true){const g=new THREE.ExtrudeGeometry(platformShape(spec,level),{depth:height,bevelEnabled:bevel,bevelThickness:.045,bevelSize:.065,bevelSegments:2,curveSegments:64});g.rotateX(-Math.PI/2);return g;}
 function prismMaterial(){const m=createMaterial();m.color.set('#ffffff');m.roughness=.035;m.transmission=.96;m.thickness=.86;m.ior=1.5;m.opacity=1;m.transparent=false;m.side=THREE.DoubleSide;m.attenuationColor.set(palettes[theme].glass);m.attenuationDistance=5.8;m.envMapIntensity=1.3;m.iridescence=.36;m.dispersion=.18;return m;}
 function edge(spec,level,top){const count=narrow?48:96,positions=[],colors=[],indices=[],width=spec.widths?.[level]||0;
  for(let i=0;i<=count;i++){const t=i/count,a=t*Math.PI,r=(spec.radii?.[level]||0)+.07,x=narrow?(t-.5)*width:Math.cos(a)*r,z=narrow?spec.fronts[level]+.07:spec.back+Math.sin(a)*r;
   const c=new THREE.Color().setHSL(.52+t*.32+level*.05,.48,.53);for(const y of [top-.52,top-.17]){positions.push(x,y,z);colors.push(c.r,c.g,c.b);}if(i<count){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);
  const m=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:.36,depthWrite:false,blending:THREE.AdditiveBlending});const mesh=add(g,m);mesh.receiveShadow=false;emissives.push(m);
  const path=narrow?[new THREE.Vector3(-width/2,top,spec.back),new THREE.Vector3(-width/2,top,spec.fronts[level]),new THREE.Vector3(width/2,top,spec.fronts[level]),new THREE.Vector3(width/2,top,spec.back)]:Array.from({length:97},(_,i)=>new THREE.Vector3(Math.cos(i/96*Math.PI)*spec.radii[level],top,spec.back+Math.sin(i/96*Math.PI)*spec.radii[level]));
  const edgeGeometry=new THREE.BufferGeometry().setFromPoints(path),edgeColors=[];path.forEach((p,i)=>{const c=new THREE.Color().setHSL(.52+i/path.length*.32+level*.05,.45,.80);edgeColors.push(c.r,c.g,c.b);});edgeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(edgeColors,3));
  const line=new THREE.Line(edgeGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.72,depthTest:false}));root.add(line);
 }
 function curtain(x,width,height,z,color,parent=root){const g=new THREE.PlaneGeometry(width,height,36,16),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const u=p.getX(i)/width,v=p.getY(i)/height;p.setZ(i,Math.sin(u*Math.PI*14)*.22+Math.sin(v*3+u*7)*.07);}g.computeVertexNormals();
  return add(g,new THREE.MeshPhysicalMaterial({color,roughness:.83,sheen:1,sheenColor:new THREE.Color('#dfab99'),sheenRoughness:.7,side:THREE.DoubleSide}),x,height/2-.2,z,parent);
 }
 function glowTexture(){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#fff');g.addColorStop(.08,'#ffffffdc');g.addColorStop(.32,'#ffffff45');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
 const lightTexture=glowTexture(),fountains=createStageFountains(effects,{lightTexture});
 function glow(x,y,z,color,size=1){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:lightTexture,color,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));sprite.position.set(x,y,z);sprite.scale.set(size,size,1);root.add(sprite);glows.push(sprite);return sprite;}
 function shaft(from,to,color){const direction=new THREE.Vector3(...from).sub(new THREE.Vector3(...to)),mesh=add(new THREE.CylinderGeometry(.05,narrow?1:1.65,1,24,1,true),new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color(color)},opacity:{value:.075}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform vec3 tint;uniform float opacity;void main(){float edge=pow(sin(vUv.x*3.14159265),2.);gl_FragColor=vec4(tint,opacity*edge*(.2+.8*vUv.y));}',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),0,0,0);
  mesh.scale.y=direction.length();mesh.position.copy(new THREE.Vector3(...from)).add(new THREE.Vector3(...to)).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());mesh.receiveShadow=false;beams.push({mesh,from:new THREE.Vector3(...from),to:new THREE.Vector3(...to)});
 }
 function truss(width,y,z){const m=steel(),depth=.48;for(const yy of [y,y+depth])for(const zz of [z,z+depth])rod([-width/2,yy,zz],[width/2,yy,zz],.055,m);
  for(let x=-width/2;x<width/2;x+=1.3){const end=Math.min(width/2,x+1.3);rod([x,y,z],[end,y+depth,z],.035,m);rod([x,y+depth,z+depth],[end,y,z+depth],.035,m);}
  for(const side of [-1,1]){const x=side*width/2;rod([x,-.35,z],[x,y+.5,z],.085,m);rod([x+.28,-.35,z],[x+.28,y+.5,z],.085,m);for(let yy=0;yy<y;yy+=1.1)rod([x,yy,z],[x+.28,yy+1.1,z],.035,m);}
  for(let i=0;i<8;i++){const x=(i/7-.5)*(width-1.7),color=i%2?palettes[theme].warm:palettes[theme].cool;
   box(.42,.28,.38,m,x,y-.15,z+.25);const head=add(new THREE.CylinderGeometry(.17,.22,.4,12),m,x,y-.45,z+.5);head.rotation.x=.55;
   const lens=add(new THREE.CircleGeometry(.14,12),new THREE.MeshBasicMaterial({color}),x,y-.59,z+.68);lens.rotation.x=.55;glow(x,y-.59,z+.73,color,narrow?.6:.85);
   if(i===1||i===6){const light=new THREE.SpotLight(color,90,50,.62,.87,1.5);light.position.set(x,y-.5,z+.8);light.target.position.set(x*.35,.7,narrow?2:4);root.add(light,light.target);lamps.push(light);}
   if([0,2,5,7].includes(i))shaft([x,y-.55,z+.8],[x*.78,.25,narrow?4.8:7],color);
  }
 }
 function speaker(x,y,z,scale=1){const mat=new THREE.MeshStandardMaterial({color:'#202733',roughness:.75}),body=box(.85*scale,1.4*scale,.65*scale,mat,x,y,z);
  for(const yy of [-.3,.3]){add(new THREE.CircleGeometry(.27*scale,20),new THREE.MeshStandardMaterial({color:'#394451',roughness:.86}),x,y+yy*scale,z+.331*scale);add(new THREE.CircleGeometry(.10*scale,12),steel(),x,y+yy*scale,z+.34*scale);}
  box(.6*scale,.05*scale,.04*scale,metal(),x,y+.53*scale,z+.34*scale);body.castShadow=true;
 }
 function monitor(x,z){const floor=stageHeightAt(x,z,narrow),body=box(narrow?1.05:1.4,.5,.8,steel(),x,floor+.30,z);body.rotation.x=-.28;
  const grille=box(narrow?.93:1.25,.025,.65,new THREE.MeshStandardMaterial({color:'#5b6670',roughness:.86}),x,floor+.60,z-.08);grille.rotation.x=-.28;body.castShadow=true;
 }
 function decorations(){const decor=new THREE.Group();decor.name='theme-decor';root.add(decor);const s=stageSpec(narrow),width=narrow?11.3:23,z=s.back-.55,bronze=metal();
  if(theme==='one-piece'){
   const fabric=new THREE.MeshPhysicalMaterial({color:'#eee1c7',roughness:.77,sheen:.7,sheenColor:new THREE.Color('#fff1d9'),side:THREE.DoubleSide}),wood=new THREE.MeshStandardMaterial({color:'#896747',roughness:.57});
   for(const side of [-1,1]){const x=side*width*.30,w=width*.27,height=narrow?6.1:3.6,top=narrow?11.7:7.5,bottom=top-height;
    rod([x,2,z],[x,top+.5,z],.075,wood,decor);rod([x-w*.55,top,z],[x+w*.55,top,z],.055,wood,decor);
    const g=new THREE.PlaneGeometry(w,height,24,20),p=g.attributes.position;for(let i=0;i<p.count;i++){const u=p.getX(i)/w,v=(p.getY(i)+height/2)/height;p.setX(i,p.getX(i)*(.68+.32*v));p.setY(i,p.getY(i)+Math.sin((u+.5)*Math.PI)*.18);p.setZ(i,Math.sin((u+.5)*Math.PI)*Math.sin(v*Math.PI)*1.1+Math.sin(u*30)*.025);}g.computeVertexNormals();add(g,fabric,x,(top+bottom)/2,z+.2,decor);
    for(const dir of [-1,1]){rod([x+dir*w*.55,top,z],[x+dir*w*.34,bottom,z+.2],.015,bronze,decor);rod([x,top+.5,z],[side*width*.46,1.6,z+.2],.018,bronze,decor);}
    const rope=new THREE.Mesh(new THREE.TorusGeometry(.48,.07,8,28),new THREE.MeshStandardMaterial({color:'#ab906b',roughness:.86}));rope.position.set(side*width*.4,1.1,z+1);decor.add(rope);
   }
  }else if(theme==='dragon-ball'){
   const lift=narrow?3.2:0,arc=Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI)*width*.43,2.9+lift+Math.sin(i/64*Math.PI)*5,z));
   add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc),64,.15,10),bronze,0,0,0,decor);
   for(let i=0;i<7;i++){const angle=(i+.5)/7*Math.PI,x=Math.cos(angle)*width*.43,y=2.9+lift+Math.sin(angle)*5;
    add(new THREE.SphereGeometry(narrow?.28:.4,20,14),new THREE.MeshPhysicalMaterial({color:'#ffbc68',transmission:.24,roughness:.12,clearcoat:1,emissive:'#ce7633',emissiveIntensity:.35}),x,y,z,decor);
    for(let k=0;k<=i;k++){const a=k/Math.max(1,i+1)*Math.PI*2,star=new THREE.Shape();for(let j=0;j<10;j++){const r=j%2?.03:.064,t=j/10*Math.PI*2;j?star.lineTo(Math.sin(t)*r,Math.cos(t)*r):star.moveTo(0,r);}star.closePath();add(new THREE.ShapeGeometry(star),new THREE.MeshBasicMaterial({color:'#a94021'}),x+(i?Math.cos(a)*.13:0),y+(i?Math.sin(a)*.13:0),z+.38,decor);}
   }
  }else{const red=new THREE.MeshStandardMaterial({color:'#ac4d4b',roughness:.40,metalness:.15}),dark=new THREE.MeshStandardMaterial({color:'#25232a',roughness:.58}),lift=narrow?3.6:0;
   for(const side of [-1,1]){rod([side*width*.33,1.2,z],[side*width*.33,7.5+lift,z],.17,red,decor);box(.62,.18,.62,dark,side*width*.33,1.28,z,decor);}
   box(width*.88,.32,.48,red,0,7.5+lift,z,decor);box(width*.72,.22,.36,red,0,6.76+lift,z,decor);
   for(const side of [-1,1]){rod([side*width*.40,7.5+lift,z],[side*width*.48,7.73+lift,z],.13,red,decor);
    const lantern=add(new THREE.SphereGeometry(narrow?.30:.42,20,14),new THREE.MeshStandardMaterial({color:'#f7dbaa',roughness:.62,emissive:'#ffb875',emissiveIntensity:.6}),side*width*.40,5.35+lift,z+.3,decor);lantern.scale.y=1.35;
    rod([side*width*.40,7.5+lift,z],[side*width*.40,5.92+lift,z],.018,bronze,decor);for(let k=0;k<8;k++){const a=k/8*Math.PI*2,r=narrow?.31:.43;rod([side*width*.40+Math.cos(a)*r,5.65+lift,z+.3+Math.sin(a)*r],[side*width*.40+Math.cos(a)*r*.8,5.04+lift,z+.3+Math.sin(a)*r*.8],.008,bronze,decor);}
   }
  }batchRods(decor);
 }
 function makeEffects(){const bubbleMaterial=new THREE.MeshPhysicalMaterial({color:'#f5efff',roughness:.02,transmission:0,thickness:.018,ior:1.15,iridescence:1,clearcoat:1,transparent:true,opacity:.28,depthWrite:false});
  bubbleMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','float petBubbleRim=pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),2.0);vec3 petThinFilm=.55+.45*cos(vec3(0.,2.1,4.2)+normal.y*8.+normal.x*3.);outgoingLight+=petThinFilm*petBubbleRim*3.0;\n#include <opaque_fragment>');};
  for(let i=0;i<14;i++){const b=add(new THREE.SphereGeometry(1,16,12),bubbleMaterial,0,0,0,effects);b.visible=false;bubbles.push(b);}

 }
 async function setTheme(next){const changed=next!==theme;theme=next;if(changed&&narrow!==null)setLayout(narrow,true);const token=++themeRevision,texture=await textureFor(new URL(`../../assets/band-stage-v3/${theme}.webp`,import.meta.url).href);if(disposed||token!==themeRevision)return;
  if(screen){screen.material.map?.dispose();const map=texture.clone(),sourceAspect=texture.image.width/texture.image.height,targetAspect=screen.geometry.parameters.width/screen.geometry.parameters.height;
   if(sourceAspect>targetAspect){map.repeat.x=targetAspect/sourceAspect;map.offset.x=(1-map.repeat.x)/2;}else{map.repeat.y=sourceAspect/targetAspect;map.offset.y=(1-map.repeat.y)/2;}map.userData.stageBackdrop=true;map.needsUpdate=true;screen.material.map=map;screen.material.needsUpdate=true;}
  const old=root.getObjectByName('theme-decor');if(old){disposeTree(old);root.remove(old);}decorations();onChange();
 }
 function setLayout(value,force=false){if(narrow===value&&!force)return;narrow=value;disposeTree(root);glass=[];lamps=[];beams=[];glows=[];emissives=[];const s=stageSpec(narrow),p=palettes[theme],m=prismMaterial();fountains.setLayout(narrow);
  const floor=add(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:'#111b28',metalness:.36,roughness:.40,envMapIntensity:.8}),0,-.5,4);floor.rotation.x=-Math.PI/2;
  for(let level=0;level<s.levels;level++){const top=.35+level*s.step,base=top-s.step;glass.push(add(slab(s,level,s.step),m,0,base,s.back));
   const under=new THREE.MeshStandardMaterial({color:new THREE.Color(p.glass).multiplyScalar(.27),metalness:.42,roughness:.24,emissive:new THREE.Color(p.cool).multiplyScalar(.055),emissiveIntensity:1.0,envMapIntensity:.85});
   add(slab(s,level,.045,false),under,0,base+.10,s.back);emissives.push(under);edge(s,level,top);
   const y=base+.12,w=narrow?s.widths[level]:s.radii[level]*2;
   for(const side of [-1,1]){box(.12,s.step-.14,.5,steel(),side*(w/2-.45),y+(s.step-.14)/2,s.back+.45);}
  }
  const width=s.width+1.2,back=s.back-1.2,wall=new THREE.MeshStandardMaterial({color:p.wall,roughness:.84});box(width+5,narrow?15.2:11.5,.55,wall,0,narrow?7:4.8,back-.35);
  screen=add(new THREE.PlaneGeometry(narrow?11.6:23.2,narrow?11.2:8.2),new THREE.MeshBasicMaterial({color:'#c4d0df',toneMapped:false}),0,narrow?6.8:4.7,back+.035);
  const frame=new THREE.EdgesGeometry(new THREE.BoxGeometry(narrow?11.75:23.4,narrow?11.35:8.35,.12)),outline=new THREE.LineSegments(frame,new THREE.LineBasicMaterial({color:'#b5aa97',transparent:true,opacity:.65}));outline.position.copy(screen.position);root.add(outline);
  const brass=metal();for(const side of [-1,1]){curtain(side*(width/2-.75),narrow?1.7:3.4,narrow?14.3:10.2,back+.8,p.curtain);
   box(.14,narrow?14.4:10.3,.2,brass,side*(width/2+.12),narrow?6.5:4.5,back+1);speaker(side*(s.width/2+.13),3.5,back+1.7,narrow?.66:1.1);speaker(side*(s.width/2+.13),1.9,back+1.7,narrow?.66:1.1);
   rod([side*(s.width/2+.13),4.4,back+1.7],[side*(s.width/2+.13),s.rigHeight,back+.5],.022,steel());
   const monitorX=side*(narrow?5.8:9.9),monitorZ=narrow?s.front-.55:s.back+Math.sqrt(s.radii[0]**2-monitorX**2)-.6;monitor(monitorX,monitorZ);
   const ampX=side*(narrow?6:11.7),ampZ=narrow?-.4:.5;box(narrow?.75:1.2,.70,.55,steel(),ampX,stageHeightAt(ampX,ampZ,narrow)+.40,ampZ);
   const light=new THREE.PointLight(side<0?p.cool:p.warm,12,narrow?13:20,2);light.position.set(side*(s.width/2-.5),1.4,2.5);root.add(light);glow(side*(s.width/2-.5),.3,narrow?s.front+.3:s.back+6,side<0?p.cool:p.warm,.7);
  }
  box(width+.5,.16,.22,brass,0,s.rigHeight+.55,back+1);truss(width,s.rigHeight,back+.5);batchRods(root);setTheme(theme).catch(console.warn);
 }
 function update(time,fx,reduced=false,lighting={lift:.55,climax:0},viewportHeight=650){const s=stageSpec(narrow),amount=reduced?0:fx.intensity,lastLift=lighting.lift;lastLighting={lift:lastLift,climax:lighting.climax};
  emissives.forEach((m,i)=>{if(m.isMeshBasicMaterial)m.opacity=.16+lastLift*.20+(lighting.climax||0)*.08;else m.emissiveIntensity=.65+lastLift*.85;});
  if(screen)screen.material.color.setScalar(.68+lastLift*.20);
  lamps.forEach((lamp,i)=>{lamp.intensity=65+lastLift*42+(lighting.impact||0)*35;lamp.target.position.x=(i?1:-1)*(narrow?2.5:5)+(reduced?0:Math.sin(time*.23+i)*1.2*lastLift);});
  glows.forEach((g,i)=>g.material.opacity=.35+lastLift*.35+(reduced?0:Math.sin(time*.5+i)*.04));
  beams.forEach((b,i)=>{const target=b.to.clone();target.x+=reduced?0:Math.sin(time*.24+i)*1.1*lastLift;const d=b.from.clone().sub(target);b.mesh.position.copy(b.from).add(target).multiplyScalar(.5);b.mesh.scale.y=d.length();b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());b.mesh.material.uniforms.opacity.value=.028+lastLift*.050+lighting.climax*.036;});
  bubbles.forEach((b,i)=>{b.visible=amount>.02;if(!b.visible)return;const age=(time*.34+i*.57)%4.3,side=i%2?1:-1;b.position.set(side*(s.width*.40+Math.sin(i+time*.27)*.35),3+age*1.05,narrow?-2.6-i%3*.65:1+i%3);b.scale.setScalar((.19+i%4*.08)*(.75+amount*.25));});
  fountains.update(time,fx,reduced,viewportHeight);
 }
 makeEffects();return {setLayout,setTheme,update,refreshMaterial(){const m=prismMaterial(),old=new Set(glass.map(o=>o.material));glass.forEach(o=>o.material=m);old.forEach(o=>o.dispose());},get diagnostics(){return {shape:stageSpec(narrow).shape,levels:stageSpec(narrow).levels,material:glass[0]?.material.userData.family||'prism',decorations:root.getObjectByName('theme-decor')?.children.length||0,bubbles:bubbles.filter(o=>o.visible).length,fireworks:fountains.diagnostics.visible,pyro:'fountains',fountains:fountains.diagnostics,bubbleTransmission:0,lighting:lastLighting,shafts:beams.length};},dispose(){disposed=true;disposeTree(root);disposeTree(effects);lightTexture.dispose();scene.remove(root,effects);}};
}
