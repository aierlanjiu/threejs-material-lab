import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';
import {stageSpec,stageHeightAt} from '../audio/band-stage-layout.js';

export function createConcertStage(scene,{createMaterial,textureFor,onChange=()=>{}}={}){
 const root=new THREE.Group(),effects=new THREE.Group();scene.add(root,effects);
 let narrow=null,theme='one-piece',screen=null,glass=[],lamps=[],bubbles=[],bursts=[],disposed=false,themeRevision=0;
 const steel=()=>new THREE.MeshStandardMaterial({color:'#20222a',metalness:.78,roughness:.4});
 const metal=()=>new THREE.MeshStandardMaterial({color:'#b1a797',metalness:.82,roughness:.28});
 const add=(geometry,material,x=0,y=0,z=0,parent=root)=>{
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
 };
 const box=(w,h,d,mat,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
 function rod(a,b,r=.035,material=steel(),parent=root){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),direction=to.clone().sub(from);
  const mesh=add(new THREE.CylinderGeometry(r,r,direction.length(),8),material,0,0,0,parent);
  mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return mesh;
 }
 function disposeTree(group){const geometries=new Set(),materials=new Set();group.traverse(o=>{
  if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);
 });geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();}
 function halfDisc(radius,height){
  const shape=new THREE.Shape();shape.moveTo(-radius,0);shape.absarc(0,0,radius,Math.PI,2*Math.PI,false);shape.lineTo(-radius,0);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:72});geometry.rotateX(-Math.PI/2);return geometry;
 }
 function rim(points){
  const geometry=new THREE.BufferGeometry().setFromPoints(points),colors=[];
  points.forEach((p,i)=>{const c=new THREE.Color().setHSL((i/points.length*.8+.53)%1,.48,.78);colors.push(c.r,c.g,c.b);});
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.65}));root.add(line);
 }
 function embeddedSpectrum(spec,level,top,front){
  const positions=[],colors=[],indices=[],count=64;
  for(let i=0;i<=count;i++){
   const t=i/count,angle=t*Math.PI,radius=(spec.radii?.[level]||0)-.045;
   const x=narrow?(t-.5)*spec.width:Math.cos(angle)*radius,z=narrow?front-.045:spec.back+Math.sin(angle)*radius;
   const c=new THREE.Color().setHSL((t*.78+level*.17+.52)%1,.55,.27);
   for(const y of [top-.34,top-.16]){positions.push(x,y,z);colors.push(c.r,c.g,c.b);}
   if(i<count){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);
  const light=add(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}),0,0,0);light.name='embedded-spectrum-light';light.receiveShadow=false;
 }
 function curtain(x,width,height,z,color){
  const geometry=new THREE.PlaneGeometry(width,height,40,16),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const u=p.getX(i)/width,v=p.getY(i)/height;p.setZ(i,Math.sin(u*Math.PI*18)*.18+Math.sin(v*3+u*7)*.055);}
  geometry.computeVertexNormals();return add(geometry,new THREE.MeshPhysicalMaterial({color,roughness:.95,sheen:1,sheenColor:new THREE.Color('#bc7b64'),sheenRoughness:.8,side:THREE.DoubleSide}),x,height/2-.4,z);
 }
 function truss(width,y,z){
  const m=steel(),depth=.5;
  for(const yy of [y,y+depth])for(const zz of [z,z+depth])rod([-width/2,yy,zz],[width/2,yy,zz],.06,m);
  for(let x=-width/2;x<width/2;x+=1.4){const end=Math.min(width/2,x+1.4);
   rod([x,y,z],[end,y+depth,z],.035,m);rod([x,y+depth,z+depth],[end,y,z+depth],.035,m);
   rod([x,y,z],[x,y+depth,z+depth],.035,m);}
  for(const side of [-1,1]){const x=side*width/2;rod([x,-.4,z],[x,y+.5,z],.10,m);rod([x+.35,-.4,z],[x+.35,y+.5,z],.10,m);
   for(let yy=0;yy<y;yy+=1.2)rod([x,yy,z],[x+.35,yy+1.2,z],.04,m);}
  for(let i=0;i<8;i++){
   const x=(i/7-.5)*(width-2),housing=box(.48,.3,.4,m,x,y-.16,z+.25);
   const head=add(new THREE.CylinderGeometry(.19,.23,.42,16),m,x,y-.5,z+.5);head.rotation.x=.55;
   const lens=add(new THREE.CircleGeometry(.15,16),new THREE.MeshBasicMaterial({color:i%2?'#8dd8e8':'#ffd297'}),x,y-.64,z+.70);lens.rotation.x=.55;
   if(i===1||i===6){const light=new THREE.SpotLight(i%2?0xffd6a2:0x94dbea,55,60,.65,.86,1.5);light.position.set(x,y-.55,z+.8);light.target.position.set(x*.4,.8,narrow?0:3);root.add(light,light.target);lamps.push(light);}
   housing.castShadow=true;
  }
 }
 function speaker(x,y,z,scale=1){
  const m=new THREE.MeshStandardMaterial({color:'#17191e',roughness:.9});const body=box(.95*scale,1.65*scale,.65*scale,m,x,y,z);
  for(const yy of [-.38,.38]){
   const cone=add(new THREE.CircleGeometry(.31*scale,24),new THREE.MeshStandardMaterial({color:'#31333a',roughness:.92}),x,y+yy*scale,z+.331*scale);
   add(new THREE.CircleGeometry(.12*scale,16),steel(),x,y+yy*scale,z+.34*scale);cone.castShadow=true;
  }
  box(.66*scale,.09*scale,.04*scale,metal(),x,y+.64*scale,z+.34*scale);body.castShadow=true;return body;
 }
 function monitor(x,z){
  const floor=stageHeightAt(x,z,narrow);
  const body=box(1.6,.72,1.1,new THREE.MeshStandardMaterial({color:'#15171c',roughness:.85}),x,floor+.43,z);body.rotation.x=-.28;body.castShadow=true;
  const grille=box(1.42,.025,.88,new THREE.MeshStandardMaterial({color:'#383b43',roughness:.96}),x,floor+.83,z-.10);grille.rotation.x=-.28;
  for(let i=0;i<7;i++)rod([x-.65+i*.21,floor+.83,z-.47],[x-.65+i*.21,floor+.61,z+.35],.012,steel());
 }
 function cable(points){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  add(new THREE.TubeGeometry(curve,32,.025,6,false),new THREE.MeshStandardMaterial({color:'#17151a',roughness:.95}));}
 function decorations(){
  const decor=new THREE.Group();decor.name='theme-decor';root.add(decor);const width=narrow?7.7:22,z=narrow?-11.3:-5.8;
  if(theme==='one-piece'){
   const fabric=new THREE.MeshPhysicalMaterial({color:'#e9ddc0',roughness:.86,side:THREE.DoubleSide,sheen:.45});
   for(const side of [-1,1]){
    const x=side*width*.28;rod([x,2.3,z],[x,7.7,z],.075,new THREE.MeshStandardMaterial({color:'#735539',roughness:.65}),decor);
    rod([x-width*.15,7.1,z],[x+width*.15,7.1,z],.045,metal(),decor);
    const geometry=new THREE.PlaneGeometry(width*.31,3.6,18,14),p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){const u=p.getX(i)/(width*.31),v=p.getY(i)/3.6;p.setX(i,p.getX(i)*(1-.18*(v+.5)));p.setZ(i,Math.cos(u*Math.PI)*Math.sin((v+.5)*Math.PI)*.58);}
    geometry.computeVertexNormals();add(geometry,fabric,x,5.2,z+.03,decor);
    rod([x-width*.15,7.1,z],[x,3.4,z],.014,metal(),decor);rod([x+width*.15,7.1,z],[x,3.4,z],.014,metal(),decor);
   }
  }else if(theme==='dragon-ball'){
   const points=Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI)*width*.4,2.2+Math.sin(i/64*Math.PI)*5,z));
   add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,.10,10,false),new THREE.MeshStandardMaterial({color:'#b99047',metalness:.65,roughness:.3}),0,0,0,decor);
   for(let i=0;i<7;i++){const angle=(i+.5)/7*Math.PI;const orb=add(new THREE.SphereGeometry(.3,20,14),new THREE.MeshPhysicalMaterial({color:'#edb568',transmission:.35,roughness:.15,clearcoat:1,emissive:'#ba6922',emissiveIntensity:.15}),Math.cos(angle)*width*.4,2.2+Math.sin(angle)*5,z,decor);
    const star=new THREE.Shape();for(let k=0;k<10;k++){const a=k/10*Math.PI*2,r=k%2?.055:.13;k?star.lineTo(Math.sin(a)*r,Math.cos(a)*r):star.moveTo(0,r);}star.closePath();add(new THREE.ShapeGeometry(star),new THREE.MeshBasicMaterial({color:'#ad4230'}),orb.position.x,orb.position.y,z+.30,decor);}
  }else{
   const red=new THREE.MeshStandardMaterial({color:'#a64b3c',roughness:.58});
   for(const side of [-1,1])rod([side*width*.32,2,z],[side*width*.32,7.25,z],.13,red,decor);
   const upper=add(new THREE.BoxGeometry(width*.85,.26,.40),red,0,7.3,z,decor);add(new THREE.BoxGeometry(width*.72,.18,.30),red,0,6.7,z,decor);upper.castShadow=true;
   for(const side of [-1,1]){rod([side*width*.41,7.3,z],[side*width*.47,7.55,z],.11,red,decor);
    const lantern=add(new THREE.SphereGeometry(.30,20,16),new THREE.MeshStandardMaterial({color:'#eddbad',roughness:.8,emissive:'#cb8b41',emissiveIntensity:.25}),side*width*.35,5.4,z+.3,decor);lantern.scale.y=1.4;rod([side*width*.35,6.7,z],[side*width*.35,5.8,z],.015,metal(),decor);}
  }
 }
 function makeEffects(){
  const bubbleMaterial=new THREE.MeshPhysicalMaterial({color:'#f5efff',roughness:.015,metalness:0,transmission:.92,thickness:.018,ior:1.15,iridescence:1,iridescenceIOR:1.3,iridescenceThicknessRange:[100,520],clearcoat:1,transparent:true,opacity:.2,depthWrite:false});
  bubbleMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
   'float petBubbleRim=pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),2.0); vec3 petThinFilm=.55+.45*cos(vec3(0.,2.1,4.2)+normal.y*8.+normal.x*3.); outgoingLight+=petThinFilm*petBubbleRim*2.5;\n#include <opaque_fragment>');};
  for(let i=0;i<18;i++){const bubble=add(new THREE.SphereGeometry(1,20,14),bubbleMaterial,0,0,0,effects);bubble.visible=false;bubbles.push(bubble);}
  for(let i=0;i<3;i++){
   const geometry=new THREE.BufferGeometry(),positions=new Float32Array(72*6),colors=new Float32Array(72*6);
   for(let k=0;k<72;k++){const c=new THREE.Color().setHSL(k/72,.60,.72);for(let end=0;end<2;end++)colors.set([c.r,c.g,c.b],k*6+end*3);}
   geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
   const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));effects.add(lines);bursts.push(lines);
  }
 }
 async function setTheme(next){theme=next;const token=++themeRevision;
  const texture=await textureFor(new URL(`../../assets/backgrounds/lu-intro-d-${theme}-wide.png`,import.meta.url).href);
  if(disposed||token!==themeRevision)return;
  if(screen){screen.material.map=texture;screen.material.needsUpdate=true;}
  const old=root.getObjectByName('theme-decor');if(old){disposeTree(old);root.remove(old);}decorations();
  onChange();
 }
 function setLayout(value){if(narrow===value)return;narrow=value;disposeTree(root);glass=[];lamps=[];
  const spec=stageSpec(narrow),m=createMaterial();
  const floor=add(new THREE.PlaneGeometry(240,240),new THREE.MeshBasicMaterial({color:'#09080d'}),0,-.52,4);floor.rotation.x=-Math.PI/2;
  for(let level=0;level<spec.levels;level++){
   const top=.35+level*spec.step,front=spec.front-level*4.4;
   const geometry=narrow?new THREE.BoxGeometry(spec.width,spec.step,front-spec.back):halfDisc(spec.radii[level],spec.step);
   const platform=add(geometry,m,0,narrow?top-spec.step/2:top-spec.step,narrow?(front+spec.back)/2:spec.back);glass.push(platform);
   embeddedSpectrum(spec,level,top,front);
   // A narrow reflective strip exposes the prism's spectral edge under stage lighting.
   const stripeColors=['#d9b88a','#85b4c5','#b09abd','#adc396'];
   if(narrow){box(spec.width,.09,.035,new THREE.MeshStandardMaterial({color:stripeColors[level%4],metalness:.85,roughness:.2,emissive:stripeColors[level%4],emissiveIntensity:.08}),0,top-.20,front+.025);}
   if(narrow){rim([new THREE.Vector3(-spec.width/2,top+.012,spec.back),new THREE.Vector3(-spec.width/2,top+.012,front),new THREE.Vector3(spec.width/2,top+.012,front),new THREE.Vector3(spec.width/2,top+.012,spec.back)]);
    box(spec.width,.08,.07,metal(),0,top-.12,front+.015);
   }else{rim(Array.from({length:97},(_,i)=>new THREE.Vector3(Math.cos(i/96*Math.PI)*spec.radii[level],top+.012,spec.back+Math.sin(i/96*Math.PI)*spec.radii[level])));}
  }
  const backZ=narrow?-12.8:-6.6,width=spec.width+2;
  box(width,9.7,.5,new THREE.MeshStandardMaterial({color:'#17121a',roughness:.95}),0,4.2,backZ-.25);
  screen=add(new THREE.PlaneGeometry(narrow?9.2:26,6.8),new THREE.MeshBasicMaterial({color:'#9298a4',toneMapped:true}),0,4.5,backZ+.04);
  const frame=new THREE.EdgesGeometry(new THREE.BoxGeometry(narrow?9.4:26.2,7,.10));const lines=new THREE.LineSegments(frame,new THREE.LineBasicMaterial({color:'#a08b65'}));lines.position.copy(screen.position);root.add(lines);
  for(const side of [-1,1]){
   curtain(side*(width/2-1.2),narrow?1.8:3.5,9.3,backZ+.7,theme==='naruto'?'#6f2d36':'#613932');
   speaker(side*(spec.width/2+.5),3.7,backZ+2,narrow?.85:1.3);speaker(side*(spec.width/2+.5),1.8,backZ+2,narrow?.85:1.3);
   rod([side*(spec.width/2+.5),5,backZ+2],[side*(spec.width/2+.5),8.6,backZ+.5],.026,steel());
   const monitorX=side*(narrow?4.8:8.5),monitorZ=narrow?spec.front-.7:spec.back+Math.sqrt(spec.radii[0]**2-monitorX**2)-.7;
   monitor(monitorX,monitorZ);
   const ampX=side*(narrow?5.4:13),ampZ=narrow?-2:1;
   box(narrow?1.1:1.7,.95,.65,steel(),ampX,stageHeightAt(ampX,ampZ,narrow)+.48,ampZ);
   cable([[side*2,.38,spec.front-1],[side*4,.38,spec.front-.3],[side*(spec.width/2-.5),.38,2],[side*(spec.width/2-.5),.38,backZ+2]]);
  }
  truss(width,8.6,backZ+.5);
  // Warm footlights reveal the glass thickness without flooding performer faces.
  for(let i=0;i<6;i++){const x=(i/5-.5)*spec.width*.82,z=narrow?spec.front+.7:spec.back+Math.sqrt(spec.radii[0]**2-x*x)+.7;
   add(new THREE.CylinderGeometry(.13,.19,.16,12),steel(),x,-.43,z);
   if(i===1||i===4){const light=new THREE.PointLight(i%2?0x80d0e3:0xffca8b,4,12,2);light.position.set(x,.1,z-.4);root.add(light);}}
  setTheme(theme).catch(console.warn);
 }
 function update(time,fx,reduced=false){
  const spec=stageSpec(narrow),amount=reduced?0:fx.intensity;
  bubbles.forEach((bubble,i)=>{bubble.visible=amount>.02;if(!bubble.visible)return;
   const age=(time*.34+i*.57)%5,side=i%2?1:-1;
   bubble.position.set(side*(spec.width*.43+Math.sin(i+time*.27)*.7),2.8+age*1.2,narrow?-2-i%3*3:2+i%3);
   const size=.18+(i%4)*.09;bubble.scale.setScalar(size*(.75+amount*.25));});
  bursts.forEach((lines,i)=>{const start=reduced?undefined:fx.bursts[i];lines.visible=start!==undefined;if(!lines.visible)return;
   const age=time-start,positions=lines.geometry.attributes.position;const side=(Math.floor(start)+i)%2?1:-1;
   const origin=new THREE.Vector3(side*spec.width*.44,narrow?8.4:6.2,narrow?-10:-2);
   for(let k=0;k<72;k++){const angle=k/72*Math.PI*2,stretch=.65+((k*17)%19)/40;
    for(let end=0;end<2;end++){const t=Math.max(0,age-(end?.13:0)),radius=t*2.8*stretch*(narrow?.38:1);
     positions.setXYZ(k*2+end,origin.x+Math.cos(angle)*radius,origin.y+Math.sin(angle)*radius-age*age*.44,origin.z+Math.sin(k*2.31)*radius*.08);}}
   positions.needsUpdate=true;lines.material.opacity=Math.max(0,1-age/2.6)*.78;});
  lamps.forEach((lamp,i)=>lamp.intensity=48+amount*12+(reduced?0:(Math.sin(time*.7+i)*.5+.5)*3));
 }
 makeEffects();
 return {setLayout,setTheme,update,refreshMaterial(){const next=createMaterial(),old=new Set(glass.map(m=>m.material));glass.forEach(m=>m.material=next);old.forEach(m=>m.dispose());},
  get diagnostics(){return {shape:stageSpec(narrow).shape,levels:stageSpec(narrow).levels,material:glass[0]?.material.userData.family||'prism',decorations:root.getObjectByName('theme-decor')?.children.length||0,bubbles:bubbles.filter(b=>b.visible).length,fireworks:bursts.filter(b=>b.visible).length};},
  dispose(){disposed=true;disposeTree(root);disposeTree(effects);scene.remove(root,effects);}};
}
