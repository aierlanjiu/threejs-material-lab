import bpy,math
from pathlib import Path
scene=bpy.context.scene
hood=scene.objects['HoodieLychee'];astro=scene.objects['AstroLychee']
head=scene.objects['Head']
for o in head.children:
    if o.name in ['Eye.L','Eye.R']:o.location.y=-.990
ahead=next(o for o in astro.children if o.name.startswith('Head'))
for o in ahead.children:
    if o.name.startswith('Eye.'):o.location.y-=.020
mouth=next(o for o in ahead.children if o.name.startswith('Mouth'))
for ob in mouth.children:
    if ob.name.startswith('Open smile'):
        for v in ob.data.vertices:
            if v.co.z>0:v.co.z-=.57*v.co.z*(1-v.co.x*v.co.x)
        ob.scale.x*=1.05
    if ob.name.startswith('Tongue'):ob.scale.x*=1.04
bpy.ops.wm.save_as_mainfile(filepath=str(Path('/Users/papazed/dev/threejs-material-lab/assets/mascots/blender/li-mascots.blend')))
print('EYE_SURFACE_CLEARANCE_AND_SMILE_FIXED')
