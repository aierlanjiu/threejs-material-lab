import bpy
s=bpy.context.scene
print([(p.identifier,p.type) for p in s.bl_rna.properties if 'compos' in p.identifier or 'node' in p.identifier])
print('GLARE_PROPS', [(p.identifier,p.type) for p in bpy.types.CompositorNodeGlare.bl_rna.properties])
