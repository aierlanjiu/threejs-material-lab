"""Export the shared stage geometry to GLB without requiring a graphics device.

This produces a real mesh asset that Blender can import. It does not create or
claim a native .blend scene; build-shell-concert.py creates that in Blender.
"""
from array import array
from datetime import date
from pathlib import Path
import hashlib
import json
import struct
import sys

from shell_concert_geometry import MATERIALS, CAST, build_stage, build_environment, linear_color

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/models/band-shell-concert'


def yup(v):
    return (v[0], v[2], -v[1])


def export_geometry(source, filename):
    doc = dict(asset=dict(version='2.0', generator='Lu shell-concert procedural geometry'),
               scene=0, scenes=[dict(name='Pearl shell concert', nodes=[0])],
               nodes=[], meshes=[], materials=[], accessors=[], bufferViews=[], buffers=[])
    binary = bytearray()
    used_extensions = set()

    def accessor(values, dtype, shape, target, bounds=False):
        while len(binary)%4:
            binary.append(0)
        start = len(binary)
        packed = array(dtype, values)
        if sys.byteorder != 'little':
            packed.byteswap()
        binary.extend(packed.tobytes())
        view = len(doc['bufferViews'])
        doc['bufferViews'].append(dict(buffer=0, byteOffset=start, byteLength=len(binary)-start, target=target))
        size = dict(SCALAR=1, VEC3=3)[shape]
        entry = dict(bufferView=view, componentType=5126 if dtype == 'f' else 5125, count=len(values)//size, type=shape)
        if bounds:
            entry['min'] = [min(values[i::size]) for i in range(size)]
            entry['max'] = [max(values[i::size]) for i in range(size)]
        result = len(doc['accessors'])
        doc['accessors'].append(entry)
        return result

    material_indices = {}
    for m in MATERIALS:
        color = linear_color(m['color'])
        entry = dict(name=m['name'], pbrMetallicRoughness=dict(baseColorFactor=color+[1], metallicFactor=m['metallic'], roughnessFactor=m['roughness']),
                     doubleSided=False, extensions={'KHR_materials_clearcoat': dict(clearcoatFactor=m.get('coat',.32), clearcoatRoughnessFactor=m.get('coat_roughness',.19))})
        if m.get('transmission'):
            entry['extensions']['KHR_materials_transmission'] = dict(transmissionFactor=m['transmission'])
            entry['extensions']['KHR_materials_ior'] = dict(ior=1.46)
        if m.get('iridescence'):
            entry['extensions']['KHR_materials_iridescence'] = dict(iridescenceFactor=m['iridescence'], iridescenceIor=1.3, iridescenceThicknessMinimum=m.get('film_thickness',450), iridescenceThicknessMaximum=m.get('film_thickness',450))
        if m.get('emission'):
            entry['emissiveFactor'] = linear_color(m.get('emission_color',m['color']))
            entry['extensions']['KHR_materials_emissive_strength'] = dict(emissiveStrength=m['emission'])
        used_extensions.update(entry['extensions'])
        material_indices[m['id']] = len(doc['materials'])
        doc['materials'].append(entry)

    node_indices = {n['name']: i for i, n in enumerate(source)}
    for n in source:
        result = dict(name=n['name'], translation=list(yup(n['position'])))
        if n.get('extras'):
            result['extras'] = n['extras']
        if n.get('geometry'):
            geo = n['geometry']
            positions = [value for v in geo['vertices'] for value in yup(v)]
            ns = [value for v in geo['normals'] for value in yup(v)]
            attrs = dict(POSITION=accessor(positions, 'f', 'VEC3', 34962, True), NORMAL=accessor(ns, 'f', 'VEC3', 34962))
            primitives = []
            for local_material, key in enumerate(geo['materials']):
                indices = [i for f, mat in zip(geo['faces'], geo['face_materials']) if mat == local_material for i in f]
                if indices:
                    primitives.append(dict(attributes=attrs, indices=accessor(indices, 'I', 'SCALAR', 34963), material=material_indices[key], mode=4))
            result['mesh'] = len(doc['meshes'])
            doc['meshes'].append(dict(name=n['name'], primitives=primitives))
        doc['nodes'].append(result)
    for n in source:
        if n['parent']:
            doc['nodes'][node_indices[n['parent']]].setdefault('children', []).append(node_indices[n['name']])
    doc['buffers'].append(dict(byteLength=len(binary)))
    doc['extensionsUsed'] = sorted(used_extensions)
    text = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode()
    text += b' '*((-len(text))%4)
    binary += b'\x00'*((-len(binary))%4)
    payload = struct.pack('<4sII', b'glTF', 2, 12+8+len(text)+8+len(binary))
    payload += struct.pack('<I4s', len(text), b'JSON')+text
    payload += struct.pack('<I4s', len(binary), b'BIN\x00')+binary
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT/filename
    path.write_bytes(payload)
    triangles = sum(len(n.get('geometry', {}).get('faces', [])) for n in source)
    print(f'Exported {path.name}: {len(payload):,} bytes, {triangles:,} triangles, {len(source)} named nodes')
    return hashlib.sha256(payload).hexdigest()


def source_fingerprint():
    return hashlib.sha256(b''.join((ROOT/'scripts'/name).read_bytes()
                          for name in ('shell_concert_geometry.py','build-shell-concert.py'))).hexdigest()


def export():
    manifest_path=OUT/'manifest.json'
    previous=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    hashes={
        'shell-concert.glb':export_geometry(build_stage(),'shell-concert.glb'),
        'shell-concert-environment.glb':export_geometry(build_environment(),'shell-concert-environment.glb'),
    }
    hashes['sunset-sky.png']=hashlib.sha256((OUT/'sunset-sky.png').read_bytes()).hexdigest()
    blend=OUT/'shell-concert.blend'
    fingerprint=source_fingerprint()
    native=dict(status='stale' if blend.exists() else 'not-generated',
                reason='Native scene must be regenerated for the current geometry and lookdev sources')
    if (blend.exists() and previous.get('nativeBlend',{}).get('sourceFingerprint')==fingerprint
            and previous.get('sha256',{}).get(blend.name)==hashlib.sha256(blend.read_bytes()).hexdigest()):
        native=previous['nativeBlend']
        hashes[blend.name]=previous['sha256'][blend.name]
    manifest=dict(id='lu-shell-concert-v2',created=date.today().isoformat(),agent='codex',reference='selected-image-2',
                  model='shell-concert.glb',environmentModel='shell-concert-environment.glb',
                  sourceScript='../../../scripts/build-shell-concert.py',geometrySource='../../../scripts/shell_concert_geometry.py',
                  buildBackend='portable-python',nativeBlend=native,units='meters',upAxis='Y',
                  actorAnchors=[dict(id='one-piece/'+ident,node='Actor_'+ident,position=list(yup((x,y,z))),height=h,frame=frame)
                                for ident,_,x,y,z,h,frame in CAST],
                  features=['six broad cupped 7cm-thick acoustic shells','114 solid glass flutes',
                            'gold cradle and luminous 0.55m mother pearl','polished pearl terraces',
                            '2700K LED edges and eight pendant lights'],
                  previewCast='Existing ten 2.5D sprites, unchanged identity; no full 3D characters',
                  environment='Separate real foreground shells, floating pearls, islands and harbour lights; water/sky are renderer-specific',
                  skyTexture='sunset-sky.png',sourceFingerprint=fingerprint,sha256=hashes)
    if native['status']=='ready':
        manifest['source']=blend.name
        manifest['blenderVersion']=previous.get('blenderVersion')
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')


if __name__ == '__main__':
    export()
