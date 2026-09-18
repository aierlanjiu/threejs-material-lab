import bpy,json
from pathlib import Path
report={}
for role in ['hoodie','astro']:
    seen={};errors=[]
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or o.get('li_role')!=role or o.name.startswith('HY_Source') or o.get('li_accessory'):continue
        for v in o.data.vertices:
            co=tuple(round(k,5) for k in v.co);w={o.vertex_groups[g.group].name:round(g.weight,3) for g in v.groups if g.weight>.001}
            if co in seen and seen[co][0]!=o.name:
                prev=seen[co];err=max(abs(w.get(n,0)-prev[1].get(n,0)) for n in set(w)|set(prev[1]))
                if err>.01:errors.append((prev[0],o.name,co,err))
            else:seen[co]=(o.name,w)
    report[role]={'mismatches':len(errors),'max_error':max((e[3] for e in errors),default=0),'examples':errors[:12]}
Path('/Users/papazed/dev/threejs-material-lab/output/hunyuan-rig/seam-audit.json').write_text(json.dumps(report,indent=2));print(report)
