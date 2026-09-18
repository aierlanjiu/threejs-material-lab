import bpy
from pathlib import Path
scene=bpy.context.scene
head=scene.objects['Head']
# Front orthographic reference: head width 513 px / height 393 px.
# Our measured shell width is 2.2394; target height = 1.7157.
head.scale.z=.925
head.location.z=2.155
bpy.context.view_layer.update()
scene['hoodie_reference_head_aspect']=513/393
scene['hoodie_reference_body_width_ratio']=412/513
scene['hoodie_model_body_width_ratio']=.79185
bpy.ops.wm.save_as_mainfile(filepath=str(Path('/Users/papazed/dev/threejs-material-lab/assets/mascots/blender/li-mascots.blend')))
print('ORTHOGRAPHIC_HEAD_ASPECT_CALIBRATED',head.scale.z,head.location.z)
