import bpy,json,os
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/papazed/dev/threejs-material-lab');scene=bpy.context.scene
phase=scene.get('review_phase','phase1');out=ROOT/'output/blender-mcp'/phase;out.mkdir(exist_ok=True)
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.cycles.samples=64
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='METAL';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='METAL'
scene.cycles.device='GPU'
for role,name,height,scale in [('hoodie','HoodieLychee',1.72,3.85)]:
    for other in ['HoodieLychee','AstroLychee']:
        model=scene.objects[other]
        for ob in [model,*model.children_recursive]:ob.hide_render=other!=name or ob.get('li_skip_export',False)
    scene.camera.data.ortho_scale=scale
    for view,pos in [('front',(0,-9,height))]:
        if phase=='phase1' and view=='back':continue
        scene.camera.location=pos;scene.camera.rotation_euler=(Vector((0,0,height))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/f'{role}-{view}.png')
        bpy.ops.render.render(write_still=True);print('PHASE_RENDER',phase,role,view)
print('PHASE_RENDER_COMPLETE')
