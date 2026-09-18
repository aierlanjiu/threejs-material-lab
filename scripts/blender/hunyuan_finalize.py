from pathlib import Path
scripts=Path('/Users/papazed/dev/threejs-material-lab/scripts/blender')
for filename in ['hunyuan_suit_skin.py','hunyuan_seam_audit.py','hunyuan_export_only.py']:
    exec((scripts/filename).read_text())
