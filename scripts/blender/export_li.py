"""Make optimized export copies; keep the editable sculpt master intact."""
import bpy, re, json
from pathlib import Path
from collections import defaultdict

ROOT=Path('/Users/papazed/dev/threejs-material-lab')
OUT=ROOT/'assets/mascots/blender'
source=bpy.context.scene
report={}
for role,name in [('hoodie','HoodieLychee'),('astro','AstroLychee')]:
    export_scene=bpy.data.scenes.new('EXPORT '+role)
    mapping={}
    root=source.objects[name]
    for original in [root,*root.children_recursive]:
        if original.get('li_skip_export',False):continue
        copy=original.copy()
        if original.data:copy.data=original.data.copy()
        export_scene.collection.objects.link(copy);mapping[original]=copy
        copy.hide_render=False;copy.hide_viewport=False
        copy.name=role+'_'+original.name
        copy['li_part']=original.get('li_part',re.sub(r'\.\d+$','',original.name))
        copy['li_source']='Blender MCP native model'
    for original,copy in mapping.items():copy.parent=mapping.get(original.parent)
    bpy.context.window.scene=export_scene
    # One optical material per eye rig preserves colored layers while avoiding 5 draws per eye.
    eye_mat=bpy.data.materials['Eyes · obsidian'].copy();eye_mat.name=role+' Eyes · optical assembly'
    color_node=eye_mat.node_tree.nodes.new('ShaderNodeVertexColor');color_node.layer_name='Col'
    eye_mat.node_tree.links.new(color_node.outputs['Color'],eye_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    for o in list(export_scene.objects):
        bpy.ops.object.select_all(action='DESELECT')
        if o.type in ('CURVE','FONT'):
            if o.type=='FONT':
                o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
        if o.type=='CURVE':
            points=sum(len(s.bezier_points) for s in o.data.splines)
            o.data.resolution_u=3 if points>40 else 7
            o.data.bevel_resolution=2 if o.data.bevel_depth>.01 else 1
            o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
        if o.type=='MESH' and len(o.data.polygons)>450 and not o.get('rounded_rind') and not o.get('li_optical_shell') and 'insignia' not in o.name:
            o.select_set(True);bpy.context.view_layer.objects.active=o
            dec=o.modifiers.new('Delivery topology','DECIMATE');dec.ratio=.30 if 'boot' in o.name.lower() else .48;dec.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=dec.name)
        if o.type=='MESH' and o.parent and o.parent.get('li_part','').startswith('Eye.') and not o.get('li_optical_shell'):
            color=o.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:]
            layer=o.data.color_attributes.get('Col') or o.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
            for entry in layer.data:entry.color=color
            o.data.materials.clear();o.data.materials.append(eye_mat)
    # Batch only siblings with identical materials. Empty motion pivots and eye rigs survive.
    groups=defaultdict(list)
    for o in export_scene.objects:
        if o.type=='MESH':groups[(o.parent,tuple(m.name for m in o.data.materials))].append(o)
    for (parent,materials),items in groups.items():
        if len(items)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in items:ob.select_set(True)
        bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join()
        items[0].name=role+'_'+(parent.get('li_part',parent.name) if parent else 'root')+'_'+materials[0]
    # A measured delivery budget, leaving the source master untouched.
    rind=[];details=[]
    for ob in export_scene.objects:
        if ob.type!='MESH':continue
        ob.data.calc_loop_triangles();count=len(ob.data.loop_triangles)
        (rind if any(m.name.startswith('Rind') for m in ob.data.materials) else details).append((ob,count))
    # Reserve the detail budget first; dense sculpt crowns simplify only in the export copy.
    rind_budget=44000 if role=='hoodie' else 31000
    detail_budget=77000-rind_budget
    for items,budget in [(rind,rind_budget),(details,detail_budget)]:
        ratio=min(1,budget/max(1,sum(n for _,n in items)))
        for ob,count in items:
            if ratio>=1:continue
            if count<100:continue
            bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
            dec=ob.modifiers.new('Web triangle budget','DECIMATE');dec.ratio=ratio;dec.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=dec.name)
    bpy.ops.object.select_all(action='SELECT')
    path=OUT/f'{role}-lychee.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_apply=True,export_yup=True,export_animations=False)
    tris=0;meshes=0
    for ob in export_scene.objects:
        if ob.type=='MESH':ob.data.calc_loop_triangles();tris+=len(ob.data.loop_triangles);meshes+=1
    report[role]={'triangles':tris,'meshes':meshes,'bytes':path.stat().st_size,'file':str(path)}
    bpy.context.window.scene=source
(OUT/'manifest.json').write_text(json.dumps({'source':'Blender MCP 1.9.1','blender':bpy.app.version_string,'reference':'design_sheets/ortho_blueprints','models':report},indent=2))
print('EXPORT_COMPLETE',json.dumps(report))
