import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/papazed/dev/threejs-material-lab');OUT=ROOT/'output/hunyuan-rig';scene=bpy.context.scene
scene.name='LI · Hunyuan refined and rigged'
parents={r:next(o for o in scene.objects if o.type=='EMPTY' and o.get('source_sha256') and o.get('li_role')==r) for r in ['hoodie','astro']}
report={}
for role,parent in parents.items():
    bpy.ops.object.select_all(action='DESELECT');objects=[parent]+list(parent.children_recursive)
    for o in objects:
        o.hide_viewport=False;o.hide_set(False);o.select_set(True)
        if o.type=='MESH' and o.data.shape_keys:
            for k in o.data.shape_keys.key_blocks:k.value=0
    bpy.context.view_layer.objects.active=parent
    path=ROOT/'assets/mascots/blender'/f'{role}-lychee.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_animations=False,export_skins=True,export_morph=True,export_morph_normal=True,export_extras=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_def_bones=False)
    parts=[o for o in objects if o.type=='MESH'];rig=next(o for o in objects if o.type=='ARMATURE')
    report[role]={'bytes':path.stat().st_size,'parts':[o.get('li_part',o.name) for o in parts],'bones':[b.name for b in rig.data.bones],'morphs':{o.name:[k.name for k in o.data.shape_keys.key_blocks] for o in parts if o.data.shape_keys},'zero_weight_vertices':sum(1 for o in parts for v in o.data.vertices if sum(g.weight for g in v.groups)<.98),'source_sha256':parent['source_sha256']}
    print('EXPORTED',role,report[role]['bytes'])
scene.cycles.samples=24;scene.render.resolution_x=1000;scene.render.resolution_y=1200
cam=scene.camera
for role,height in [('hoodie',3.55),('astro',4.05)]:
    for o in scene.objects:
        if o.type=='MESH':o.hide_render=o.get('li_role')!=role or o.name.startswith('HY_Source')
    for view,pos in [('front',(0,-9,height*.51)),('side',(9,0,height*.51)),('back',(0,9,height*.51))]:
        cam.location=pos;cam.rotation_euler=(Vector((0,0,height*.51))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=height*1.12
        scene.render.filepath=str(OUT/f'final-{role}-{view}.png');bpy.ops.render.render(write_still=True)
    cam.location=(0,-9,height*.51);cam.rotation_euler=(Vector((0,0,height*.51))-cam.location).to_track_quat('-Z','Y').to_euler()
    for name in ['blink','mouth_open']:
        for ob in parents[role].children:
            if ob.type=='MESH' and ob.data.shape_keys and name in ob.data.shape_keys.key_blocks:ob.data.shape_keys.key_blocks[name].value=1
        scene.render.filepath=str(OUT/f'expression-{role}-{name}.png');bpy.ops.render.render(write_still=True)
        for ob in parents[role].children:
            if ob.type=='MESH' and ob.data.shape_keys:
                for key in ob.data.shape_keys.key_blocks:key.value=0
for o in scene.objects:
    if o.type=='MESH':o.hide_render=o.get('li_role')!='hoodie' or o.name.startswith('HY_Source');o.hide_viewport=o.hide_render
scene.render.filepath=str(OUT/'final-hoodie-front.png');cam.location=(0,-9,1.81);cam.rotation_euler=(Vector((0,0,1.81))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=3.976
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots.blend'),compress=True)
(OUT/'delivery-inventory.json').write_text(json.dumps(report,indent=2))
print('HUNYUAN_DELIVERY_COMPLETE',json.dumps(report))
