from pathlib import Path
import bpy,json
from mathutils import Vector
ROOT=Path('/Users/papazed/dev/threejs-material-lab');scene=bpy.context.scene;out=ROOT/'output/blender-mcp'
exec((ROOT/'scripts/blender/cord_braid_finish.py').read_text())
exec((ROOT/'scripts/blender/export_li.py').read_text())
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
for r,n,h,scale in [('hoodie','HoodieLychee',1.72,3.85)]:
    role(n)
    for view,offset in [('front',(0,-9,0)),('side',(9,0,0)),('back',(0,9,0))]:render(f'{r}-{view}-final.png',(0,0,h),offset,scale,1080,1200)
    render(f'{r}-hero-final.png',(0,0,h),(4,-9,1.1),scale,1080,1200)
role('HoodieLychee')
for name,target,offset,scale in [
    ('hood-rim',(0,-.75,1.98),(1.3,-9,.2),1.6),
    ('arms-and-cords',(0,-.5,1.16),(2,-9,.7),1.57),
    ('boots',(0,-.18,.31),(2,-8,.7),1.27)]:render(f'detail-{name}.png',target,offset,scale,1200,900)
exec((ROOT/'scripts/blender/finalize_master.py').read_text())
print('HOODIE_FINAL_REFRESHED')
