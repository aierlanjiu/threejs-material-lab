import bpy
import addon_utils

addon_utils.enable('blender_mcp', default_set=True, persistent=True)
addon = bpy.context.preferences.addons.get('blender_mcp')
if addon:
    addon.preferences.telemetry_consent = False
bpy.context.scene.blendermcp_auto_start_server = True
if not getattr(bpy.types, 'blendermcp_server', None):
    bpy.ops.blendermcp.start_server()
bpy.ops.wm.save_userpref()
print('LI_BLENDER_MCP_READY', bpy.app.version_string)
