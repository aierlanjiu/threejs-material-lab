import bpy,json,numpy as np
report={}
for o in bpy.context.scene.objects:
    if o.type=='MESH' and o.data.shape_keys:
        report[o.name]={'keys':{k.name:k.value for k in o.data.shape_keys.key_blocks},'active':o.active_shape_key_index,'show_only':o.show_only_shape_key}
        for k in o.data.shape_keys.key_blocks:k.value=0
        o.active_shape_key_index=0;o.show_only_shape_key=False
    if o.type=='ARMATURE':report[o.name]={'pose':[(b.name,list(b.rotation_quaternion),list(b.scale),list(b.location)) for b in o.pose.bones]}
print(json.dumps(report))
