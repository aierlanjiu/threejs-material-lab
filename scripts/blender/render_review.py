import bpy, json
from pathlib import Path
from mathutils import Vector

root=Path('/Users/papazed/dev/threejs-material-lab')
scene=bpy.context.scene
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='METAL';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='METAL'
    scene.cycles.device='GPU'
except Exception as error:
    print('Cycles CPU fallback',str(error));scene.cycles.device='CPU'
print('CYCLES_DEVICES',[(d.name,d.type,d.use) for d in prefs.devices])
scene.cycles.samples=24
scene.render.resolution_x=900;scene.render.resolution_y=1000
for role,name in [('hoodie','HoodieLychee'),('astro','AstroLychee')]:
    for other in ['HoodieLychee','AstroLychee']:
        model=scene.objects[other]
        for ob in [model,*model.children_recursive]:ob.hide_render=other!=name or ob.get('li_skip_export',False)
    height=1.73 if role=='hoodie' else 2.13
    scene.camera.data.ortho_scale=3.85 if role=='hoodie' else 4.72
    for view,pos in [('front',(0,-9,height)),('side',(9,0,height)),('back',(0,9,height))]:
        scene.camera.location=pos;scene.camera.rotation_euler=(Vector((0,0,height))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(root/'output/blender-mcp'/f'{role}-{view}-final.png')
        bpy.ops.render.render(write_still=True)
        print('RENDER_COMPLETE',role,view,flush=True)
print('REVIEW_COMPLETE')
