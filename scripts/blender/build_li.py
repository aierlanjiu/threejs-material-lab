"""Editable Blender master models. Run through execute_blender_code (MCP).

Blender coordinates: Z up, face looks toward -Y. glTF exports Y up, +Z front.
The new orthographic sheets govern proportions; no Three.js prototype meshes imported.
"""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi, sqrt

ROOT = Path('/Users/papazed/dev/threejs-material-lab')
OUT = ROOT / 'assets/mascots/blender'
CELLS = json.loads((OUT / 'rind-cells.json').read_text())
scene = bpy.data.scenes.new('LI · Blender sculpt · 2026-09-15')
bpy.context.window.scene = scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1000
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('LI soft studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.82,.85,.88,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35
scene.view_settings.view_transform = 'AgX'
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False

def rgb(hexcolor):
    v = [int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in v)

def material(name, color, rough=.32, metal=0, coat=.25, sss=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb(color),1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    for key, val in {'Base Color':m.diffuse_color,'Roughness':rough,'Metallic':metal,'Coat Weight':coat,'Coat Roughness':.19,'Subsurface Weight':sss,'Subsurface Scale':.085}.items():
        p.inputs[key].default_value=val
    return m

RIND=material('Rind · fresh crimson', 'D84448', .37, coat=.33)
attr=RIND.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name='Col'
RIND.node_tree.links.new(attr.outputs['Color'],RIND.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
JADE=material('Flesh · translucent ivory', 'FFF0DF', .235, coat=.38, sss=.12)
LINING=material('Lining · cream rind pith','F6DCB7',.31,coat=.25,sss=.06)
FACE=JADE.copy();FACE.name='Face · flesh and blush'
a=FACE.node_tree.nodes.new('ShaderNodeVertexColor');a.layer_name='Col';FACE.node_tree.links.new(a.outputs['Color'],FACE.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
BOOT=material('Boots · oxblood enamel','B92835',.25,coat=.65)
LEAF=material('Leaf · lychee green','527616',.33,coat=.35)
VEIN=material('Leaf veins · yellow green','89A335',.4)
STEM=material('Stem · chestnut','8A4020',.33,coat=.2)
EYE=material('Eyes · obsidian','160E0B',.115,coat=.65)
IRIS=material('Iris · warm umber','5A3421',.22,coat=.5)
WHITE=material('Eyes · ivory rim','FFF9EE',.24)
GLINT=material('Catchlight · softbox','FFFFFF',.15)
MOUTH=material('Mouth · cherry','881C13',.3)
TONGUE=material('Tongue · coral','EC7766',.32,sss=.1)
SUIT=material('Suit · porcelain textile','EAE7E0',.42,coat=.16)
SILVER=material('Hardware · satin titanium','C0B7A5',.27,.78,.3)
ORANGE=material('Hardware · burnt orange','D4460C',.28,.45,.4)
SEAM=material('Seams · warm grey','A39988',.63)
HUD=material('HUD · ice cyan','89E5EE',.25,coat=.1)
HUD.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(*rgb('60DDEC'),1)
HUD.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=2
BEACON=material('Beacon · amber','FF9B22',.25)
BEACON.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(*rgb('FF7210'),1)
BEACON.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=4
GLASS=material('Visor · clear optical glass','FFFFFF',.08,coat=.1)
gp=GLASS.node_tree.nodes['Principled BSDF'];gp.inputs['Transmission Weight'].default_value=1;gp.inputs['IOR'].default_value=1.12

def empty(name,parent=None,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=loc;o.parent=parent;return o

def mesh(name,verts,faces,mat,parent=None,colors=None,smooth=True):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(mat)
    if colors:
        layer=me.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
        for d,c in zip(layer.data,colors): d.color=(*c,1)
    for p in me.polygons:p.use_smooth=smooth
    return o

def uv_sphere(name,loc,scale,mat,parent,segments=40,rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;o.parent=parent;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o

def roundbox(name,loc,dim,mat,parent,bevel=.12):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.dimensions=dim;o.parent=parent
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=5
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:p.use_smooth=True
    mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def tube(name,points,radius,mat,parent,cyclic=False,res=3):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=12;cu.bevel_depth=radius;cu.bevel_resolution=res
    sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(points)-1);sp.use_cyclic_u=cyclic
    for p,co in zip(sp.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,cu);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(mat);return o

def ring(name,center,rx,rz,radius,mat,parent,n=64):
    return tube(name,[(center[0]+rx*cos(i*2*pi/n),center[1],center[2]+rz*sin(i*2*pi/n)) for i in range(n)],radius,mat,parent,True,2)

def cylinder(name,loc,radius,depth,mat,parent,axis=(0,0,1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.parent=parent;o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector(axis).to_track_quat('Z','Y');o.data.materials.append(mat)
    mod=o.modifiers.new('Machined bevel','BEVEL');mod.width=min(.025,depth*.24);mod.segments=3
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:p.use_smooth=True
    return o

def spow(x,p):return math.copysign(abs(x)**p,x)

def hood_shape(n):
    x,y,z=n
    return Vector((1.065*x*(1-.14*z),.95*spow(y,.76),(.94*z if z>=0 else -.82*(-z)**.64)))

def astro_shape(n):
    x,y,z=n
    return Vector((1.055*spow(x,.91),.91*spow(y,.86),.90*spow(z,.86)))

def sculpt_rind(name,shape,parent,count=580,opening=None,relief=.05):
    """Contiguous Voronoi cells: shared valley edges, broad crowns, no floating beads."""
    data=CELLS[str(count)];vertices=[];faces=[];colors=[];rng=random.Random(17+count)
    base=rgb('D83D45');valley=rgb('A31E29');light=rgb('E96053')
    def clipped(n):
        if opening:
            axis,angle=opening;theta=math.acos(max(-1,min(1,n.dot(axis))))
            if theta<angle:
                tangent=(n-axis*n.dot(axis)).normalized();return axis*cos(angle)+tangent*sin(angle)
        return n
    for center,reg in zip(data['centers'],data['regions']):
        c=Vector(center)
        if opening and c.dot(opening[0])>cos(opening[1]):continue
        corners=[clipped(Vector(data['vertices'][i])) for i in reg];c=clipped(c)
        b=len(vertices);k=len(corners);tint=rng.uniform(.82,1.09);h=relief*rng.uniform(.72,1.24)
        # Four concentric levels create rounded shoulders and a small irregular apex.
        for fraction,height in [(1,0),(.78,h*.42),(.37,h*.92)]:
            for corner in corners:
                n=(corner*fraction+c*(1-fraction)).normalized();normal=shape(n).normalized()
                vertices.append(tuple(shape(n)+normal*height))
                mix=.23 if fraction==1 else (.85 if fraction<.5 else .70)
                col=tuple((valley[j]*(1-mix)+base[j]*mix)*tint for j in range(3))
                colors.append(col)
        vertices.append(tuple(shape(c)+shape(c).normalized()*h));colors.append(tuple(v*tint for v in light));top=b+3*k
        for i in range(k):
            j=(i+1)%k
            faces.extend([(b+i,b+j,b+k+j,b+k+i),(b+k+i,b+k+j,b+2*k+j,b+2*k+i),(b+2*k+i,b+2*k+j,top)])
    o=mesh(name,vertices,faces,RIND,parent,colors)
    # Recalculate exterior normals after custom topology construction.
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    import bmesh
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free();o.select_set(False)
    return o

def leaf(parent,base,length=1.00,side=1):
    # Curved leaf with a cupped midrib and nonzero thickness, readable in side view.
    verts=[];faces=[];cols=[];segments=24;across=8
    def point(t,s):
        width=.29*sin(pi*t)**.82
        return (base[0]+side*(length*t+.08*s*width),base[1]+s*width-.12*t,base[2]+.26*sin(pi*t)-.27*t+.15*s*s*sin(pi*t))
    for i in range(segments+1):
        t=i/segments
        for j in range(across+1):
            s=2*j/across-1;verts.append(point(t,s));cols.append(rgb('527616'))
    for i in range(segments):
        for j in range(across):a=i*(across+1)+j;faces.append((a,a+1,a+across+2,a+across+1))
    o=mesh('Leaf blade',verts,faces,LEAF,parent)
    mod=o.modifiers.new('Leaf thickness','SOLIDIFY');mod.thickness=.014
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    tube('Leaf midrib',[point(i/8,0) for i in range(9)],.013,VEIN,parent)
    for t in [.22,.37,.52,.67,.79]:
        for s in [-1,1]:tube('Leaf fine vein',[point(t,0),point(t+.07,s*.5),point(min(.98,t+.17),s*.94)],.0045,VEIN,parent,res=1)

def sprig(parent,z,astro=False):
    tube('Living branch',[(0,.02,z),(-.025,.025,z+.12),(-.075,.015,z+.28)],.071,STEM,parent)
    cylinder('Cut stem',(-.075,.015,z+.28),.073,.027,STEM,parent,(-.15,0,1))
    tube('Leaf petiole',[(0,.02,z+.09),(.12,0,z+.20),(.22,-.01,z+.25)],.035,LEAF,parent)
    leaf(parent,(.11,0,z+.19),1.00 if not astro else .85)
    if not astro:
        for x,y,s in [(-.14,-.03,.084),(.04,-.1,.092),(.11,.05,.08)]:uv_sphere('Calyx',(x,y,z),(s,s,s),LEAF,parent,24,16)

def face_patch(name,boundary,parent,front_y,center_z,wide,height):
    verts=[(0,front_y,center_z)];faces=[];colors=[rgb('FFF1DF')];N=len(boundary);rings=18
    def color(x,z):
        w=sum(math.exp(-((x-side*wide*.58)/(wide*.24))**2-((z-center_z+height*.27)/(height*.15))**2) for side in [-1,1])
        w=min(.74,w*.72);b=rgb('FFF2E2');c=rgb('F18C82');return tuple(b[j]*(1-w)+c[j]*w for j in range(3))
    for r in range(1,rings+1):
        t=r/rings
        for p in boundary:
            x=p[0]*t;z=center_z+(p[2]-center_z)*t;y=front_y+(p[1]-front_y)*t*t
            verts.append((x,y,z));colors.append(color(x,z))
    for j in range(N):faces.append((0,1+j,1+(j+1)%N))
    for r in range(rings-1):
        a=1+r*N;b=a+N
        for j in range(N):k=(j+1)%N;faces.append((a+j,b+j,b+k,a+k))
    o=mesh(name,verts,faces,FACE,parent,colors)
    import bmesh
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
    return o

def face_features(parent,z,front,astro=False):
    eye_x=.355 if not astro else .34
    for side in [-1,1]:
        eg=empty('Eye.L' if side<0 else 'Eye.R',parent,(side*eye_x,front+.013,z))
        uv_sphere('Ivory eye rim',(0,0,0),(.171,.042,.195),WHITE,eg)
        uv_sphere('Iris',(0,-.030,0),(.151,.045,.178),IRIS,eg)
        uv_sphere('Pupil',(0,-.052,.012),(.127,.046,.154),EYE,eg)
        uv_sphere('Eye softbox',(-.045,-.094,.095),(.031,.012,.035),GLINT,eg,20,12)
        uv_sphere('Eye glimmer',(.052,-.091,-.045),(.008,.008,.012),GLINT,eg,16,8)
        if astro:tube('Brow.L' if side<0 else 'Brow.R',[(side*.28,front+.034,z+.31),(side*.35,front+.042,z+.34),(side*.405,front+.062,z+.315)],.014,STEM,parent)
    mouth=empty('Mouth',parent,(0,front-.020,z-.18))
    if astro:
        uv_sphere('Open smile',(0,0,-.02),(.126,.022,.113),MOUTH,mouth)
        uv_sphere('Tongue',(0,-.025,-.068),(.09,.013,.05),TONGUE,mouth)
    else:tube('Cherry smile',[(-.115,0,.012),(-.07,-.007,-.020),(0,-.011,-.034),(.07,-.007,-.020),(.115,0,.012)],.0125,MOUTH,mouth)
    return mouth

hoodie=empty('HoodieLychee')
body=empty('Body',hoodie)
sculpt_rind('Jacket · continuous rind',lambda n:Vector((.77*spow(n.x,.76),.56*spow(n.y,.76),.425*spow(n.z,.64)))+Vector((0,0,.93)),body,200,relief=.033)
tube('Jacket zipper',[(0,-.566,.54),(0,-.59,.81),(0,-.575,1.26)],.010,BOOT,body)
for side in [-1,1]:
    arm=empty('Arm.L' if side<0 else 'Arm.R',body,(side*.57,-.035,1.19))
    # Connected bent sleeves, with hands resting against chest drawstrings.
    sculpt_rind('Sleeve rind',lambda n:Vector((.275*n.x,.30*n.y-.11,.31*n.z-.10)),arm,72,relief=.027)
    uv_sphere('Cuff pith',(side*-.032,-.40,-.015),(.19,.085,.195),LINING,arm)
    uv_sphere('Mitten',(side*-.040,-.455,.060),(.20,.16,.225),JADE,arm)
    uv_sphere('Mitten thumb',(side*-.185,-.452,-.025),(.076,.10,.105),JADE,arm,28,16)
    leg=empty('Leg.L' if side<0 else 'Leg.R',hoodie,(side*.365,0,0))
    cylinder('Cream ankle',(0,0,.455),.235,.18,LINING,leg)
    roundbox('Ivory rubber sole',(0,-.15,.061),(.61,.83,.12),LINING,leg,.054)
    uv_sphere('Rounded boot toe',(0,-.22,.22),(.30,.39,.20),BOOT,leg)
    roundbox('Boot ankle',(0,.015,.28),(.53,.48,.28),BOOT,leg,.11)
    cylinder('Boot button',(side*.269,.014,.37),.061,.027,LINING,leg,(1,0,0))
    tube('Boot upper seam',[(side*.25,-.015,.39),(side*.27,-.11,.30),(side*.28,-.25,.18)],.007,BOOT,leg)
    tube('Drawstring',[(side*.16,-.60,1.30),(side*.20,-.74,1.11),(side*.25,-.72,.84)],.028,LEAF,body)
    uv_sphere('Drawstring fruit',(side*.25,-.72,.79),(.076,.066,.12),STEM,body,28,18)
    for a in range(5):
        ang=a*2*pi/5;uv_sphere('Drawstring calyx',(side*.25+.055*cos(ang),-.72+.05*sin(ang),.85),(.031,.036,.065),LEAF,body,20,12)
    ring('Drawstring loop',(side*.115,-.661,1.32),.10,.06,.020,LEAF,body,24)
head=empty('Head',hoodie,(0,0,2.11))
axis=Vector((0,-cos(.35),-sin(.35)));tangent=Vector((0,-sin(.35),cos(.35)));angle=.66
sculpt_rind('Hood · sculpted cocoon',hood_shape,head,580,(axis,angle),.045)
boundary=[]
for i in range(128):
    a=i*2*pi/128;n=axis*cos(angle)+(Vector((1,0,0))*cos(a)+tangent*sin(a))*sin(angle)
    p=hood_shape(n);boundary.append(tuple(p+Vector((0,-.006,0))))
tube('Cream face opening',boundary,.035,LINING,head,True,3)
face_patch('Fruit face',boundary,head,-1.04,-.275,.70,.94)
face_features(head,-.25,-1.00)
sprig(head,.95)

astro=empty('AstroLychee')
torso=empty('Body',astro)
uv_sphere('Pressure suit',(0,0,1.35),(.58,.39,.60),SUIT,torso)
roundbox('Life support backpack',(0,.42,1.42),(.90,.48,.94),SUIT,torso,.16)
roundbox('Backpack panel',(0,.683,1.53),(.66,.05,.51),WHITE,torso,.10)
for side in [-1,1]:
    # Harnesses and padded, articulated arms.
    tube('Shoulder harness',[(side*.39,.02,1.89),(side*.41,-.34,1.76),(side*.34,-.45,1.54)],.047,SILVER,torso)
    arm=empty('Arm.L' if side<0 else 'Arm.R',torso,(side*.57,0,1.68))
    uv_sphere('Suit upper arm',(side*.09,0,-.15),(.21,.24,.35),SUIT,arm)
    cylinder('Wrist seal',(side*.20,-.04,-.43),.196,.09,ORANGE,arm,(side*.24,0,-1))
    cylinder('Wrist cuff',(side*.187,-.03,-.38),.218,.15,WHITE,arm,(side*.24,0,-1))
    uv_sphere('Glove',(side*.235,-.055,-.61),(.17,.16,.245),WHITE,arm)
    uv_sphere('Glove thumb',(side*.105,-.15,-.55),(.075,.10,.14),WHITE,arm,28,16)
    for dx in [-.075,0,.075]:tube('Glove stitch',[(side*.23+dx,-.20,-.58),(side*.23+dx,-.20,-.70)],.0035,SEAM,arm,res=1)
    badge=roundbox('Orange shoulder patch',(side*.09,-.222,-.09),(.19,.035,.20),ORANGE,arm,.037)
    leg=empty('Leg.L' if side<0 else 'Leg.R',astro,(side*.31,0,0))
    roundbox('Padded thigh',(0,0,.91),(.53,.61,.48),SUIT,leg,.16)
    cylinder('Knee gasket',(0,0,.672),.243,.087,ORANGE,leg)
    cylinder('Knee roll',(0,0,.736),.259,.12,SUIT,leg)
    roundbox('Boot shaft',(0,.015,.433),(.46,.50,.43),SUIT,leg,.11)
    uv_sphere('Moon boot toe',(0,-.18,.23),(.29,.39,.235),SUIT,leg)
    roundbox('Moon boot sole',(0,-.14,.070),(.61,.85,.13),SILVER,leg,.055)
    roundbox('Orange toe cap',(0,-.486,.14),(.35,.06,.13),ORANGE,leg,.039)
    cylinder('Boot orange port',(side*.247,-.005,.45),.102,.032,ORANGE,leg,(1,0,0))
    cylinder('Boot silver port',(side*.268,-.005,.45),.079,.026,SILVER,leg,(1,0,0))
    tube('Boot front stitch',[(0,-.268,.60),(0,-.30,.39),(0,-.51,.21)],.0045,SEAM,leg,res=1)
    tube('Suit leg seam',[(side*.10,-.294,.82),(side*.1,-.30,1.0),(side*.10,-.32,1.11)],.004,SEAM,torso,res=1)
    # Life support hose: a curving cable with individual corrugated folds.
    pts=[Vector((side*.23,-.45,1.46)),Vector((side*.34,-.44,1.25)),Vector((side*.47,-.26,1.16)),Vector((side*.47,.12,1.15))]
    tube('Life support hose',[tuple(p) for p in pts],.047,SUIT,torso)
    for i in range(12):
        u=i/11;seg=min(2,int(u*3));t=min(1,u*3-seg);p=pts[seg].lerp(pts[seg+1],t);direction=(pts[seg+1]-pts[seg]).normalized()
        cylinder('Hose rib',p,.054,.018,WHITE,torso,direction)
    cylinder('Rear thruster',(side*.245,.73,1.17),.15,.14,SILVER,torso,(0,1,0))
    cylinder('Thruster orange',(side*.245,.81,1.17),.116,.03,ORANGE,torso,(0,1,0))
    cylinder('Thruster glow',(side*.245,.832,1.17),.076,.021,BEACON,torso,(0,1,0))
roundbox('Chest module',(0,-.403,1.49),(.57,.17,.40),SUIT,torso,.065)
roundbox('Chest inset',(0,-.505,1.49),(.41,.047,.28),WHITE,torso,.045)
uv_sphere('Chest planet',(0,-.545,1.49),(.079,.023,.079),ORANGE,torso,28,18)
orbit=ring('Chest planet ring',(0,-.56,1.49),.119,.032,.007,ORANGE,torso,40);orbit.rotation_euler.y=.39
roundbox('Chest status light',(.237,-.502,1.57),(.047,.029,.054),BEACON,torso,.009)
cylinder('Collar',(0,0,1.89),.45,.12,SILVER,torso)
ahead=empty('Head',astro,(0,0,2.76))
sculpt_rind('Helmet · sculpted rind',astro_shape,ahead,580,(Vector((0,-1,0)),.90),.043)
helmet_boundary=[]
for i in range(128):
    a=i*2*pi/128;n=Vector((sin(.9)*cos(a),-cos(.9),sin(.9)*sin(a)));helmet_boundary.append(tuple(astro_shape(n)))
tube('Helmet titanium seal',helmet_boundary,.046,SILVER,ahead,True,3)
inner=[(x*.955,y-.025,z*.955) for x,y,z in helmet_boundary];tube('Helmet orange gasket',inner,.019,ORANGE,ahead,True,2)
face_boundary=[(x*.915,y+.015,z*.92) for x,y,z in helmet_boundary]
face_patch('Astronaut fruit face',face_boundary,ahead,-.935,-.045,.80,1.4)
face_features(ahead,-.18,-.903,True)
# Thin independent optical bubble. Keep thickness physically small to protect facial readability.
v=[];f=[];nr=24;ns=96
for r in range(nr+1):
    t=r/nr
    for i in range(ns):
        a=i*2*pi/ns;v.append((.85*t*cos(a),-.684-.38*sqrt(max(0,1-t*t)),.758*t*sin(a)))
for r in range(nr):
    for i in range(ns):a=r*ns+i;b=r*ns+(i+1)%ns;f.append((a,b,b+ns,a+ns))
visor=mesh('Visor',v,f,GLASS,ahead)
mod=visor.modifiers.new('Optical wall 1.5 mm','SOLIDIFY');mod.thickness=.0015
bpy.context.view_layer.objects.active=visor;bpy.ops.object.modifier_apply(modifier=mod.name)
for side in [-1,1]:
    cylinder('Ear titanium',(side*1.05,0,-.02),.225,.12,SILVER,ahead,(1,0,0))
    cylinder('Ear seal',(side*1.116,0,-.02),.172,.025,ORANGE,ahead,(1,0,0))
    cylinder('Ear core',(side*1.138,0,-.02),.126,.02,SILVER,ahead,(1,0,0))
    cylinder('Ear light',(side*1.131,0,-.02),.148,.008,BEACON,ahead,(1,0,0))
    cylinder('Ear face',(side*1.149,0,-.02),.117,.020,SILVER,ahead,(1,0,0))
for i in range(44):
    a=2*pi*i/44
    if abs(cos(a))<.35:continue
    t=.92;x=.78*cos(a);z=.70*sin(a)
    tube('HUD graduation',[(x,-.837,z),(x*.971,-.857,z*.971)],.0035,HUD,ahead,res=1)
cylinder('Beacon base',(0,0,.934),.155,.07,SILVER,ahead)
cylinder('Beacon light',(0,0,.985),.093,.035,BEACON,ahead)
sprig(ahead,1.03,True)

# Reference images are embedded into the editable master, excluded from exports/renders.
refs=bpy.data.collections.new('REFERENCE · approved orthographic drawings');scene.collection.children.link(refs)
for role,x in [('scheme_a_hoodie',-4),('scheme_d_astro',4)]:
    for index,file in enumerate(['01_turnaround_3view.png','02_ortho_side_90.png','03_isometric_cad_breakdown.png']):
        image=bpy.data.images.load(str(ROOT/'design_sheets/ortho_blueprints'/role/file),check_existing=True);image.pack()
        o=bpy.data.objects.new(role+' · '+file,None);refs.objects.link(o);o.empty_display_type='IMAGE';o.data=image;o.empty_display_size=5;o.location=(x,3+index*.1,2);o.rotation_euler=(pi/2,0,0);o.hide_render=True;o.hide_viewport=True

# Photography setup, kept outside character roots.
FLOOR=material('Studio · warm seamless','F3F0EA',.8,coat=0)
roundbox('Studio floor',(0,0,-.105),(200,200,.2),FLOOR,None,.01)
def area(name,loc,power,size,color):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.8))-o.location).to_track_quat('-Z','Y').to_euler();return o
area('Key · large octabox',(-3.5,-4.5,6),500,4.0,(1,.90,.80))
area('Fill · tall softbox',(4,-2.4,4.2),360,3.5,(.84,.92,1))
area('Rim · overhead',(1.5,3.0,5),650,3.0,(1,.94,.82))
camd=bpy.data.cameras.new('Review orthographic');cam=bpy.data.objects.new('Review camera',camd);scene.collection.objects.link(cam);scene.camera=cam;camd.type='ORTHO';camd.ortho_scale=4.25
cam.location=(.0,-9,1.82);cam.rotation_euler=(Vector((0,0,1.82))-cam.location).to_track_quat('-Z','Y').to_euler()

def set_role(role):
    for root in (hoodie,astro):
        enabled=root==role
        root.hide_render=not enabled;root.hide_viewport=not enabled
        for child in root.children_recursive:child.hide_render=not enabled;child.hide_viewport=not enabled

set_role(hoodie)
scene['li_model_source']='Blender MCP 1.9.1 · native editable mesh master'
scene['li_reference_contract']='design_sheets/ortho_blueprints · 6 images packed'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'li-mascots-master.blend'))
scene.render.filepath=str(ROOT/'output/blender-mcp/hoodie-front.png')
print('LI_BUILD_COMPLETE',len(hoodie.children_recursive),len(astro.children_recursive),bpy.data.filepath)
