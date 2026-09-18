import bpy,json,bmesh,shutil
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/papazed/dev/threejs-material-lab');scene=bpy.context.scene;out=ROOT/'output/blender-mcp'
backup=ROOT/'output/backups/li-before-review-phases-20260915/renders';backup.mkdir(exist_ok=True)
for pattern in ['*-final.png','detail-*.png','review.html','proportions.json']:
    for p in out.glob(pattern):
        if not (backup/p.name).exists():shutil.copy2(p,backup/p.name)
scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.cycles.samples=64;scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='METAL'
def role(name):
    for other in ['HoodieLychee','AstroLychee']:
        for ob in [scene.objects[other],*scene.objects[other].children_recursive]:
            visible=other==name and not ob.get('li_skip_export',False);ob.hide_render=not visible;ob.hide_viewport=not visible
def render(file,target,offset,scale,width,height):
    target=Vector(target);scene.camera.location=target+Vector(offset);scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=scale
    scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.filepath=str(out/file);bpy.ops.render.render(write_still=True);print('REVIEW_RENDER',file)
for r,n,h,scale in [('hoodie','HoodieLychee',1.72,3.85),('astro','AstroLychee',2.08,4.55)]:
    role(n)
    for view,offset in [('front',(0,-9,0)),('side',(9,0,0)),('back',(0,9,0))]:render(f'{r}-{view}-final.png',(0,0,h),offset,scale,1080,1200)
    render(f'{r}-hero-final.png',(0,0,h),(4,-9,1.1),scale,1080,1200)
role('HoodieLychee')
for name,target,offset,scale in [
    ('hood-rim',(0,-.75,1.98),(1.3,-9,.2),1.6),
    ('arms-and-cords',(0,-.5,1.16),(2,-9,.7),1.57),
    ('boots',(0,-.18,.31),(2,-8,.7),1.27)]:render(f'detail-{name}.png',target,offset,scale,1200,900)
role('AstroLychee')
for name,target,offset,scale in [
    ('visor-seal',(.42,-.57,2.67),(7,-8,.1),1.68),
    ('chest-insignia',(0,-.30,1.42),(1.5,-9,.5),1.84),
    ('backpack-thrusters',(0,.56,1.38),(2,9,.4),1.67)]:render(f'detail-{name}.png',target,offset,scale,1200,900)
def bounds(objects):
    points=[o.matrix_world@Vector(p) for o in objects if o.type=='MESH' for p in o.bound_box]
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    return {'min':lo,'max':hi,'size':[hi[i]-lo[i] for i in range(3)]}
hood=scene.objects['HoodieLychee'];astro=scene.objects['AstroLychee'];body=scene.objects['Body']
head=next(o for o in hood.children_recursive if o.name.startswith('Hood · sculpted cocoon · rounded') and not o.get('li_skip_export'))
metrics={'hoodie':{'head':bounds([head]),'body':bounds([o for o in body.children_recursive if not o.get('li_skip_export')])}}
metrics['hoodie']['body_width_to_head']=metrics['hoodie']['body']['size'][0]/metrics['hoodie']['head']['size'][0]
metrics['hoodie']['head_width_to_height']=metrics['hoodie']['head']['size'][0]/metrics['hoodie']['head']['size'][2]
checks={}
for name in ['Fruit core · sealed cheeks','Hood thin inset membrane','Visor fitted bubble','Orange silicone · fitted seal']:
    ob=scene.objects[name];bm=bmesh.new();bm.from_mesh(ob.data);checks[name]={'boundary_edges':sum(e.is_boundary for e in bm.edges),'non_manifold_edges':sum(not e.is_manifold for e in bm.edges)};bm.free()
checks['visible_hex_bolts']=len([o for o in astro.children_recursive if o.get('li_part')=='VisorBolt' and not o.get('li_skip_export')])
checks['visor_seat']={k:scene.objects['Visor fitted bubble'][k] for k in ['rim_rx','rim_rz','rim_y','socket_radius_error']}
checks['retired_artifacts']=[n for n in ['Cream face opening','Continuous red lip backing','Jacket zipper'] if scene.objects[n].get('li_skip_export')]
(out/'proportions.json').write_text(json.dumps(metrics,indent=2));(out/'phase-review-checks.json').write_text(json.dumps(checks,indent=2))
role('HoodieLychee');scene.camera.data.ortho_scale=3.85;scene.camera.location=(0,-9,1.72);scene.camera.rotation_euler=(Vector((0,0,1.72))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots.blend'))
print('PHASE_REVIEW_COMPLETE',json.dumps(checks),json.dumps(metrics))
