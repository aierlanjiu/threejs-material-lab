from pathlib import Path
for file in ['export_li.py','render_phase_review.py','finalize_master.py']:
    exec((Path('/Users/papazed/dev/threejs-material-lab/scripts/blender')/file).read_text())
