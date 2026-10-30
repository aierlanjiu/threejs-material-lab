"""Build the selected shell-concert stage with Blender, including a web GLB.

Run: blender -b --factory-startup --python scripts/build-shell-concert.py
The editable source retains curves, material nodes, cast preview and cameras.
The GLB contains real stage geometry and actor anchors, without the sea/backdrop.
"""
from pathlib import Path
import argparse
from datetime import date
import hashlib
import json
import math
import random
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from shell_concert_geometry import MATERIALS, CAST, build_stage, build_environment
parser = argparse.ArgumentParser()
parser.add_argument('--reference', type=Path, default=ROOT.parent / 'generated_images' / 'exec-f94a0a16-d6f8-4f9f-bc39-96831156911a.png')
parser.add_argument('--samples', type=int, default=40)
parser.add_argument('--width', type=int, default=1440)
parser.add_argument('--no-render', action='store_true')
parser.add_argument('--review', type=Path, default=ROOT / 'output/shell-concert-20261029/detail-finish')
parser.add_argument('--new-scene', action='store_true',
                    help='Build in a separate scene without deleting the current scene.')
parser.add_argument('--blend-only', action='store_true',
                    help='Save the editable scene without converting curves or replacing the GLB.')
parser.add_argument('--device', choices=('CPU', 'METAL'), default='CPU',
                    help='CPU avoids Cycles GPU discovery, not Blender startup GPU checks; opt into Metal explicitly.')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
OUT = ROOT / 'assets/models/band-shell-concert'
REVIEW = args.review
OUT.mkdir(parents=True, exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)
random.seed(291029)

if args.new_scene:
    if bpy.context.window is None:
        raise RuntimeError('--new-scene requires an active Blender window.')
    if bpy.context.mode != 'OBJECT':
        raise RuntimeError('Switch to Object Mode before building a separate scene.')
    scene = bpy.data.scenes.new('Pearl_shell_concert')
    bpy.context.window.scene = scene
else:
    if not bpy.app.background:
        raise RuntimeError('Interactive builds require --new-scene to preserve the current scene.')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1


def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


COLS = {k: collection(v) for k, v in {
    'stage': '01_Stage_Export', 'cast': '02_Cast_2_5D_Preview',
    'environment': '03_Lagoon_Render_Only', 'lights': '04_Lighting',
    'cameras': '05_Cameras', 'reference': '06_Selected_Reference',
}.items()}


def own(obj, col='stage', parent=None):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    COLS[col].objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def empty(name, loc=(0, 0, 0), parent=None, col='stage'):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    o.empty_display_size = .25
    o.empty_display_type = 'PLAIN_AXES'
    return own(o, col, parent)


STAGE = empty('ShellConcert_Stage')
STAGE['assetId'] = 'lu-shell-concert-v1'
STAGE['units'] = 'meters'
STAGE['reference'] = 'selected-image-2'


def rgba(hex_value):
    vals = [int(hex_value.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in vals) + (1,)


def material(name, color, metallic=0, roughness=.3, emission=0, transmission=0,
             subsurface=0, subsurface_radius=(.8,1.0,.65), iridescence=0,
             film_thickness=0, coat=.32, coat_roughness=.19, emission_color=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba(color)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    for name_, value in {'Base Color': rgba(color), 'Metallic': metallic,
                         'Roughness': roughness, 'IOR': 1.46,
                         'Coat Weight': coat, 'Coat Roughness': coat_roughness,
                         'Transmission Weight': transmission,
                         'Subsurface Weight': subsurface, 'Subsurface Scale': .06,
                         'Subsurface Radius': subsurface_radius,
                         'Thin Film Thickness': film_thickness if iridescence else 0,
                         'Thin Film IOR': 1.33}.items():
        if name_ in node.inputs:
            node.inputs[name_].default_value = value
    if emission:
        node.inputs['Emission Color'].default_value = rgba(emission_color or color)
        node.inputs['Emission Strength'].default_value = emission
    if name == 'Luminous_mother_pearl':
        # Dim emission leaves room for actual sphere shading and thin-film colour.
        texture=mat.node_tree.nodes.new('ShaderNodeTexNoise')
        texture.inputs['Scale'].default_value=3.8
        texture.inputs['Detail'].default_value=2
        ramp=mat.node_tree.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color=rgba('#dae6df')
        ramp.color_ramp.elements[1].color=rgba('#f7e7dc')
        mat.node_tree.links.new(texture.outputs['Fac'],ramp.inputs['Fac'])
        mat.node_tree.links.new(ramp.outputs['Color'],node.inputs['Base Color'])
        bump=mat.node_tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value=.055
        bump.inputs['Distance'].default_value=.008
        mat.node_tree.links.new(texture.outputs['Fac'],bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs['Normal'],node.inputs['Normal'])
    if name == 'Opalescent_seafoam_jade':
        # Keep camera/reflection shading intact, while allowing a small amount
        # of light through overlapping shells on direct shadow rays only.
        nodes,links=mat.node_tree.nodes,mat.node_tree.links
        path=nodes.new('ShaderNodeLightPath')
        soften=nodes.new('ShaderNodeMath');soften.operation='MULTIPLY'
        soften.name='Overlap_shadow_transparency_28_percent'
        soften.inputs[1].default_value=.28
        links.new(path.outputs['Is Shadow Ray'],soften.inputs[0])
        clear=nodes.new('ShaderNodeBsdfTransparent')
        mix_shadow=nodes.new('ShaderNodeMixShader')
        links.new(soften.outputs[0],mix_shadow.inputs[0])
        links.new(node.outputs[0],mix_shadow.inputs[1]);links.new(clear.outputs[0],mix_shadow.inputs[2])
        links.new(mix_shadow.outputs[0],nodes.get('Material Output').inputs['Surface'])
    return mat


M = {m['id']: material(**{k:v for k,v in m.items() if k!='id'})
     for m in MATERIALS}


def mesh_obj(name, verts, faces, mat, parent=STAGE, col='stage', smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    data.materials.append(mat)
    obj = bpy.data.objects.new(name, data)
    own(obj, col, parent)
    if smooth:
        for p in data.polygons:
            p.use_smooth = True
    return obj


def tube(name, points, radius, mat, parent=STAGE, col='stage', cyclic=False, resolution=2):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 1
    data.bevel_depth = radius
    data.bevel_resolution = resolution
    data.use_fill_caps = True
    spline = data.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    data.materials.append(mat)
    return own(bpy.data.objects.new(name, data), col, parent)


def orb(name, loc, radius, mat, parent=STAGE, col='stage', segments=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, radius=radius, location=loc)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return own(o, col, parent)


# Shared analytic geometry is also used by the graphics-independent exporter.
# Curves remain editable in the native source; GLB receives triangulated meshes.
def populate(items, col, known=None):
    objects=dict(known or {})
    for item in items:
        if item['name'] in objects:
            continue
        parent=objects.get(item['parent'])
        if item['kind']=='empty':
            obj=empty(item['name'],item['position'],parent,col)
        elif item['kind']=='curve':
            curve=item['curve']
            obj=tube(item['name'],curve['points'],curve['radius'],M[item['geometry']['materials'][0]],
                     parent,col,cyclic=curve['cyclic'],resolution=1)
            obj.location=item['position']
        else:
            geo=item['geometry']
            obj=mesh_obj(item['name'],geo['vertices'],geo['faces'],M[geo['materials'][0]],parent,col)
            obj.location=item['position']
            for key in geo['materials'][1:]:
                obj.data.materials.append(M[key])
            for polygon,index in zip(obj.data.polygons,geo['face_materials']):
                polygon.material_index=index
            obj.data.normals_split_custom_set_from_vertices(geo['normals'])
        for key,value in item.get('extras',{}).items():
            obj[key]=value
        objects[item['name']]=obj
    return objects


stage_nodes=populate(build_stage(),'stage',{'ShellConcert_Stage':STAGE})
environment_nodes=populate(build_environment(),'environment')


def point_light(name, loc, power, color, radius=.3):
    data = bpy.data.lights.new(name, 'POINT')
    data.energy, data.color, data.shadow_soft_size = power, rgba(color)[:3], radius
    o = bpy.data.objects.new(name, data)
    o.location = loc
    return own(o, 'lights')


for obj in stage_nodes.values():
    if obj.name.startswith('Pendant_') and obj.name.endswith('_opal_globe'):
        x, y, z = obj.location
        lamp=point_light(obj.name + '_practical', (x, y - .12, z), 90, '#ffe0ad', .38)
        lamp.data.specular_factor=.35
mother_practical=point_light('Mother_pearl_soft_practical',(0,3.20,2.20),150,'#ffd6a1',.30)
mother_practical.data.specular_factor=0
for obj in environment_nodes.values():
    if obj.name.startswith('Lagoon_floating_pearl_'):
        x,y,z=obj.location
        point_light(obj.name+'_practical',(x,y-.22,z+.02),10,'#ffe0ad',.24)


anchors = []
cast_preview_images = []
for ident, label, x, y, z, height, frame in CAST:
    anchor = stage_nodes['Actor_' + ident]
    anchor['actorId'] = 'one-piece/' + ident
    anchor['label'] = label
    anchor['billboardHeight'] = height
    anchors.append({'id': 'one-piece/' + ident, 'node': anchor.name,
                    'position': [x, z, -y], 'height': height})
    image = bpy.data.images.load(str(ROOT / f'assets/band-pets/one-piece/{ident}.webp'), check_existing=True)
    image.pack()
    cast_preview_images.append(image)
    mat = bpy.data.materials.new('Preview_' + ident)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out, tex = nodes.new('ShaderNodeOutputMaterial'), nodes.new('ShaderNodeTexImage')
    tex.image = image
    surface, transparent, mix = nodes.new('ShaderNodeBsdfPrincipled'), nodes.new('ShaderNodeBsdfTransparent'), nodes.new('ShaderNodeMixShader')
    surface.inputs['Roughness'].default_value=.42
    surface.inputs['Coat Weight'].default_value=.18
    surface.inputs['Emission Strength'].default_value=.25
    tint=nodes.new('ShaderNodeMixRGB')
    tint.name='Sunset_environment_tint_6_percent'
    tint.inputs[0].default_value=.06
    tint.inputs[2].default_value=rgba('#f4d9c4')
    links.new(tex.outputs['Color'],tint.inputs[1])
    links.new(tint.outputs[0],surface.inputs['Base Color'])
    links.new(tex.outputs['Color'], surface.inputs['Emission Color'])
    links.new(tex.outputs['Alpha'], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(surface.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs['Surface'])
    w = height * image.size[0] / 4 / image.size[1]
    obj = mesh_obj('CastPreview_' + ident, [(-w/2, 0, 0), (w/2, 0, 0), (w/2, 0, height), (-w/2, 0, height)], [(0, 1, 2, 3)], mat, None, 'cast', False)
    foot_margin=(20 if ident=='chopper' else 19)/320
    obj.location = (x, y, z - .018 - height * foot_margin)
    uv = obj.data.uv_layers.new(name='SpriteFrame')
    for loop, co in zip(obj.data.loops, [(frame/4, 0), ((frame+1)/4, 0), ((frame+1)/4, 1), (frame/4, 1)]):
        uv.data[loop.index].uv = co
    # A translucent radial footprint lies on the real deck, below the sprite.
    shadow_mat=bpy.data.materials.new('ContactShadow_'+ident)
    shadow_mat.use_nodes=True
    sn,sl=shadow_mat.node_tree.nodes,shadow_mat.node_tree.links
    sn.clear()
    sout=sn.new('ShaderNodeOutputMaterial')
    uv_node=sn.new('ShaderNodeTexCoord')
    distance=sn.new('ShaderNodeVectorMath');distance.operation='DISTANCE'
    distance.inputs[1].default_value=(.5,.5,0)
    sl.new(uv_node.outputs['UV'],distance.inputs[0])
    falloff=sn.new('ShaderNodeMapRange');falloff.interpolation_type='SMOOTHSTEP'
    for key,value in {'From Min':0,'From Max':.5,'To Min':.70,'To Max':0}.items():
        falloff.inputs[key].default_value=value
    sl.new(distance.outputs['Value'],falloff.inputs['Value'])
    clear=sn.new('ShaderNodeBsdfTransparent')
    dark=sn.new('ShaderNodeBsdfDiffuse');dark.inputs['Color'].default_value=rgba('#241e1a')
    mix_shadow=sn.new('ShaderNodeMixShader')
    sl.new(falloff.outputs['Result'],mix_shadow.inputs[0])
    sl.new(clear.outputs[0],mix_shadow.inputs[1]);sl.new(dark.outputs[0],mix_shadow.inputs[2])
    sl.new(mix_shadow.outputs[0],sout.inputs['Surface'])
    rx,ry=w*.38,.20 if ident!='chopper' else .15
    footprint=mesh_obj('CastContact_'+ident,[(-rx,-ry,0),(rx,-ry,0),(rx,ry,0),(-rx,ry,0)],[(0,1,2,3)],shadow_mat,None,'cast',False)
    footprint.location=(x,y,z-.018)
    suv=footprint.data.uv_layers.new(name='Radial_contact')
    for loop,co in zip(footprint.data.loops,[(0,0),(1,0),(1,1),(0,1)]):
        suv.data[loop.index].uv=co
    footprint.visible_shadow=False


# Lagoon environment is an editable Blender lookdev set, not part of the GLB.
water = material('Turquoise_lagoon_water', '#58aaa3', .0, .14, transmission=.58, coat=.25)
node = water.node_tree.nodes.get('Principled BSDF')
node.inputs['IOR'].default_value=1.333
coordinates=water.node_tree.nodes.new('ShaderNodeTexCoord')
noise = water.node_tree.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value=.70
noise.inputs['Detail'].default_value=4
water.node_tree.links.new(coordinates.outputs['Object'],noise.inputs['Vector'])
wave=water.node_tree.nodes.new('ShaderNodeTexWave')
wave.wave_type='BANDS'
wave.bands_direction='X'
wave.inputs['Scale'].default_value=.8
wave.inputs['Distortion'].default_value=6
wave.inputs['Detail Scale'].default_value=.45
water.node_tree.links.new(coordinates.outputs['Object'],wave.inputs['Vector'])
mix=water.node_tree.nodes.new('ShaderNodeMixRGB')
mix.blend_type='ADD'
mix.inputs[0].default_value=.22
water.node_tree.links.new(noise.outputs['Fac'],mix.inputs[1])
water.node_tree.links.new(wave.outputs['Color'],mix.inputs[2])
bump = water.node_tree.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value=.24
bump.inputs['Distance'].default_value=.15
water.node_tree.links.new(mix.outputs[0],bump.inputs['Height'])
water.node_tree.links.new(bump.outputs['Normal'],node.inputs['Normal'])
# A restrained distance fade lifts only the remote water's dark horizon.
view_distance=water.node_tree.nodes.new('ShaderNodeCameraData')
horizon=water.node_tree.nodes.new('ShaderNodeMapRange')
horizon.name='Distant_sunset_water_scatter'
horizon.interpolation_type='SMOOTHSTEP'
for key,value in {'From Min':45,'From Max':190,'To Min':0,'To Max':.16}.items():
    horizon.inputs[key].default_value=value
water.node_tree.links.new(view_distance.outputs['View Distance'],horizon.inputs['Value'])
node.inputs['Emission Color'].default_value=rgba('#c9a88e')
water.node_tree.links.new(horizon.outputs['Result'],node.inputs['Emission Strength'])
bpy.ops.mesh.primitive_plane_add(size=2000,location=(0,12,-.035))
sea=bpy.context.object
sea.name='Lagoon_surface_render_only'
sea.data.materials.append(water)
own(sea,'environment')
seabed=material('Lagoon_sand_bed','#4e9a8b',.0,.95)
bpy.ops.mesh.primitive_plane_add(size=2000,location=(0,12,-2.2))
floor=bpy.context.object
floor.name='Lagoon_sand_bed_render_only'
floor.data.materials.append(seabed)
own(floor,'environment')

world = bpy.data.worlds.new('Pearl_lagoon_sunset')
world.use_nodes = True
scene.world = world
sky_image=bpy.data.images.load(str(OUT/'sunset-sky.png'),check_existing=True)
sky_image.pack()
sky=world.node_tree.nodes.new('ShaderNodeTexEnvironment')
sky.image=sky_image
sky.projection='EQUIRECTANGULAR'
sky.texture_mapping.rotation=(0,0,math.radians(-90))
sky.texture_mapping.scale=(1,1,3)
world.node_tree.links.new(sky.outputs['Color'],world.node_tree.nodes['Background'].inputs['Color'])
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.80
world.mist_settings.start=35
world.mist_settings.depth=180
world.mist_settings.falloff='QUADRATIC'
scene.view_layers[0].use_pass_mist=True
scene.view_layers[0].use_pass_emit=True


def area(name, loc, target, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size, data.color = energy, 'DISK', size, rgba(color)[:3]
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return own(obj, 'lights')


area('Key_soft_apricot', (-6, -9, 10), (0, 0, 2), 1800, 9, '#ffe6ce')
area('Fill_lagoon', (8, -2, 7), (0, 0, 2), 950, 8, '#e6f0e9')
area('Rim_shell_gold', (-5, 10, 9), (0, 1, 3), 3000, 7, '#ffb875')
area('Backlight_through_opal', (0, 9, 5.5), (0, 3.5, 4.2), 3150, 10, '#ffd6a2')
for i,(loc,target) in enumerate([((-5,4.0,4.2),(-5,2.2,4.2)),((0,5.1,5.8),(0,3.4,5.6)),((5,4.3,4.3),(5,2.3,4.3))]):
    light=area(f'Opal_internal_softbox_{i}',loc,target,480,4.0,'#fff0d2')
    light.visible_camera=False
    light.visible_glossy=False
    light.visible_transmission=False
    light.data.specular_factor=0
    light.data.transmission_factor=0
# Low-power strips under each front arc wash the next tread, without raising
# the global exposure or turning the independently shaded mother pearl white.
for tier,(cy,rx,ry,top) in enumerate([(.25,7.6,4.45,.43),(.95,6.8,3.35,.83),(1.60,5.9,2.82,1.22),(2.30,5.0,2.20,1.60)]):
    for j,a in enumerate((-.72,-.36,0,.36,.72)):
        x=rx*math.sin(a);y=cy-ry*math.cos(a)
        wash=area(f'Step_wash_{tier}_{j}',(x,y+.06,top-.09),(x,y-.55,top-.36),22,1.9,'#ffd6a2')
        wash.data.shape='RECTANGLE';wash.data.size_y=.10
        wash.data.specular_factor=.25
glade=area('Low_sunset_water_glade',(-4,26,5),(0,-8,-.035),1100,13,'#ffd3a0')
glade.data.shape='RECTANGLE';glade.data.size_y=3
glade.data.diffuse_factor=.12


def camera(name, loc, target, lens):
    data = bpy.data.cameras.new(name)
    data.lens, data.sensor_width, data.clip_end = lens, 36, 400
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return own(obj, 'cameras')


cam_main = camera('Camera_reference_front', (1.0, -29.5, 6.8), (0, 1.0, 4.1), 43)
cam_angle = camera('Camera_model_three_quarter', (24.0, -30.0, 16.5), (0, 1.5, 3.8), 43)
camera('Camera_shell_detail', (-10, -9, 9.5), (-2.1, 3.3, 5.4), 55)
focus=empty('Focus_Luffy',(0,-4.15,1.50),col='cameras')
for cam in (cam_main,cam_angle):
    cam.data.dof.use_dof=True
    cam.data.dof.focus_object=focus
    cam.data.dof.aperture_fstop=4.0
    cam.data.dof.aperture_blades=7
scene.camera = cam_main

if args.reference.exists():
    image = bpy.data.images.load(str(args.reference), check_existing=True)
    image.pack()
    ref = empty('Selected_image_2_reference', (0, 10, 5), col='reference')
    ref.empty_display_type = 'IMAGE'
    ref.data = image
    ref.empty_display_size = 15
    ref.hide_render = True
    ref.hide_viewport = True

scene.render.engine = 'CYCLES'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 7
scene.cycles.transmission_bounces = 5
scene.cycles.transparent_max_bounces = 8
scene.cycles.device = 'CPU'
if args.device == 'METAL':
    try:
        preferences = bpy.context.preferences.addons['cycles'].preferences
        preferences.compute_device_type = 'METAL'
        preferences.get_devices()
        devices = [d for d in preferences.devices if d.type == 'METAL']
        if devices:
            for d in preferences.devices:
                d.use = d.type == 'METAL'
            scene.cycles.device = 'GPU'
            print('Render device:', [d.name for d in devices], flush=True)
    except Exception as exc:
        print('CPU rendering:', str(exc), flush=True)
scene.render.resolution_x = args.width
scene.render.resolution_y = round(args.width * 9 / 16)
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = -.25
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except (TypeError, ValueError):
    pass
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8

# Blender 5.1 uses a scene compositor node group, rather than scene.node_tree.
compositor=bpy.data.node_groups.new('Sunset_pearl_soft_glow','CompositorNodeTree')
compositor.interface.new_socket(name='Image',in_out='INPUT',socket_type='NodeSocketColor')
compositor.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
input_node=compositor.nodes.new('CompositorNodeRLayers')
input_node.scene=scene
mist_scale=compositor.nodes.new('ShaderNodeMath');mist_scale.operation='MULTIPLY'
mist_scale.inputs[1].default_value=.28
compositor.links.new(input_node.outputs['Mist'],mist_scale.inputs[0])
atmosphere=compositor.nodes.new('ShaderNodeMix')
atmosphere.data_type='RGBA'
atmosphere.blend_type='MIX'
atmosphere.inputs[7].default_value=rgba('#b49aa9')
compositor.links.new(mist_scale.outputs[0],atmosphere.inputs[0])
compositor.links.new(input_node.outputs['Image'],atmosphere.inputs[6])
output_node=compositor.nodes.new('NodeGroupOutput')
glare=compositor.nodes.new('CompositorNodeGlare')
glare.inputs['Type'].default_value='Fog Glow'
glare.inputs['Quality'].default_value='High'
glare.inputs['Threshold'].default_value=.95
glare.inputs['Strength'].default_value=2.0
glare.inputs['Size'].default_value=.12
glare.inputs['Tint'].default_value=rgba('#ffe6bf')
# Extract the halo from emission, so polished floor highlights do not turn the
# whole image hazy. Keep the original beauty image and mother-pearl shading.
compositor.links.new(input_node.outputs['Emission'],glare.inputs['Image'])
add_glow=compositor.nodes.new('ShaderNodeMix')
add_glow.data_type='RGBA';add_glow.blend_type='ADD';add_glow.clamp_result=False
add_glow.inputs[0].default_value=1
compositor.links.new(atmosphere.outputs[2],add_glow.inputs[6])
compositor.links.new(glare.outputs['Glare'],add_glow.inputs[7])
compositor.links.new(add_glow.outputs[2],output_node.inputs['Image'])
scene.compositing_node_group=compositor

# Saved source is camera-ready and all referenced images are packed.
# Interactive runs change only the current window's viewport, not other workspaces.
screens = [bpy.context.screen] if args.new_scene else list(bpy.data.screens)
for screen in filter(None, screens):
    for space_area in screen.areas:
        if space_area.type == 'VIEW_3D':
            space_area.spaces.active.region_3d.view_perspective = 'CAMERA'
            space_area.spaces.active.clip_end = 500
blend_path = OUT / 'shell-concert.blend'
if args.new_scene:
    # Write just the generated scene and its dependencies. The user's unrelated
    # scenes, objects and file identity stay in the original Blender session.
    bpy.data.libraries.write(str(blend_path), {scene}, path_remap='RELATIVE_ALL', compress=True)
else:
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

# Both exports use the same analytic source as the editable native objects.
import importlib.util
export_spec=importlib.util.spec_from_file_location('shell_export',ROOT/'scripts/export-shell-concert.py')
export_module=importlib.util.module_from_spec(export_spec)
export_spec.loader.exec_module(export_module)
if not args.blend_only:
    export_module.export()
manifest_path=OUT/'manifest.json'
manifest=json.loads(manifest_path.read_text())
manifest['source']=blend_path.name
manifest['blenderVersion']=bpy.app.version_string
manifest['sourceFingerprint']=export_module.source_fingerprint()
manifest['nativeBlend']={'status':'ready','scene':scene.name,'backend':'blender',
                         'sourceFingerprint':manifest['sourceFingerprint'],
                         'generatedWithoutRendering':True,
                         'renderVerification':{'status':'not-run' if args.no_render else 'pending'}}
manifest['sha256'][blend_path.name]=hashlib.sha256(blend_path.read_bytes()).hexdigest()
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
proof={'scene':scene.name,'blenderVersion':bpy.app.version_string,
       'objects':len(scene.objects),
       'types':{kind:sum(o.type==kind for o in scene.objects) for kind in ('MESH','CURVE','EMPTY','LIGHT','CAMERA')},
       'packedCastImages':all(image.packed_file is not None for image in cast_preview_images),
       'castMode':'2.5D','castIds':[entry[0] for entry in CAST],
       'nativeBlendBytes':blend_path.stat().st_size,'sha256':manifest['sha256'][blend_path.name],
       'sourceFingerprint':manifest['sourceFingerprint'],'rendered':False,'renders':[]}
(REVIEW/'native-build.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print('SHELL_CONCERT_NATIVE_READY',str(blend_path),flush=True)

if not args.no_render:
    for cam, filename in ((cam_main, 'front.png'), (cam_angle, 'three-quarter.png')):
        scene.camera = cam
        scene.render.filepath = str(REVIEW / filename)
        bpy.ops.render.render(write_still=True)
        check_image=bpy.data.images.load(str(REVIEW/filename),check_existing=False)
        samples=[check_image.pixels[i*4] for i in range(0,check_image.size[0]*check_image.size[1],997)]
        if max(samples)-min(samples)<.05 or sum(samples)/len(samples)<.005:
            raise RuntimeError('Rendered image is blank or lacks scene detail: '+filename)
        proof['renders'].append({'camera':cam.name,'file':filename,'bytes':(REVIEW/filename).stat().st_size})
    proof['rendered']=True
    (REVIEW/'native-build.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
    manifest['nativeBlend']['renderVerification']={'status':'completed','engine':'CYCLES',
        'device':args.device,'samples':args.samples,'resolution':[scene.render.resolution_x,scene.render.resolution_y],
        'views':['front','three-quarter']}
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('SHELL_CONCERT_BUILT' , str(OUT), flush=True)
