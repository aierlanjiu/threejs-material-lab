import bpy,json
from pathlib import Path
scene=bpy.context.scene
for name in ['EXPORT hoodie','EXPORT astro']:
    s=bpy.data.scenes.get(name)
    if not s:continue
    counts=[]
    for o in s.objects:
        if o.type=='MESH':o.data.calc_loop_triangles();counts.append((len(o.data.loop_triangles),o.name))
    print(name, sorted(counts,reverse=True)[:15])
