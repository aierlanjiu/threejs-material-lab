import bpy, math, json, random, bmesh
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/papazed/dev/threejs-material-lab');scene=bpy.context.scene
hood=scene.objects['HoodieLychee'];astro=scene.objects['AstroLychee']
head=scene.objects['Head'];body=scene.objects['Body']
scene.objects['Continuous red lip backing'].location.y=.081
scene.objects['Cream face opening'].data.bevel_depth=.032
scene.objects['Cream face opening'].location.y=-.018
for vertex in scene.objects['Fruit face'].data.vertices:
    w=max(0,1-(vertex.co.x/.74)**2-((vertex.co.z+.30)/.51)**2);vertex.co.y+=.052*w
for ob in head.children:
    if ob.name in ['Eye.L','Eye.R','Mouth']:ob.location.y+=.041

# Denser, less inflated cells on the jacket. Relief normals use local coordinates.
cells=json.loads((ROOT/'assets/mascots/blender/rind-cells.json').read_text())['580']
v=[];f=[];colors=[];rng=random.Random(24)
def signpow(x,p):return math.copysign(abs(x)**p,x)
def shape(n):return Vector((.77*signpow(n.x,.76),.56*signpow(n.y,.76),.425*signpow(n.z,.64)))
for c0,reg in zip(cells['centers'],cells['regions']):
    c=Vector(c0);corners=[Vector(cells['vertices'][i]) for i in reg];start=len(v);k=len(corners);tint=rng.uniform(.82,1.08);height=rng.uniform(.018,.028)
    for frac,h in [(1,0),(.80,height*.40),(.38,height*.94)]:
        for corner in corners:
            n=(corner*frac+c*(1-frac)).normalized();p=shape(n);v.append(tuple(p+p.normalized()*h+Vector((0,0,.93))))
            rgb=(.42,.012,.020) if frac==1 else (.60,.022,.032);colors.append(tuple(ch*tint for ch in rgb)+(1,))
    v.append(tuple(shape(c)+shape(c).normalized()*height+Vector((0,0,.93))));colors.append((.67*tint,.041*tint,.028*tint,1))
    for i in range(k):j=(i+1)%k;f.extend([(start+i,start+j,start+k+j,start+k+i),(start+k+i,start+k+j,start+2*k+j,start+2*k+i),(start+2*k+i,start+2*k+j,start+3*k)])
old=scene.objects['Jacket · continuous rind'];me=bpy.data.meshes.new('Jacket · close packed small crowns');me.from_pydata(v,[],f);me.materials.append(old.data.materials[0]);old.data=me
col=me.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
for c,value in zip(col.data,colors):c.color=value
for poly in me.polygons:poly.use_smooth=True
bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()

# The upper boot overlaps the knee seal; the outer side port remains centered.
for leg in [o for o in astro.children if o.name.startswith('Leg.')]:
    shoe=next(o for o in leg.children if o.name.startswith('Moon boot toe'))
    for vertex in shoe.data.vertices:
        if vertex.co.z>.36:vertex.co.z += .092*((vertex.co.z-.36)/.23)
    for o in leg.children:
        if o.name.startswith('Boot front stitch'):o.hide_render=True;o.hide_viewport=True;o['li_skip_export']=True
for arm in [o for o in astro.children_recursive if o.type=='EMPTY' and o.name.startswith('Arm.')]:
    side=-1 if arm.location.x<0 else 1
    shoulder=next(o for o in arm.children if o.name.startswith('Suit upper arm'))
    shoulder.scale.x*=1.21;shoulder.location.x-=side*.033;shoulder.rotation_euler.y=-side*.22
    shoulder.location.z-=.008

# Art-directed color management: retain the lychee's red chroma and obsidian eye depth.
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.25
world=scene.world.node_tree;world.nodes.clear()
out=world.nodes.new('ShaderNodeOutputWorld');lightpath=world.nodes.new('ShaderNodeLightPath');mix=world.nodes.new('ShaderNodeMixShader')
environment=world.nodes.new('ShaderNodeBackground');environment.inputs[0].default_value=(.82,.88,1,1);environment.inputs[1].default_value=.15
backdrop=world.nodes.new('ShaderNodeBackground');backdrop.inputs[0].default_value=(1,1,1,1);backdrop.inputs[1].default_value=1.20
world.links.new(lightpath.outputs['Is Camera Ray'],mix.inputs[0]);world.links.new(environment.outputs[0],mix.inputs[1]);world.links.new(backdrop.outputs[0],mix.inputs[2]);world.links.new(mix.outputs[0],out.inputs[0])
scene.render.film_transparent=False
scene.objects['Studio floor'].hide_render=True
for m in bpy.data.materials:
    if m.name.startswith(('Eyes · obsidian','Iris')):m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.18
    if m.name.startswith('Leaf ·'):
        p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.055,.125,.007,1);p.inputs['Roughness'].default_value=.41;p.inputs['Coat Weight'].default_value=.12
for o in [*hood.children_recursive,*astro.children_recursive]:
    if o.name.startswith('Leaf blade'):
        for p in o.data.polygons:p.use_smooth=True
    if o.name.startswith(('Leaf midrib','Leaf fine vein')):
        # Raise veins onto the camera-facing side of the tilted leaf.
        o.location.y-=.015
for model in [hood,astro]:
    for ob in [model,*model.children_recursive]:
        active=model==hood and not ob.get('li_skip_export',False);ob.hide_render=not active;ob.hide_viewport=not active
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots-detail-v3.blend'))
print('SURFACE_FINISHED')
