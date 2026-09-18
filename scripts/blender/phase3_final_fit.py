from pathlib import Path
exec((Path('/Users/papazed/dev/threejs-material-lab/scripts/blender/phase_helpers.py')).read_text())
light=scene.objects['Bounce · face card'];light.visible_glossy=False;light.data.specular_factor=0
p=bpy.data.materials['Eyes · obsidian'].node_tree.nodes['Principled BSDF'];p.inputs['Coat Weight'].default_value=0;p.inputs['Specular IOR Level'].default_value=.16
p=bpy.data.materials['Eyes · clear outer lens'].node_tree.nodes['Principled BSDF'];p.inputs['Coat IOR'].default_value=1.10;p.inputs['IOR'].default_value=1.25
for leg in [o for o in astro.children if o.name.startswith('Leg.')]:
    shoe=next(o for o in leg.children if o.name.startswith('Rounded sculpted boot') and not o.get('li_skip_export'))
    shoe.hide_viewport=False;bpy.context.view_layer.update()
    old=next(o for o in leg.children if o.name.startswith('Orange toe cap'));retire(old)
    vs=[];fs=[];nx=20;nz=8
    for j in range(nz+1):
        t=j/nz;z=.115+.080*t
        for i in range(nx+1):
            x=(i/nx*2-1)*.17;hit,p,n,k=shoe.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
            vs.append((x,p.y-.004 if hit else -.540,z))
    for j in range(nz):
        for i in range(nx):a=j*(nx+1)+i;fs.append((a,a+1,a+nx+2,a+nx+1))
    cap=mesh('Fitted orange toe inlay',vs,fs,bpy.data.materials['Hardware · orange silicone FF6B00'],leg);solidify(cap,.004)
scene.cycles.samples=64
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots-phase3.blend'))
print('FINAL_OPTICS_AND_INLAYS_FITTED')
