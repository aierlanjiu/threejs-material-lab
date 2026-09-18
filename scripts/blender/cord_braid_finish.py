from pathlib import Path
exec((Path('/Users/papazed/dev/threejs-material-lab/scripts/blender/phase_helpers.py')).read_text())
CORD=material('Cord · woven green fruit stem','54751C',.56,coat=.08)
for rope in [o for o in body.children if o.name.startswith('Gripped Catmull-Rom')]:
    rope.data.materials.clear();rope.data.materials.append(CORD)
    control=[Vector(p.co[:3]) for p in rope.data.splines[0].points];distance=[0]
    for a,b in zip(control,control[1:]):distance.append(distance[-1]+(b-a).length)
    total=distance[-1];steps=int(total/.003);j=0;strands=[[],[]]
    for i in range(steps+1):
        s=total*i/steps
        while j<len(control)-2 and distance[j+1]<s:j+=1
        t=(s-distance[j])/max(1e-8,distance[j+1]-distance[j]);p=control[j].lerp(control[j+1],t);axis=(control[j+1]-control[j]).normalized()
        u=Vector((1,0,0));u=(u-axis*u.dot(axis)).normalized();v=axis.cross(u)
        for strand in range(2):
            a=2*pi*s/.043+pi*strand;strands[strand].append(tuple(p+.0238*(u*cos(a)+v*sin(a))))
    for points in strands:curve('Drawstring · fine braided strand',points,.00155,CORD,body)
    rope['construction']='Catmull-Rom core with two fine winding strands'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots-phase3.blend'))
print('CORD_BRAID_COMPLETE')
