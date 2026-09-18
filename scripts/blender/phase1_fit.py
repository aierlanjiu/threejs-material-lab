from pathlib import Path
exec((Path('/Users/papazed/dev/threejs-material-lab/scripts/blender/phase_helpers.py')).read_text())
# Recess cuff within the sleeve and extend the fabric to meet the wrist.
for arm in [o for o in body.children if o.name.startswith('Arm.')]:
    side=-1 if arm.location.x<0 else 1
    for ob in arm.children:
        if ob.name.startswith(('Sleeve recessed cuff','Cuff inner fabric lip')):
            center=Vector((side*.445,-.53,1.215))-arm.location
            for v in ob.data.vertices:v.co=center+(v.co-center)*.88+Vector((0,.045,0))
        if ob.name.startswith('Sleeve rind'):
            for v in ob.data.vertices:
                w=max(0,min(1,(-v.co.y-.13)/.26));v.co.y-=.13*w
        if ob.name.startswith('Sculpted rope grip'):smooth(ob,5)
# The throat is a continuous cloth saddle intersecting both hood and jacket.
collar=sphere('Hood closed throat saddle',(0,-.30,1.432),(.52,.335,.155),RED,body)
collar['assembly']='continuous overlap with shell underside and jacket collar'
for o in body.children:
    if o.name.startswith('Gripped Catmull'):
        s=-1 if o.data.splines[0].points[0].co.x<0 else 1
        pts=o.data.splines[0].points
        for i in range(12):
            w=(1-i/12)**2;pts[i].co.y+=.095*w;pts[i].co.z+=.035*w
# Remove the flared plate shape while retaining a shared closed seat and dome.
o=scene.objects['Helmet continuous visor socket'];n=128
profiles=[(1.075,-.535),(1.072,-.585),(1.035,-.635),(1.012,-.695),(.965,-.708),(.941,-.686),(.941,-.595)]
for k,(r,y) in enumerate(profiles):
    for i in range(n):
        a=2*pi*i/n;o.data.vertices[k*n+i].co=(.849*r*cos(a),y,.762*r*sin(a))
o['assembly']='recessed rounded socket, visor radius shared at .849/.762'
scene['review_phase']='phase1'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots-phase1.blend'))
print('PHASE1_FIT_REFINED')
