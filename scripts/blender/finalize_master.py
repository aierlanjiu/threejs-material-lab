import bpy
from pathlib import Path
from mathutils import Quaternion,Vector
scene=bpy.context.scene
# Only disposable export scenes created in this task are removed from the editable master.
# The previously saved master and Blender's .blend1 remain available on disk.
for s in list(bpy.data.scenes):
    if s.name.startswith('EXPORT '):bpy.data.scenes.remove(s)
bpy.ops.object.select_all(action='DESELECT')
hood=scene.objects['HoodieLychee']
for ob in [hood,*hood.children_recursive]:
    if not ob.get('li_skip_export',False):ob.hide_viewport=False;ob.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in hood.children_recursive if o.name.startswith('Hood · sculpted cocoon · rounded') and not o.get('li_skip_export'))
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        space=area.spaces.active;space.shading.type='MATERIAL';space.shading.use_scene_world=False
        region=next((r for r in area.regions if r.type=='WINDOW'),None)
        if region:
            with bpy.context.temp_override(area=area,region=region):bpy.ops.view3d.view_selected(use_all_regions=False)
        space.region_3d.view_rotation=Quaternion((1,0,0),1.57079632679)
        space.region_3d.view_perspective='ORTHO'
scene.render.resolution_x=900;scene.render.resolution_y=1000
scene.camera.data.ortho_scale=3.85;scene.camera.location=(0,-9,1.73);scene.camera.rotation_euler=(Vector((0,0,1.73))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(Path('/Users/papazed/dev/threejs-material-lab/assets/mascots/blender/li-mascots.blend')))
print('EDITABLE_MASTER_READY',bpy.data.filepath)
