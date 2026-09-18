import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/papazed/dev/threejs-material-lab');scene=bpy.context.scene
for name in ['HoodieLychee','AstroLychee']:
    model=scene.objects[name]
    for ob in [model,*model.children_recursive]:ob.hide_render=name!='HoodieLychee' or ob.get('li_skip_export',False)
scene.render.resolution_x=1100;scene.render.resolution_y=800;scene.cycles.samples=32
for label,target,scale in [('hood-rim',(0,-.55,1.96),1.75),('arms-and-cords',(0,-.5,1.08),1.68),('boots',(0,-.18,.34),1.24)]:
    target=Vector(target);scene.camera.location=target+Vector((2,-8,.55));scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=scale
    scene.render.filepath=str(ROOT/'output/blender-mcp'/f'detail-{label}.png');bpy.ops.render.render(write_still=True)
    print('DETAIL_RENDER_COMPLETE',label)
def bounds(objects):
    points=[o.matrix_world@Vector(p) for o in objects if o.type=='MESH' for p in o.bound_box]
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    return {'min':lo,'max':hi,'size':[hi[i]-lo[i] for i in range(3)]}
hood=scene.objects['HoodieLychee'];head=scene.objects['Hood · sculpted cocoon'];body=scene.objects['Body']
metrics={'hoodie':{'head':bounds([head]),'body':bounds([o for o in body.children_recursive if not o.get('li_skip_export')]),'boots':bounds([o for o in hood.children_recursive if any(p.name.startswith('Leg.') for p in [o.parent] if p) and not o.get('li_skip_export')])}}
metrics['hoodie']['body_width_to_head']=metrics['hoodie']['body']['size'][0]/metrics['hoodie']['head']['size'][0]
(ROOT/'output/blender-mcp/proportions.json').write_text(json.dumps(metrics,indent=2))
scene.camera.data.ortho_scale=3.85;scene.camera.location=(0,-9,1.73);scene.camera.rotation_euler=(Vector((0,0,1.73))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
print('DETAILS_AND_MEASUREMENTS_COMPLETE',json.dumps(metrics))
