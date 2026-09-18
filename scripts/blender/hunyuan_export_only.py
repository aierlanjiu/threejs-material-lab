from pathlib import Path
root=Path('/Users/papazed/dev/threejs-material-lab')
exec((root/'scripts/blender/hunyuan_deliver.py').read_text().split('scene.cycles.samples=24',1)[0])
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots.blend'),compress=True)
(OUT/'delivery-inventory.json').write_text(json.dumps(report,indent=2))
print('HUNYUAN_EXPORT_COMPLETE')
