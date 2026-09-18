import bpy
from pathlib import Path
from mathutils import Vector
root=Path('/Users/papazed/dev/threejs-material-lab');scene=bpy.context.scene;cam=scene.camera
scene.cycles.samples=20;scene.render.resolution_x=1000;scene.render.resolution_y=1200
for role,height in [('hoodie',3.55),('astro',4.05)]:
    for o in scene.objects:
        if o.type=='MESH':o.hide_render=o.get('li_role')!=role or o.name.startswith('HY_Source')
    for view,pos in [('front',(0,-9,height*.51)),('side',(9,0,height*.51))]:
        cam.location=pos;cam.rotation_euler=(Vector((0,0,height*.51))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=height*1.12
        scene.render.filepath=str(root/'output/hunyuan-rig'/f'rig-{role}-{view}.png');bpy.ops.render.render(write_still=True)
print('RIG_RENDERS_DONE')
