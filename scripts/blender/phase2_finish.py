import bpy
from pathlib import Path
scene=bpy.context.scene
ng=bpy.data.node_groups.new('LI optical bloom','CompositorNodeTree');scene.compositing_node_group=ng
ng.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
rl=ng.nodes.new('CompositorNodeRLayers');g=ng.nodes.new('CompositorNodeGlare');out=ng.nodes.new('NodeGroupOutput')
print('GLARE',[(s.name,s.type,str(s.default_value) if hasattr(s,'default_value') else '') for s in g.inputs])
if 'Type' in g.inputs:g.inputs['Type'].default_value='Fog Glow'
if 'Threshold' in g.inputs:g.inputs['Threshold'].default_value=2.0
if 'Strength' in g.inputs:g.inputs['Strength'].default_value=.18
ng.links.new(rl.outputs['Image'],g.inputs['Image']);ng.links.new(g.outputs['Image'],out.inputs['Image'])
scene['review_phase']='phase2'
root=Path('/Users/papazed/dev/threejs-material-lab');(root/'output/blender-mcp/phase2').mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/mascots/blender/li-mascots-phase2.blend'))
print('PHASE2_IDENTITY_COMPLETE',len([o for o in scene.objects if o.get('li_part')=='VisorBolt']))
