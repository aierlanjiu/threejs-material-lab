"""Inspect the delivered GLB's real geometry, anchors and binary integrity."""
from pathlib import Path
import hashlib
import json
import math
import struct

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/models/band-shell-concert'
REVIEW = ROOT / 'output/shell-concert-20261029/detail-finish'


def multiply(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def matrix(node):
    if 'matrix' in node:
        return [[node['matrix'][j*4+i] for j in range(4)] for i in range(4)]
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    s = node.get('scale', [1, 1, 1])
    t = node.get('translation', [0, 0, 0])
    m = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w), t[0]],
         [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w), t[1]],
         [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y), t[2]],
         [0, 0, 0, 1]]
    for i in range(3):
        for j in range(3):
            m[i][j] *= s[j]
    return m


def inspect():
    data = (ASSET / 'shell-concert.glb').read_bytes()
    magic, version, length = struct.unpack_from('<4sII', data)
    assert magic == b'glTF' and version == 2 and length == len(data), 'Invalid GLB header'
    offset, doc, binary = 12, None, None
    while offset < length:
        size, kind = struct.unpack_from('<I4s', data, offset)
        payload = data[offset+8:offset+8+size]
        if kind == b'JSON':
            doc = json.loads(payload)
        elif kind == b'BIN\x00':
            binary = payload
        offset += size + 8
    assert doc and binary is not None and offset == length, 'Missing GLB chunks'
    assert len(binary) >= doc['buffers'][0]['byteLength'], 'Truncated binary buffer'
    manifest = json.loads((ASSET / 'manifest.json').read_text())
    names = {n.get('name'): i for i, n in enumerate(doc['nodes'])}
    assert len(manifest['actorAnchors']) == 10
    assert all(a['node'] in names for a in manifest['actorAnchors']), 'Missing actor anchors'
    assert len([n for n in names if n.startswith('Shell_') and n.endswith('_hinge')]) == 6, 'Missing independent shell hinges'
    assert not any(n.startswith('CastPreview_') for n in names), 'Preview cast leaked into stage asset'
    assert not doc.get('images'), 'Stage asset must contain geometry, not a flattened reference image'
    expected_hash = manifest['sha256']['shell-concert.glb']
    assert hashlib.sha256(data).hexdigest() == expected_hash, 'GLB manifest hash mismatch'
    blend = ASSET / 'shell-concert.blend'
    native_ready = manifest['nativeBlend']['status'] == 'ready'
    if native_ready:
        assert blend.stat().st_size > 100000
        assert hashlib.sha256(blend.read_bytes()).hexdigest() == manifest['sha256'][blend.name]
    else:
        assert not blend.exists() or manifest['nativeBlend']['status']=='stale', 'Existing unverified native scene must be marked stale'
        assert manifest['nativeBlend'].get('reason'), 'Missing native-scene limitation'
    assert (ASSET / manifest['sourceScript']).is_file(), 'Missing Blender builder'
    assert (ASSET / manifest['geometrySource']).is_file(), 'Missing shared geometry source'
    assert 'Mother_pearl_gold_shell_seat' in names and 'Mother_pearl_luminous_core' in names
    materials={m['name']:m for m in doc['materials']}
    jade=materials['Opalescent_seafoam_jade']['extensions']
    assert abs(jade['KHR_materials_transmission']['transmissionFactor']-.65)<1e-8
    assert abs(jade['KHR_materials_iridescence']['iridescenceFactor']-.45)<1e-8
    from shell_concert_geometry import linear_color
    actual=materials['Opalescent_seafoam_jade']['pbrMetallicRoughness']['baseColorFactor'][:3]
    assert all(abs(a-b)<1e-8 for a,b in zip(actual,linear_color('#cdebe0')))
    mother=materials['Luminous_mother_pearl']
    assert mother['extensions']['KHR_materials_emissive_strength']['emissiveStrength']==1.2
    assert mother['extensions']['KHR_materials_iridescence']['iridescenceFactor']==.6
    porcelain=materials['Polished_pearl_marble']
    assert porcelain['pbrMetallicRoughness']['roughnessFactor']==.06
    assert porcelain['extensions']['KHR_materials_clearcoat']=={'clearcoatFactor':1.0,'clearcoatRoughnessFactor':.03}
    assert materials['Opal_lantern_2700K']['extensions']['KHR_materials_emissive_strength']['emissiveStrength']==22
    assert materials['Iridescent_pearl']['extensions']['KHR_materials_emissive_strength']['emissiveStrength']==2.2
    gold=materials['Polished_champagne_gold']['pbrMetallicRoughness']
    assert gold['metallicFactor']==.95 and gold['roughnessFactor']==.12
    environment_path=ASSET/manifest['environmentModel']
    env_data=environment_path.read_bytes()
    assert hashlib.sha256(env_data).hexdigest()==manifest['sha256'][environment_path.name]
    env_magic,env_version,env_length=struct.unpack_from('<4sII',env_data)
    assert env_magic==b'glTF' and env_version==2 and env_length==len(env_data)
    env_json_length,kind=struct.unpack_from('<I4s',env_data,12)
    assert kind==b'JSON'
    env_doc=json.loads(env_data[20:20+env_json_length])
    env_names=[n.get('name','') for n in env_doc['nodes']]
    assert sum(n.startswith('Foreground_shell_') for n in env_names)==2
    assert sum(n.startswith('Lagoon_floating_pearl_') for n in env_names)==24
    assert sum(n.startswith('Harbour_island_') for n in env_names)==3
    assert sum('_window_' in n for n in env_names)==140
    assert not env_doc.get('images'), 'Environment decor must contain real meshes'
    for a in env_doc['accessors']:
        view=env_doc['bufferViews'][a['bufferView']]
        assert view.get('byteOffset',0)+view['byteLength']<=env_doc['buffers'][0]['byteLength']

    low, high = [math.inf]*3, [-math.inf]*3
    vertices = triangles = primitives = 0
    minimum_normal_length, maximum_normal_length = math.inf, 0
    identity = [[int(i == j) for j in range(4)] for i in range(4)]
    def visit(index, parent):
        nonlocal vertices, triangles, primitives, minimum_normal_length, maximum_normal_length
        node = doc['nodes'][index]
        transform = multiply(parent, matrix(node))
        if 'mesh' in node:
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                primitives += 1
                assert primitive.get('mode', 4) == 4
                assert 'NORMAL' in primitive['attributes']
                acc = doc['accessors'][primitive['attributes']['POSITION']]
                view = doc['bufferViews'][acc['bufferView']]
                assert acc['componentType'] == 5126 and acc['type'] == 'VEC3'
                start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
                stride = view.get('byteStride', 12)
                vertices += acc['count']
                index_count = doc['accessors'][primitive['indices']]['count'] if 'indices' in primitive else acc['count']
                assert index_count % 3 == 0
                triangles += index_count // 3
                norm_acc = doc['accessors'][primitive['attributes']['NORMAL']]
                norm_view = doc['bufferViews'][norm_acc['bufferView']]
                norm_start = norm_view.get('byteOffset', 0) + norm_acc.get('byteOffset', 0)
                assert norm_acc['componentType'] == 5126 and norm_acc['type'] == 'VEC3' and norm_acc['count'] == acc['count']
                for i in range(norm_acc['count']):
                    n = struct.unpack_from('<fff', binary, norm_start+i*norm_view.get('byteStride', 12))
                    length_n = math.sqrt(sum(v*v for v in n))
                    assert math.isfinite(length_n) and .999 < length_n < 1.001, 'Invalid surface normal'
                    minimum_normal_length = min(minimum_normal_length, length_n)
                    maximum_normal_length = max(maximum_normal_length, length_n)
                index_acc = doc['accessors'][primitive['indices']]
                index_view = doc['bufferViews'][index_acc['bufferView']]
                fmt = {5121:'B', 5123:'H', 5125:'I'}[index_acc['componentType']]
                index_start = index_view.get('byteOffset', 0)+index_acc.get('byteOffset', 0)
                index_stride = struct.calcsize(fmt)
                assert index_start+index_count*index_stride <= len(binary), 'Out-of-range index buffer'
                for i in range(0, index_count, 3):
                    indices = struct.unpack_from('<'+fmt*3, binary, index_start+i*index_stride)
                    assert len(set(indices)) == 3 and max(indices) < acc['count'], 'Invalid triangle index'
                    points = [struct.unpack_from('<fff', binary, start+j*stride) for j in indices]
                    u = [points[1][a]-points[0][a] for a in range(3)]
                    v = [points[2][a]-points[0][a] for a in range(3)]
                    area = (u[1]*v[2]-u[2]*v[1])**2+(u[2]*v[0]-u[0]*v[2])**2+(u[0]*v[1]-u[1]*v[0])**2
                    assert area > 1e-20, 'Zero-area triangle'
                for i in range(acc['count']):
                    p = struct.unpack_from('<fff', binary, start+i*stride)
                    assert all(math.isfinite(v) for v in p)
                    for axis in range(3):
                        value = sum(transform[axis][j]*p[j] for j in range(3)) + transform[axis][3]
                        low[axis], high[axis] = min(low[axis], value), max(high[axis], value)
        for child in node.get('children', []):
            visit(child, transform)
        if node.get('name', '').startswith('Actor_'):
            anchor = next(a for a in manifest['actorAnchors'] if a['node'] == node['name'])
            assert all(abs(transform[i][3]-anchor['position'][i]) < 1e-5 for i in range(3)), 'Actor placement mismatch'
    for root in doc['scenes'][doc.get('scene', 0)]['nodes']:
        visit(root, identity)
    size = [round(b-a, 4) for a, b in zip(low, high)]
    assert size[0] > 12 and size[1] > 6 and size[2] > 8, ('Unexpected 3D bounds', size)
    assert triangles > 10000 and triangles < 250000, ('Geometry budget', triangles)
    assert len(data) < 15_000_000, 'Unexpected asset size'
    result = {'ok': True, 'glbBytes': len(data), 'triangles': triangles, 'vertices': vertices,
              'primitives': primitives, 'nodes': len(doc['nodes']), 'boundsMeters': size,
              'actorAnchors': 10, 'independentShellHinges': 6,
              'embeddedRasterImages': len(doc.get('images', [])),
              'extensions': doc.get('extensionsUsed', []), 'sha256': expected_hash}
    result['nativeBlendReady'] = native_ready
    result['environment']={'bytes':len(env_data),'nodes':len(env_names),'foregroundShells':2,
                           'floatingPearls':24,'harbourLights':140,'realIslandMeshes':3}
    result['normalLengthRange'] = [minimum_normal_length, maximum_normal_length]
    REVIEW.mkdir(parents=True, exist_ok=True)
    (REVIEW / 'validation.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    inspect()
