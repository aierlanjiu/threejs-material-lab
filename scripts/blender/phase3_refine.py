from pathlib import Path
exec((Path('/Users/papazed/dev/threejs-material-lab/scripts/blender/phase_helpers.py')).read_text())
ahead=next(o for o in astro.children if o.name.startswith('Head'));torso=next(o for o in astro.children if o.name.startswith('Body'))
# Restore an uncut fruit surface and subdivide before the small engraving operation.
with bpy.data.libraries.load(str(ROOT/'assets/mascots/blender/li-mascots-phase1.blend'),link=False) as (data_from,data_to):data_to.objects=['Fruit core · sealed cheeks']
face=scene.objects['Fruit core · sealed cheeks'];face.data=data_to.objects[0].data.copy();face.data.materials.clear();face.data.materials.append(bpy.data.materials['Face · flesh and blush'])
face.hide_viewport=False;bpy.context.view_layer.objects.active=face
sub=face.modifiers.new('Smooth micro engraving surface','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
for h,is_astro in [(head,False),(ahead,True)]:
    f=scene.objects['Astronaut fruit face' if is_astro else 'Fruit core · sealed cheeks'];f.hide_viewport=False;f.hide_set(False);bpy.context.view_layer.update()
    col=f.data.color_attributes.get('Col');cream=rgb('FFF0DF');pink=rgb('EE607F')
    for v,c in zip(f.data.vertices,col.data):
        cx=.465 if is_astro else .49;cz=-.36 if is_astro else -.455
        w=min(.9,sum(math.exp(-((v.co.x-s*cx)/.165)**2-((v.co.z-cz)/.105)**2) for s in [-1,1])*.90)
        c.color=tuple(cream[j]*(1-w)+pink[j]*w for j in range(3))+(1,)
    for eye in [o for o in h.children if o.name.startswith('Eye.')]:
        ys=[]
        for dx,dz in [(0,0),(-.17,0),(.17,0),(0,.18),(0,-.18)]:
            hit,p,n,i=f.ray_cast(Vector((eye.location.x+dx,-2,eye.location.z+dz)),Vector((0,1,0)))
            if hit:ys.append(p.y)
        eye.location.y=min(ys)-.011;eye.scale.y=.56
        for ob in eye.children:
            if ob.name.startswith('Obsidian inner pupil'):ob.scale.y=.059
        eye['front_surface_clearance']=.011
# The marking follows the floor of a real shallow groove, not a protruding mouth strip.
mouth=scene.objects['Mouth']
for child in list(mouth.children):
    if not child.get('li_skip_export'):retire(child)
pts=[]
for i in range(65):
    x=-.105+.21*i/64;z=-.465+.033*(x/.105)**2
    hit,p,n,j=face.ray_cast(Vector((x,-2,z)),Vector((0,1,0)));pts.append((x,p.y-.0008,z))
tool=curve('Fine smile groove tool',pts,.006,bpy.data.materials['Mouth · cherry'],head)
bpy.ops.object.select_all(action='DESELECT');tool.select_set(True);bpy.context.view_layer.objects.active=tool;bpy.ops.object.convert(target='MESH')
bpy.context.view_layer.objects.active=face;mod=face.modifiers.new('Fine incised smile','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=tool;bpy.ops.object.modifier_apply(modifier=mod.name);retire(tool)
pigment=[tuple(mouth.matrix_local.inverted()@Vector((x,y+.0037,z))) for x,y,z in pts]
ink=curve('Incised coral smile',pigment,.0033,bpy.data.materials['Tongue · coral'],mouth);ink['recessed']=True
scene.objects['Hood closed throat saddle'].scale.z=.085;scene.objects['Hood closed throat saddle'].location.z=1.442

for root in [hood,astro]:
    for leg in [o for o in root.children if o.name.startswith('Leg.')]:
        shoe=next(o for o in leg.children if o.name.startswith('Rounded boot toe' if root==hood else 'Moon boot toe'))
        profile=[(.106,.282,.370,-.13),(.120,.294,.390,-.14),(.165,.300,.401,-.145),(.235,.300,.397,-.146),(.292,.284,.370,-.126),(.340,.262,.303,-.060),(.377,.247,.239,.012),(.417,.250,.230,.02)]
        if root==astro:profile=profile[:-1]+[(.49,.228,.229,.011),(.66,.227,.226,.01)]
        vs=[];fs=[];n=64
        for z,rx,ry,cy in profile:
            for i in range(n):a=2*pi*i/n;vs.append((rx*cos(a),cy+ry*sin(a),z))
        for j in range(len(profile)-1):
            for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
        fs.extend([tuple(reversed(range(n))),tuple((len(profile)-1)*n+i for i in range(n))])
        replacement=mesh('Rounded sculpted boot',vs,fs,shoe.data.materials[0],leg);replacement['li_part']='BootUpper';retire(shoe)
        bpy.context.view_layer.objects.active=replacement;sub=replacement.modifiers.new('Continuous rounded toe','SUBSURF');sub.levels=2;bpy.ops.object.modifier_apply(modifier=sub.name)
        for ob in leg.children:
            if ob.name.startswith('Boot upper seam'):retire(ob)
# Tuck the service hatch into the rounded backpack instead of leaving an air gap at its edge.
for ob in torso.children:
    if ob.name.startswith(('Backpack recessed seam','Backpack sealed service lid')):ob.location.y-=.025;ob.scale.x*=.94;ob.scale.z*=.90;ob.location.z-=.025
    if ob.name.startswith(('Backpack Saturn emblem','Backpack recessed vent','Backpack service screw')):ob.location.y-=.025;ob.location.z-=.025
# Join the sprout stem to the beacon socket.
stem=bpy.data.materials['Stem · chestnut'];cylinder('Antenna root · seated stem',(0,0,1.056),.069,.125,stem,ahead)
scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-.42
scene.objects['Bounce · face card'].data.energy=65
rp=bpy.data.materials['Rind · fresh crimson'].node_tree.nodes['Principled BSDF'];rp.inputs['Subsurface Weight'].default_value=.015;rp.inputs['Coat Weight'].default_value=.09;rp.inputs['Roughness'].default_value=.48
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots-phase3.blend'))
print('PHASE3_OPTICAL_CLEARANCE_AND_TOES_REFINED')
