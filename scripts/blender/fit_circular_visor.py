import bpy
from pathlib import Path
scene=bpy.context.scene;root=Path('/Users/papazed/dev/threejs-material-lab');r=.806
visor=scene.objects['Visor fitted bubble']
assert abs(visor['rim_rx']-.849)<1e-5, 'Circular fit already applied'
sx=r/.849;sz=r/.762
for name in ['Visor fitted bubble','Orange silicone · fitted seal']:
    for v in scene.objects[name].data.vertices:v.co.x*=sx;v.co.z*=sz
for k,weight in enumerate([0,0,.5,1,1,1,0]):
    for i in range(128):
        v=scene.objects['Helmet continuous visor socket'].data.vertices[k*128+i];v.co.x*=1+(sx-1)*weight;v.co.z*=1+(sz-1)*weight
astro=scene.objects['AstroLychee'];head=next(o for o in astro.children if o.name.startswith('Head'))
for o in head.children:
    if o.get('li_part')=='VisorBolt' or o.name.startswith('Bolt recessed socket'):o.location.x*=sx;o.location.z*=sz
    if o.name.startswith('HUD ·'):o.scale.x*=sx;o.scale.z*=sz
visor['rim_rx']=r;visor['rim_rz']=r;visor['socket_radius_error']=0.0;visor['circular_seat']=True
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/mascots/blender/li-mascots-phase3.blend'))
print('CIRCULAR_VISOR_FITTED',r)
