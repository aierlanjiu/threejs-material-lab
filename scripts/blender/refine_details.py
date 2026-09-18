"""Reference-led detail pass: pith edge, connected sleeves, continuous boot volumes."""
import bpy, math, bmesh
from mathutils import Vector
from pathlib import Path
from math import sin,cos,pi
ROOT=Path('/Users/papazed/dev/threejs-material-lab')
scene=bpy.context.scene
hood=scene.objects['HoodieLychee'];astro=scene.objects['AstroLychee']
head=next(o for o in hood.children if o.name=='Head')

def replace_mesh(ob,verts,faces):
    me=bpy.data.meshes.new(ob.name+' · refined');me.from_pydata(verts,[],faces);me.update()
    for m in ob.data.materials:me.materials.append(m)
    ob.data=me
    for p in me.polygons:p.use_smooth=True
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
    return ob

def closed_lathe(ob,profiles,cy=0):
    verts=[];faces=[];n=64
    for z,rx,ry,center in profiles:
        for i in range(n):
            a=i*2*pi/n;verts.append((rx*cos(a),center+ry*sin(a),z))
    for j in range(len(profiles)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    faces.extend([tuple(reversed(range(n))),tuple((len(profiles)-1)*n+i for i in range(n))])
    replace_mesh(ob,verts,faces);ob.location=(0,0,0);ob.scale=(1,1,1)

# Warm red, broad satin highlights, softer valleys. Avoid candy-pink overexposure.
for ob in [*hood.children_recursive,*astro.children_recursive]:
    if ob.type=='MESH' and ob.data.color_attributes.get('Col') and any('Rind' in m.name for m in ob.data.materials):
        for color in ob.data.color_attributes['Col'].data:
            r,g,b,a=color.color;color.color=(r*.89,g*.48,b*.53,a)
for m in bpy.data.materials:
    if m.name.startswith('Rind'):
        p=m.node_tree.nodes['Principled BSDF'];p.inputs['Roughness'].default_value=.42;p.inputs['Coat Weight'].default_value=.12

# Make the aperture wider and lower, smoothly compressing only the front of the hood.
for ob in head.children:
    if ob.name.startswith('Hood ·'):
        for vert in ob.data.vertices:
            p=vert.co;w=max(0,min(1,(-p.y-.53)/.23));p.z += ((-.30+(p.z+.30)*.79)-p.z)*w
    if ob.name=='Fruit face':
        for vert in ob.data.vertices:vert.co.z=-.30+(vert.co.z+.30)*.79
        col=ob.data.color_attributes['Col']
        for vertex,c in zip(ob.data.vertices,col.data):
            x,z=vertex.co.x,vertex.co.z
            w=sum(math.exp(-((x-s*.43)/.14)**2-((z+.44)/.077)**2) for s in [-1,1])*.80;w=min(.75,w)
            cream=(1,.868,.730);pink=(.86,.19,.17);c.color=tuple(cream[i]*(1-w)+pink[i]*w for i in range(3))+(1,)
    if ob.name=='Cream face opening':
        # Irregular pith edge, following individual rind cells rather than an even gasket.
        for i,p in enumerate(ob.data.splines[0].bezier_points):
            a=i*2*pi/128;wave=.009*sin(a*23)+.005*sin(a*37+.7)
            for co in [p.co,p.handle_left,p.handle_right]:
                co.z=-.30+(co.z+.30)*.79+wave*sin(a);co.x+=wave*cos(a)
        ob.data.bevel_depth=.025

# Seal the narrow dark gaps between clipped boundary cells and the cream edge.
lip=next(o for o in head.children if o.name=='Cream face opening')
base=lip.copy();base.data=lip.data.copy();base.name='Continuous red lip backing';scene.collection.objects.link(base);base.parent=head
base.data.materials.clear();base.data.materials.append(bpy.data.materials['Boots · oxblood enamel']);base.data.bevel_depth=.060;base.location.y=.026
lip.location.y=-.004

for eye in [o for o in head.children if o.name in ['Eye.L','Eye.R']]:
    eye.scale=(1.10,1,1.04);eye.location.z=-.30
mouth=next(o for o in head.children if o.name=='Mouth');mouth.location.z=-.455;mouth.scale.x=1.04

# Leaf: rotate its broad surface toward the front while keeping actual depth and curvature.
for model in [hood,astro]:
    leaf_parts=[o for o in model.children_recursive if o.name.startswith(('Leaf blade','Leaf midrib','Leaf fine vein'))]
    for o in leaf_parts:
        origin=Vector((.11,0,1.14 if model==hood else 1.22))
        def tilt(p):
            q=p-origin;y=q.y;z=q.z;q.y=y*cos(1.12)-z*sin(1.12);q.z=y*sin(1.12)+z*cos(1.12);return q+origin
        if o.type=='MESH':
            for v in o.data.vertices:v.co=tilt(v.co)
        else:
            for sp in o.data.splines:
                for p in sp.bezier_points:
                    p.co=tilt(p.co);p.handle_left=tilt(p.handle_left);p.handle_right=tilt(p.handle_right)

# Continuous boot upper, rounded oval sole, short cream ankles.
for model in [hood,astro]:
    for leg in [o for o in model.children if o.name.startswith('Leg.')]:
        upper=next(o for o in leg.children if o.name.startswith('Rounded boot toe' if model==hood else 'Moon boot toe'))
        profiles=[(.105,.282,.37,-.13),(.13,.294,.389,-.14),(.20,.295,.387,-.14),(.27,.279,.346,-.11),(.32,.255,.29,-.05),(.36,.247,.235,.006),(.40,.249,.229,.018),(.423,.250,.23,.02)]
        if model==astro:profiles=[(z,rx,ry,c) for z,rx,ry,c in profiles[:-1]]+[(.49,.225,.23,.01),(.59,.225,.225,.01)]
        closed_lathe(upper,profiles)
        sub=upper.modifiers.new('Sculpted smooth boot','SUBSURF');sub.levels=2;sub.render_levels=2
        bpy.context.view_layer.objects.active=upper;bpy.ops.object.modifier_apply(modifier=sub.name)
        old=next(o for o in leg.children if o.name.startswith('Boot ankle' if model==hood else 'Boot shaft'))
        old.hide_render=True;old.hide_viewport=True;old['li_skip_export']=True
        sole=next(o for o in leg.children if o.name.startswith('Ivory rubber sole' if model==hood else 'Moon boot sole'))
        closed_lathe(sole,[(.023,.272,.380,-.14),(.030,.301,.408,-.14),(.055,.306,.414,-.14),(.092,.304,.411,-.14),(.11,.29,.395,-.14)])
        if model==hood:
            ankle=next(o for o in leg.children if o.name.startswith('Cream ankle'));ankle.scale.z=.67;ankle.location.z=.476
        else:
            cap=next(o for o in leg.children if o.name.startswith('Orange toe cap'));cap.location.y=-.522;cap.dimensions=(.34,.042,.095);cap.location.z=.15

# Move the mittens inward and connect their cuffs into bent sleeves.
body=next(o for o in hood.children if o.name=='Body')
for arm in [o for o in body.children if o.name.startswith('Arm.')]:
    side=-1 if arm.location.x<0 else 1
    for ob in arm.children:
        if ob.name.startswith(('Mitten','Cuff pith')):ob.location.x-=side*.135
        if ob.name.startswith('Mitten') and not 'thumb' in ob.name:
            ob.scale.x*=.91;ob.scale.z*=.93;ob.location.y-=.045
    for ob in arm.children:
        if ob.name.startswith('Sleeve rind'):
            for v in ob.data.vertices:
                w=max(0,min(1,(-v.co.y-.10)/.29));v.co.x-=side*.115*w;v.co.z+=.04*w
for ob in body.children:
    if ob.name.startswith('Drawstring loop'):
        for sp in ob.data.splines:
            for p in sp.bezier_points:
                center=Vector((-.115 if p.co.x<0 else .115,-.661,1.32))
                p.co=center+(p.co-center)*.63
        ob.data.bevel_depth=.024
    if ob.name=='Jacket zipper':
        for p in ob.data.splines[0].bezier_points:p.co.y+=.072

# Prevent an off-center planet ring: rotate geometry around the actual badge center.
orbit=next(o for o in astro.children_recursive if o.name.startswith('Chest planet ring'))
orbit.rotation_euler=(0,0,0)
center=Vector((0,-.56,1.49))
for p in orbit.data.splines[0].bezier_points:
    for prop in ['co','handle_left','handle_right']:
        v=getattr(p,prop)-center;x,z=v.x,v.z;v.x=x*cos(.4)-z*sin(.4);v.z=x*sin(.4)+z*cos(.4);setattr(p,prop,v+center)

# White seamless studio. A slight downward camera angle removes the dark floor edge.
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
scene.view_settings.exposure=.35
scene.render.film_transparent=True
scene.cycles.samples=32
for model in [hood,astro]:
    for ob in [model,*model.children_recursive]:
        active=model==hood and not ob.get('li_skip_export',False);ob.hide_render=not active;ob.hide_viewport=not active
scene.camera.location=(0,-9,1.82);scene.camera.rotation_euler=(Vector((0,0,1.76))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots-detail-v2.blend'))
print('DETAIL_REFINEMENT_COMPLETE')
