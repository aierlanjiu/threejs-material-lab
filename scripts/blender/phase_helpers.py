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

def oriented_band(name,center,axis,profiles,mat,parent):
    axis=Vector(axis).normalized();u=Vector((1,0,0));u=(u-axis*u.dot(axis)).normalized();v=axis.cross(u)
    verts=[];faces=[];n=64
    for radius,z in profiles:
        for i in range(n):a=i*2*pi/n;verts.append(tuple(Vector(center)+axis*z+radius*(u*cos(a)+v*sin(a))))
    for k in range(len(profiles)):
        j=(k+1)%len(profiles)
        for i in range(n):q=(i+1)%n;faces.append((k*n+i,k*n+q,j*n+q,j*n+i))
    return mesh(name,verts,faces,mat,parent)


def rgb(hexcolor):
    v = [int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in v)

def material(name, color, rough=.32, metal=0, coat=.25, sss=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb(color),1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    for key, val in {'Base Color':m.diffuse_color,'Roughness':rough,'Metallic':metal,'Coat Weight':coat,'Coat Roughness':.19,'Subsurface Weight':sss,'Subsurface Scale':.085}.items():
        p.inputs[key].default_value=val
    return m

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

def cylinder(name,loc,radius,depth,mat,parent,axis=(0,0,1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.parent=parent;o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector(axis).to_track_quat('Z','Y');o.data.materials.append(mat)
    mod=o.modifiers.new('Machined bevel','BEVEL');mod.width=min(.025,depth*.24);mod.segments=3
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:p.use_smooth=True
    return o

