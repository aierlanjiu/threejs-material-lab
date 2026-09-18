import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/papazed/dev/threejs-material-lab');out=ROOT/'output/hunyuan-rig'
scene=bpy.data.scenes.new('LI · Hunyuan source · 2026-09-16');bpy.context.window.scene=scene
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.world=bpy.data.worlds.new('Hunyuan neutral studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.77,.83,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.view_settings.view_transform='AgX';scene.view_settings.look='None';scene.view_settings.exposure=.45
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.render.resolution_x=1000;scene.render.resolution_y=1200
report={}
for role,folder,height in [('hoodie','scheme_a_hoodie',3.55),('astro','scheme_d_astro',4.05)]:
    before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/mascots/hunyuan3d'/folder/'model_glb.glb'))
    objects=[o for o in scene.objects if o not in before];ob=next(o for o in objects if o.type=='MESH');ob.name='HY_Source_'+role
    bpy.context.view_layer.update();coords=[ob.matrix_world@v.co for v in ob.data.vertices];lo=Vector(tuple(min(p[i] for p in coords) for i in range(3)));hi=Vector(tuple(max(p[i] for p in coords) for i in range(3)))
    factor=height/(hi.z-lo.z);cx=(hi.x+lo.x)/2;cy=(hi.y+lo.y)/2
    # World-space transform only: preserve the input sculpture and UV coordinates.
    for v,p in zip(ob.data.vertices,coords):v.co=((p.x-cx)*factor,(p.y-cy)*factor,(p.z-lo.z)*factor)
    ob.parent=None;ob.matrix_world.identity();ob['li_source']='Tencent Hunyuan 3D Pro';ob['source_path']=str(ROOT/'assets/mascots/hunyuan3d'/folder/'model_glb.glb');ob['li_role']=role;ob['source_scale']=factor
    for p in ob.data.polygons:p.use_smooth=True
    ob.data.materials[0].name='HY texture · '+role
    report[role]={'vertices':len(ob.data.vertices),'polygons':len(ob.data.polygons),'original_bounds':[list(lo),list(hi)],'scale':factor,'height':height,'uv_layers':list(ob.data.uv_layers.keys())}
    ob.hide_render=role!='hoodie';ob.hide_viewport=role!='hoodie'
def area(name,loc,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.8))-o.location).to_track_quat('-Z','Y').to_euler()
area('HY key',(-3,-4,6),400,4);area('HY fill',(4,-2,3.5),180,3.5);area('HY rim',(1,3,5),430,3)
d=bpy.data.cameras.new('HY Review');cam=bpy.data.objects.new('HY Review',d);scene.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO'
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='METAL'
scene.cycles.device='GPU'
for role,height in [('hoodie',3.55),('astro',4.05)]:
    for o in scene.objects:
        if o.get('li_role'):o.hide_render=o['li_role']!=role
    for view,pos in [('front',(0,-9,height*.51)),('side',(9,0,height*.51))]:
        cam.location=pos;cam.rotation_euler=(Vector((0,0,height*.51))-cam.location).to_track_quat('-Z','Y').to_euler();d.ortho_scale=height*1.12;scene.render.filepath=str(out/f'source-{role}-{view}.png');bpy.ops.render.render(write_still=True)
(out/'source-inventory.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-hunyuan-import.blend'))
print('HUNYUAN_SOURCE_IMPORTED',json.dumps(report))
