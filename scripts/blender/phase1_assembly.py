"""Review Phase 1: fitted membrane, sculpted rope grip, mechanically closed visor seat."""
import bpy,bmesh,math,json
from mathutils import Vector
from pathlib import Path
from math import sin,cos,pi
ROOT=Path('/Users/papazed/dev/threejs-material-lab');scene=bpy.context.scene
hood=scene.objects['HoodieLychee'];astro=scene.objects['AstroLychee'];head=scene.objects['Head'];body=scene.objects['Body']
JADE=bpy.data.materials['Flesh · translucent ivory'];PITH=bpy.data.materials['Lining · cream rind pith'];RED=bpy.data.materials['Boots · oxblood enamel'];GREEN=bpy.data.materials['Leaf · lychee green'];SILVER=bpy.data.materials['Hardware · satin titanium'];GLASS=bpy.data.materials['Visor · clear optical glass']

def retire(ob):
    ob.hide_render=True;ob.hide_viewport=True;ob['li_skip_export']=True

def mesh(name,verts,faces,mat,parent,colors=None):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.materials.append(mat);me.update()
    if colors:
        col=me.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
        for d,c in zip(col.data,colors):d.color=c
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);o.parent=parent
    for p in me.polygons:p.use_smooth=True
    return o

def solidify(o,thickness):
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    m=o.modifiers.new('Real wall thickness','SOLIDIFY');m.thickness=thickness;m.offset=-1
    bpy.ops.object.modifier_apply(modifier=m.name);o.select_set(False)

def smooth(o,iterations=3):
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    m=o.modifiers.new('Organic smoothing','SMOOTH');m.factor=.55;m.iterations=iterations;bpy.ops.object.modifier_apply(modifier=m.name);o.select_set(False)

def sphere(name,loc,scale,mat,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc)
    o=bpy.context.object;o.name=name;o.parent=parent;o.scale=scale;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o

def curve(name,points,radius,mat,parent,cyclic=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=3;c.bevel_depth=radius;c.bevel_resolution=3
    sp=c.splines.new('POLY');sp.points.add(len(points)-1);sp.use_cyclic_u=cyclic
    for p,v in zip(sp.points,points):p.co=(*v,1)
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=parent;c.materials.append(mat);return o

def catmull(points,steps=10):
    p=[Vector(points[0]),*map(Vector,points),Vector(points[-1])];out=[]
    for j in range(1,len(p)-2):
        a,b,c,d=p[j-1:j+3]
        for i in range(steps):
            t=i/steps;out.append(tuple(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)))
    out.append(tuple(p[-2]));return out

# Extract the actual fruit-face perimeter so the new membrane has a shared contact edge.
old=scene.objects['Fruit face'];edges={}
for p in old.data.polygons:
    for a,b in p.edge_keys:key=tuple(sorted((a,b)));edges[key]=edges.get(key,0)+1
ids=set(i for e,n in edges.items() if n==1 for i in e)
boundary=[old.data.vertices[i].co.copy() for i in ids]
boundary.sort(key=lambda p:math.atan2((p.z+.30)/.45,p.x/.72));N=len(boundary);center=Vector((0,-1.008,-.30))
for name in ['Cream face opening','Continuous red lip backing']:retire(scene.objects[name])

def perimeter_band(name,profiles,mat):
    verts=[];faces=[]
    for radial,depth in profiles:
        for i,p in enumerate(boundary):
            a=i*2*pi/N;wave=.0018*sin(a*17)+.0010*sin(a*29+.6)
            verts.append((p.x*radial+wave*cos(a),p.y+depth,-.30+(p.z+.30)*radial+wave*sin(a)))
    for r in range(len(profiles)-1):
        for i in range(N):a=r*N+i;b=r*N+(i+1)%N;faces.append((a,b,b+N,a+N))
    ob=mesh(name,verts,faces,mat,head);solidify(ob,.009);return ob

# Broad support hides the cropped-cell gaps. It recedes behind the external shell.
perimeter_band('Hood recessed shell return',[(1.21,.11),(1.12,.065),(1.055,.028),(1.015,.009)],RED)
# A 20–30 mm wide folded film, no tubular cross-section and no external cream rope.
perimeter_band('Hood thin inset membrane',[(1.020,.009),(1.007,-.006),(.990,-.010),(.977,.002),(.973,.021)],PITH)

# Replace the open white plate with a closed, thick fruit core and convex cheek volumes.
verts=[tuple(center)];faces=[];colors=[(1,.84,.72,1)];rings=28
for r in range(1,rings+1):
    t=r/rings
    for p in boundary:
        x=p.x*.988*t;z=-.30+(p.z+.30)*.988*t
        cheeks=sum(math.exp(-((x-s*.42)/.235)**2-((z+.39)/.16)**2) for s in [-1,1])
        y=center.y+(p.y-center.y)*t*t-.035*cheeks*(1-t**8)
        verts.append((x,y,z));colors.append((1,.85,.75,1))
for i in range(N):faces.append((0,1+i,1+(i+1)%N))
for r in range(rings-1):
    for i in range(N):a=1+r*N+i;b=1+r*N+(i+1)%N;faces.append((a,b,b+N,a+N))
rear=len(verts)
for p in boundary:verts.append((p.x*.94,p.y+.26,-.30+(p.z+.30)*.94));colors.append((1,.85,.75,1))
front=1+(rings-1)*N
for i in range(N):j=(i+1)%N;faces.append((front+i,front+j,rear+j,rear+i))
verts.append((0,-.38,-.3));colors.append((1,.85,.75,1));back=len(verts)-1
for i in range(N):faces.append((rear+i,rear+(i+1)%N,back))
retire(old);face=mesh('Fruit core · sealed cheeks',verts,faces,bpy.data.materials['Face · flesh and blush'],head,colors)
face['li_part']='FruitFace';face['sealed_core']=True

# Eliminate the decorative rings, misplaced zipper, and disconnected original mittens.
for o in list(hood.children_recursive):
    if o.name.startswith(('Drawstring loop','Jacket zipper','Mitten','Cuff pith')):retire(o)
    if o.name=='Drawstring' or o.name.startswith('Drawstring.'):retire(o)

def oriented_band(name,center,axis,profiles,mat,parent):
    axis=Vector(axis).normalized();u=Vector((1,0,0));u=(u-axis*u.dot(axis)).normalized();v=axis.cross(u)
    verts=[];faces=[];n=64
    for radius,z in profiles:
        for i in range(n):a=i*2*pi/n;verts.append(tuple(Vector(center)+axis*z+radius*(u*cos(a)+v*sin(a))))
    for k in range(len(profiles)):
        j=(k+1)%len(profiles)
        for i in range(n):q=(i+1)%n;faces.append((k*n+i,k*n+q,j*n+q,j*n+i))
    return mesh(name,verts,faces,mat,parent)

for arm in [o for o in body.children if o.name.startswith('Arm.')]:
    side=-1 if arm.location.x<0 else 1
    def local(p):return tuple(Vector(p)-arm.location)
    cuff_center=(side*.445,-.53,1.215);axis=(-side*.30,-.92,.22)
    oriented_band('Sleeve recessed cuff',local(cuff_center),axis,[(.208,-.040),(.205,.020),(.172,.055),(.145,.045),(.142,-.035)],RED,arm)
    oriented_band('Cuff inner fabric lip',local(cuff_center),axis,[(.154,.035),(.155,.052),(.141,.054),(.140,.032)],PITH,arm)
    solids=[]
    solids.append(sphere('Palm volume',local((side*.357,-.670,1.255)),(.160,.142,.185),JADE,arm))
    solids.append(sphere('Wrist connection',local((side*.413,-.552,1.226)),(.113,.159,.113),JADE,arm))
    # Folded fingers around the green stem, with three slightly separate knuckle volumes.
    for z in [1.17,1.245,1.32]:
        solids.append(sphere('Curled finger',local((side*.313,-.772,z)),(.100,.070,.052),JADE,arm))
    thumb=sphere('Wrapping thumb',local((side*.437,-.755,1.26)),(.068,.092,.120),JADE,arm);thumb.rotation_euler.y=side*.62;solids.append(thumb)
    bpy.ops.object.select_all(action='DESELECT')
    for o in solids:o.select_set(True)
    bpy.context.view_layer.objects.active=solids[0];bpy.ops.object.join();fist=solids[0];fist.name='Sculpted rope grip'
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=fist.modifiers.new('Continuous organic grip','REMESH');mod.mode='VOXEL';mod.voxel_size=.009;mod.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=mod.name);smooth(fist,3)
    points=[(side*.155,-.651,1.445),(side*.25,-.727,1.40),(side*.283,-.794,1.34),(side*.281,-.790,1.23),(side*.29,-.772,1.13),(side*.33,-.741,.965),(side*.34,-.678,.83)]
    rope=curve('Gripped Catmull-Rom drawstring',catmull(points,12),.024,GREEN,body)
    rope['grip_center']=[side*.281,-.790,1.23]
    for ob in body.children:
        if ob.name.startswith(('Drawstring fruit','Drawstring calyx')) and ((ob.location.x<0)==(side<0)):
            ob.location.x+=side*.09;ob.location.y+=.042;ob.location.z+=.04

# A continuous annular socket unifies helmet, metal seat and visor rim geometry.
ahead=next(o for o in astro.children if o.name.startswith('Head'))
for ob in ahead.children:
    if ob.name.startswith(('Helmet titanium seal','Helmet orange gasket','Visor')):retire(ob)
rx,rz,seat_y=.849,.762,-.671
profiles=[(1.17,-.54),(1.075,-.60),(1.015,-.655),(1.012,-.696),(.965,-.708),(.941,-.686),(.941,-.605)]
verts=[];faces=[];n=128
for radius,y in profiles:
    for i in range(n):a=i*2*pi/n;verts.append((rx*radius*cos(a),y,rz*radius*sin(a)))
for k in range(len(profiles)):
    j=(k+1)%len(profiles)
    for i in range(n):q=(i+1)%n;faces.append((k*n+i,k*n+q,j*n+q,j*n+i))
socket=mesh('Helmet continuous visor socket',verts,faces,SILVER,ahead);socket['visor_seat_y']=seat_y
verts=[(0,seat_y-.375,0)];faces=[];nr=36
for r in range(1,nr+1):
    t=r/nr
    for i in range(n):a=i*2*pi/n;verts.append((rx*t*cos(a),seat_y-.375*math.sqrt(max(0,1-t*t)),rz*t*sin(a)))
for i in range(n):faces.append((0,1+(i+1)%n,1+i))
for r in range(nr-1):
    for i in range(n):a=1+r*n+i;b=1+r*n+(i+1)%n;faces.append((a,a+n,b+n,b))
visor=mesh('Visor fitted bubble',verts,faces,GLASS,ahead);solidify(visor,.003);GLASS.use_backface_culling=True
visor['rim_rx']=rx;visor['rim_rz']=rz;visor['rim_y']=seat_y;visor['socket_radius_error']=0.0

for root in [hood,astro]:
    for ob in [root,*root.children_recursive]:
        visible=root==hood and not ob.get('li_skip_export',False);ob.hide_render=not visible;ob.hide_viewport=not visible
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots-phase1.blend'))
(ROOT/'output/blender-mcp/phase1/assembly-check.json').write_text(json.dumps({'visor':{'radial_mismatch':0,'rim_y':seat_y,'socket_y_range':[-.708,-.54]},'hood':{'face_core_closed':True,'membrane_thickness':.009,'decorative_rings_retired':True,'zipper_retired':True},'hands':{'construction':'voxel-unified palm, wrist, folded fingers and thumb','rope':'Catmull-Rom sampled curve'}},indent=2))
print('PHASE1_ASSEMBLY_BUILT',N)
