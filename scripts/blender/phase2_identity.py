from pathlib import Path
exec((Path('/Users/papazed/dev/threejs-material-lab/scripts/blender/phase_helpers.py')).read_text())
ahead=next(o for o in astro.children if o.name.startswith('Head'))
torso=next(o for o in astro.children if o.name.startswith('Body'))
ORANGE=material('Hardware · orange silicone FF6B00','FF6B00',.35,coat=.12)
DARK=material('Hardware · recessed graphite','252B30',.29,.65)
SUIT=bpy.data.materials['Suit · porcelain textile'];WHITE=bpy.data.materials['Eyes · ivory rim']
HUD=bpy.data.materials['HUD · ice cyan'];hp=HUD.node_tree.nodes.get('Principled BSDF')
hp.inputs['Base Color'].default_value=(*rgb('00F2FE'),1);hp.inputs['Emission Color'].default_value=(*rgb('00F2FE'),1);hp.inputs['Emission Strength'].default_value=2.5
POWER=material('Beacon · green power','40FF8C',.22)
pp=POWER.node_tree.nodes.get('Principled BSDF');pp.inputs['Emission Color'].default_value=(*rgb('40FF8C'),1);pp.inputs['Emission Strength'].default_value=2.5
PLASMA=material('Beacon · thruster plasma FF7700','FF7700',.24)
pp=PLASMA.node_tree.nodes.get('Principled BSDF');pp.inputs['Emission Color'].default_value=(*rgb('FF7700'),1);pp.inputs['Emission Strength'].default_value=5

def ellipse_band(name,profiles,mat,parent,rx=.849,rz=.762):
    verts=[];faces=[];n=128
    for r,y in profiles:
        for i in range(n):a=i*2*pi/n;verts.append((rx*r*cos(a),y,rz*r*sin(a)))
    for k in range(len(profiles)):
        j=(k+1)%len(profiles)
        for i in range(n):q=(i+1)%n;faces.append((k*n+i,k*n+q,j*n+q,j*n+i))
    return mesh(name,verts,faces,mat,parent)

gasket=ellipse_band('Orange silicone · fitted seal',[(1.065,-.635),(1.064,-.679),(1.052,-.708),(1.021,-.723),(.993,-.716),(.991,-.683),(1.014,-.650)],ORANGE,ahead)
gasket['bolt_count']=8;gasket['assembly']='same master rim dimensions as visor and helmet seat'
for i in range(8):
    a=2*pi*(i+.5)/8;center=(.849*1.035*cos(a),-.722,.762*1.035*sin(a))
    bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.025,depth=.017,location=center)
    bolt=bpy.context.object;bolt.name=f'Visor titanium hex bolt {i+1:02d}';bolt.parent=ahead;bolt.rotation_euler.x=pi/2;bolt.data.materials.append(SILVER)
    mod=bolt.modifiers.new('Bolt edge bevel','BEVEL');mod.width=.003;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
    bolt['li_part']='VisorBolt';bolt['assembly_index']=i+1
    cylinder('Bolt recessed socket',(center[0],-.733,center[2]),.008,.002,DARK,ahead,(0,-1,0))

for o in list(ahead.children):
    if o.name.startswith('HUD graduation'):retire(o)
# The HUD lives between the peripheral face and the optical wall, with two segmented arcs.
for start,stop in [(15,165),(195,345)]:
    points=[(.724*cos(a*pi/180),-.815,.648*sin(a*pi/180)) for a in range(start,stop+1,2)]
    curve('HUD · floating main arc',points,.0028,HUD,ahead)
for i in range(64):
    a=2*pi*i/64;major=i%4==0;outer=.984;inner=.941 if major else .963
    curve('HUD · compass graduation',[(.724*inner*cos(a),-.820,.648*inner*sin(a)),(.724*outer*cos(a),-.820,.648*outer*sin(a))],.0024 if major else .0015,HUD,ahead)
for i in range(4):
    a=i*pi/2;pts=[]
    for dr,da in [(0,-.018),(.021,0),(0,.018),(-.007,0),(0,-.018)]:pts.append((.716*(1+dr)*cos(a+da),-.817,.641*(1+dr)*sin(a+da)))
    curve('HUD · cardinal diamond',pts,.0022,HUD,ahead)

# Clean vector Saturn mark: disc plus tilted elliptical orbit, with the rear arc occluded.
def saturn(name,center,size,parent,mat,back=False):
    x,y,z=center;direction=1 if back else -1
    cylinder(name+' · planet',center,size*.44,.005,mat,parent,(0,direction,0))
    pts=[]
    for i in range(129):
        a=2*pi*i/128;u=size*cos(a);v=size*.29*sin(a)
        pts.append((x+u*cos(.40)-v*sin(.40),y+direction*(.007+.009*sin(a)),z+u*sin(.40)+v*cos(.40)))
    curve(name+' · tilted orbit',pts,size*.048,mat,parent)

for ob in list(torso.children):
    if ob.name.startswith(('Chest planet','Chest status light','Shoulder harness','Life support hose','Hose rib','Rear thruster','Thruster orange','Thruster glow')):retire(ob)
saturn('Chest Saturn emblem',(0,-.540,1.49),.123,torso,ORANGE)
cylinder('Chest power bezel',(-.205,-.496,1.615),.026,.022,DARK,torso,(0,-1,0))
cylinder('Chest green power',(-.205,-.510,1.615),.017,.008,POWER,torso,(0,-1,0))
for x in [-.238,.238]:
    for z in [1.355,1.625]:cylinder('Chest corner micro screw',(x,-.489,z),.012,.005,SILVER,torso,(0,-1,0))

font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Unicode.ttf');font.pack()
for arm in [o for o in torso.children if o.name.startswith('Arm.')]:
    s=-1 if arm.location.x<0 else 1
    badge=next(o for o in arm.children if o.name.startswith('Orange shoulder patch'));badge.data.materials.clear();badge.data.materials.append(ORANGE)
    text=bpy.data.curves.new('LI woven insignia','FONT');text.body='LI' if s<0 else '荔';text.font=font;text.align_x='CENTER';text.align_y='CENTER';text.size=.126 if s<0 else .145;text.extrude=.0006;text.bevel_depth=.0003
    ob=bpy.data.objects.new('Right LI insignia' if s<0 else 'Left 荔 insignia',text);scene.collection.objects.link(ob);ob.parent=arm;ob.location=(s*.09,-.243,-.09);ob.rotation_euler.x=pi/2;text.materials.append(WHITE)
    bpy.ops.object.select_all(action='DESELECT');ob.hide_viewport=False;ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
    # Closely spaced circumferential folds along a smooth, gravity-sagged tube.
    controls=[(s*.235,-.481,1.43),(s*.29,-.496,1.31),(s*.39,-.424,1.22),(s*.49,-.255,1.20),(s*.49,.12,1.23)]
    pts=catmull(controls,12);curve('Flexible life support hose',pts,.045,SUIT,torso)
    for i in range(2,len(pts)-2,2):
        tangent=(Vector(pts[i+1])-Vector(pts[i-1])).normalized()
        oriented_band('Hose · transverse corrugation',pts[i],tangent,[(.045,-.010),(.051,-.006),(.053,0),(.051,.006),(.045,.010)],WHITE,torso)
    cylinder('Hose chest fitting',controls[0],.058,.065,SILVER,torso,(0,-1,0))

# Backpack seam and service hatch remain embedded in the body instead of floating panels.
for ob in list(torso.children):
    if ob.name.startswith('Backpack panel'):retire(ob)
roundbox('Backpack recessed seam',(0,.673,1.51),(.737,.027,.652),DARK,torso,.105)
roundbox('Backpack sealed service lid',(0,.694,1.51),(.712,.026,.626),SUIT,torso,.101)
saturn('Backpack Saturn emblem',(0,.711,1.575),.13,torso,ORANGE,back=True)
roundbox('Backpack recessed vent',(0,.712,1.40),(.27,.008,.038),DARK,torso,.012)
for s in [-1,1]:
    for z in [1.28,1.73]:cylinder('Backpack service screw',(s*.294,.715,z),.015,.005,SILVER,torso,(0,1,0))
    center=(s*.245,.735,1.13)
    oriented_band('Thruster · recessed metal shroud',center,(0,1,0),[(.154,-.095),(.167,-.057),(.166,.066),(.151,.089),(.128,.086),(.116,.039),(.113,-.064)],SILVER,torso)
    oriented_band('Thruster · dark inner barrel',center,(0,1,0),[(.116,-.066),(.119,.041),(.105,.047),(.097,-.066)],DARK,torso)
    oriented_band('Thruster · preheat orange annulus',center,(0,1,0),[(.095,-.002),(.097,.011),(.073,.011),(.071,-.002)],PLASMA,torso)
    cylinder('Thruster · recessed plasma core',(s*.245,.705,1.13),.071,.013,PLASMA,torso,(0,1,0))
    for i in range(8):
        a=2*pi*i/8;cylinder('Thruster rim fastener',(s*.245+.143*cos(a),.825,1.13+.143*sin(a)),.008,.006,DARK,torso,(0,1,0))

# A squat pressure suit: shorten the torso about the hip plane and widen each leg.
torso.scale.z=.9;torso.location.z=.075;ahead.location.z-=.12
for leg in [o for o in astro.children if o.name.startswith('Leg.')]:leg.scale.x=1.15;leg.scale.y=1.06
exec((ROOT/'scripts/blender/phase2_finish.py').read_text())
