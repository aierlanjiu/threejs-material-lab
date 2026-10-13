import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/+esm';

export function applySurfaceContent(material, texture, craft, scale, bounds) {
  // Content is shaded on the actual cube: shared silhouette, normals, lighting and depth.
  const faces = Array.isArray(texture);
  const inkFragment = faces ? `
      vec2 inkUV; vec4 ink; float faceNormal;
      if(abs(vLuNormal.x)>abs(vLuNormal.y)&&abs(vLuNormal.x)>abs(vLuNormal.z)) {
        inkUV=vec2(vLuNormal.x>0.0?-vLuPosition.z:vLuPosition.z,vLuPosition.y)/luInkScale+0.5;
        ink=vLuNormal.x>0.0?texture2D(luInkPX,inkUV):texture2D(luInkNX,inkUV);
        faceNormal=abs(vLuNormal.x);
      } else if(abs(vLuNormal.y)>abs(vLuNormal.z)) {
        inkUV=vec2(vLuPosition.x,vLuNormal.y>0.0?-vLuPosition.z:vLuPosition.z)/luInkScale+0.5;
        ink=vLuNormal.y>0.0?texture2D(luInkPY,inkUV):texture2D(luInkNY,inkUV);
        faceNormal=abs(vLuNormal.y);
      } else {
        inkUV=vec2(vLuNormal.z>0.0?vLuPosition.x:-vLuPosition.x,vLuPosition.y)/luInkScale+0.5;
        ink=vLuNormal.z>0.0?texture2D(luInkPZ,inkUV):texture2D(luInkNZ,inkUV);
        faceNormal=abs(vLuNormal.z);
      }
      float inkMask=step(0.0,inkUV.x)*step(inkUV.x,1.0)*step(0.0,inkUV.y)*step(inkUV.y,1.0);
      float inkCoverage=ink.a*inkMask*smoothstep(0.75,0.98,faceNormal);` : `
      vec2 inkUV=vLuPosition.xy/luInkScale+0.5;
      if(vLuNormal.z<0.0) inkUV.x=1.0-inkUV.x;
      float inkMask=step(0.0,inkUV.x)*step(inkUV.x,1.0)*step(0.0,inkUV.y)*step(inkUV.y,1.0);
      inkUV=mix(luInkBounds.xz,luInkBounds.yw,inkUV);
      vec4 ink=texture2D(luInkMap,inkUV);
      float inkCoverage=ink.a*inkMask*smoothstep(0.75,0.98,vLuNormal.z);`;
  material.userData.surfaceTexture=texture;
  const bindInkUniforms = uniforms => {
    if(faces) ['PX','NX','PY','NY','PZ','NZ'].forEach((face,index)=>{
      const name=`luInk${face}`;
      if(uniforms[name]) uniforms[name].value=texture[index];
      else uniforms[name]={value:texture[index]};
    });
    else if(uniforms.luInkMap) uniforms.luInkMap.value=texture;
    else uniforms.luInkMap={value:texture};
  };
  if(material.userData.surfaceUniforms) bindInkUniforms(material.userData.surfaceUniforms);
  material.customProgramCacheKey=()=>`lu-surface-v2-${craft}-${faces?'six':'front'}`;
  material.onBeforeCompile=shader=>{
    bindInkUniforms(shader.uniforms);
    material.userData.surfaceUniforms=Object.fromEntries(
      Object.entries(shader.uniforms).filter(([name])=>name.startsWith('luInk')));
    shader.uniforms.luInkScale={value:scale};
    shader.uniforms.luInkBounds={value:new THREE.Vector4(...bounds)};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      varying vec3 vLuPosition; varying vec3 vLuNormal;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vLuPosition=position; vLuNormal=normal;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      ${faces?'uniform sampler2D luInkPX,luInkNX,luInkPY,luInkNY,luInkPZ,luInkNZ;':'uniform sampler2D luInkMap;'}
      uniform float luInkScale; uniform vec4 luInkBounds;
      varying vec3 vLuPosition; varying vec3 vLuNormal;`)
      .replace('#include <map_fragment>',`#include <map_fragment>
      ${inkFragment}
      ${craft==='hologram'?`vec3 holoView=normalize(vViewPosition);
      float holoPhase=(vLuPosition.x+vLuPosition.y)*32.0+holoView.x*8.0+holoView.y*5.0;
      ink.rgb=mix(ink.rgb,0.5+0.5*cos(vec3(0.0,2.1,4.2)+holoPhase),0.55);`:''}
      diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb,inkCoverage);
      diffuseColor.a=mix(diffuseColor.a,1.0,inkCoverage);`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      totalEmissiveRadiance+=ink.rgb*inkCoverage*${craft==='hologram'?'0.48':'0.12'};`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,${craft==='emboss'?'0.48':'0.24'},inkCoverage);`)
      .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      metalnessFactor*=1.0-inkCoverage*0.92;`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      ${craft==='emboss'?'normal=normalize(normal-vec3(dFdx(inkCoverage),dFdy(inkCoverage),0.0)*0.12);':''}`)
      .replace('#include <transmission_fragment>',THREE.ShaderChunk.transmission_fragment.replace(
        'material.transmission = transmission;',
        'material.transmission = transmission * (1.0 - inkCoverage * 0.96);'));
  };
  material.needsUpdate=true;
}

