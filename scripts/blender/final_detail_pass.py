import bpy,json,math,bmesh
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/papazed/dev/threejs-material-lab');scene=bpy.context.scene
hood=scene.objects['HoodieLychee'];astro=scene.objects['AstroLychee'];head=scene.objects['Head']
for eye in [o for o in head.children if o.name in ['Eye.L','Eye.R']]:
    eye.scale.x*=.92;eye.scale.z*=.94;eye.scale.y=.40;eye.location.y+=.022
ahead=next(o for o in astro.children if o.name.startswith('Head'))
for eye in [o for o in ahead.children if o.name.startswith('Eye.')]:eye.scale.y=.48
for ob in [*hood.children_recursive,*astro.children_recursive]:
    if ob.name.startswith(('Leaf blade','Leaf midrib','Leaf fine vein')):
        pivot=Vector((.11,0,1.14 if ob in hood.children_recursive else 1.22))
        def turn(v):
            p=v-pivot;x,y=p.x,p.y;p.x=x*math.cos(-.28)-y*math.sin(-.28);p.y=x*math.sin(-.28)+y*math.cos(-.28);return pivot+p
        if ob.type=='MESH':
            for v in ob.data.vertices:v.co=turn(v.co)
        else:
            for sp in ob.data.splines:
                for p in sp.bezier_points:
                    for prop in ['co','handle_left','handle_right']:setattr(p,prop,turn(getattr(p,prop)))
for ob in hood.children_recursive:
    if ob.name=='Jacket · continuous rind':
        for v in ob.data.vertices:v.co.x*=1.045
    if ob.name.startswith('Sleeve rind'):
        for v in ob.data.vertices:v.co.x*=1.09

# Fine star veins live on the polygon crowns, following the sculpted surfaces.
vein=bpy.data.materials.new('Rind veins · warm coral');vein.use_nodes=True
p=vein.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.54,.068,.035,1);p.inputs['Roughness'].default_value=.47
cells=json.loads((ROOT/'assets/mascots/blender/rind-cells.json').read_text())['580']
for name,opening in [('Hood · sculpted cocoon',(Vector((0,-math.cos(.35),-math.sin(.35))),.66)),('Helmet · sculpted rind',(Vector((0,-1,0)),.90)),('Jacket · continuous rind',None)]:
    ob=scene.objects[name];verts=[];faces=[];offset=0
    for c0,reg in zip(cells['centers'],cells['regions']):
        if opening and Vector(c0).dot(opening[0])>math.cos(opening[1]):continue
        k=len(reg);top=ob.data.vertices[offset+3*k].co.copy();ring=[ob.data.vertices[offset+2*k+i].co.copy() for i in range(k)]
        avg=sum(ring,Vector())/k
        # A broad crown, with no pointed center spike.
        top=top.lerp(avg,.24);ob.data.vertices[offset+3*k].co=top
        normal=(top-sum((ob.data.vertices[offset+i].co for i in range(k)),Vector())/k).normalized()
        for end in ring:
            a=top+normal*.0018;b=top.lerp(end,.95)+normal*.0018;side=(b-a).cross(normal).normalized()*.0013
            j=len(verts);verts.extend([tuple(a-side*.6),tuple(a+side*.6),tuple(b+side),tuple(b-side)]);faces.append((j,j+1,j+2,j+3))
        offset+=3*k+1
    me=bpy.data.meshes.new(name+' · star veins');me.from_pydata(verts,[],faces);me.materials.append(vein)
    line=bpy.data.objects.new(name+' · star veins',me);scene.collection.objects.link(line);line.parent=ob.parent

for root in [hood,astro]:
    for ob in [root,*root.children_recursive]:
        enabled=root==hood and not ob.get('li_skip_export',False);ob.hide_render=not enabled;ob.hide_viewport=not enabled
# Default view and packed reference empties are retained in the final master.
scene.camera.data.ortho_scale=3.85;scene.camera.location=(0,-9,1.73)
scene.camera.rotation_euler=(Vector((0,0,1.73))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots.blend'))
print('FINAL_DETAIL_PASS_COMPLETE')
