"""Render the exported GLB geometry on CPU for inspection, without Blender/GPU.

This is a studio geometry/material-colour preview, not a Cycles lookdev render.
It reads the delivered binary asset, including its hierarchy and vertex normals.
Requires numpy and Pillow; the project's existing audio runtime provides both.
"""
from pathlib import Path
import argparse
import json
import math
import struct

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'output/shell-concert-20261029'


def unit(v):
    return v/np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-12)


def load():
    data = (ROOT/'assets/models/band-shell-concert/shell-concert.glb').read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+size])
    binary = data[28+size:]

    def accessor(index):
        a = doc['accessors'][index]
        b = doc['bufferViews'][a['bufferView']]
        dtype = {5126:'<f4', 5125:'<u4', 5123:'<u2'}[a['componentType']]
        channels = {'VEC3':3, 'SCALAR':1}[a['type']]
        return np.frombuffer(binary, dtype=dtype, count=a['count']*channels,
                             offset=b.get('byteOffset', 0)+a.get('byteOffset', 0)).reshape(a['count'], channels)

    geometries = []

    def visit(index, translation):
        node = doc['nodes'][index]
        translation = translation+np.array(node.get('translation', [0,0,0]))
        if 'mesh' in node:
            for p in doc['meshes'][node['mesh']]['primitives']:
                geometries.append((accessor(p['attributes']['POSITION']).astype(float)+translation,
                                   accessor(p['attributes']['NORMAL']).astype(float),
                                   accessor(p['indices']).reshape(-1, 3), doc['materials'][p['material']]))
        for child in node.get('children', []):
            visit(child, translation)
    for index in doc['scenes'][0]['nodes']:
        visit(index, np.zeros(3))
    return geometries


def camera_frame(position, target):
    position, target = np.array(position, float), np.array(target, float)
    forward = unit(target-position)
    right = unit(np.cross(forward, [0,1,0]))
    up = unit(np.cross(right, forward))
    return position, np.stack([right, up, forward], axis=1)


def raster(vertices, faces, depth, colors=None, image=None, perspective=True):
    height, width = depth.shape
    # Tiny tubes and bulbs still receive subpixel coverage at this resolution.
    for tri in faces:
        p = vertices[tri]
        if np.any(p[:,2] <= .001):
            continue
        x0 = max(0, math.floor(float(p[:,0].min())))
        x1 = min(width-1, math.ceil(float(p[:,0].max())))
        y0 = max(0, math.floor(float(p[:,1].min())))
        y1 = min(height-1, math.ceil(float(p[:,1].max())))
        if x0 > x1 or y0 > y1:
            continue
        a, b, c = p
        denominator = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(denominator) < 1e-8:
            continue
        y, x = np.mgrid[y0:y1+1, x0:x1+1]
        x, y = x+.5, y+.5
        w0 = ((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/denominator
        w1 = ((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/denominator
        w2 = 1-w0-w1
        if perspective:
            inverse_depth = w0/a[2]+w1/b[2]+w2/c[2]
            z = 1/np.maximum(inverse_depth, 1e-12)
        else:
            z = w0*a[2]+w1*b[2]+w2*c[2]
        region = depth[y0:y1+1,x0:x1+1]
        mask = (w0 >= -1e-6)&(w1 >= -1e-6)&(w2 >= -1e-6)&(z < region)
        if not mask.any():
            continue
        region[mask] = z[mask]
        if colors is not None:
            color = colors[tri]
            blended = (w0[...,None]*color[0]/a[2]+w1[...,None]*color[1]/b[2]+w2[...,None]*color[2]/c[2])*z[...,None]
            image[y0:y1+1,x0:x1+1][mask] = blended[mask]


def render(geometries, name, position, target, lens, width):
    height = round(width*.625)
    cam, frame = camera_frame(position, target)
    focal = width*lens/36
    depth = np.full((height,width), np.inf)
    gradient = np.linspace(0, 1, height)[:,None,None]
    background = np.array([.88,.86,.82])[None,None,:]*(1-gradient)+np.array([.74,.78,.76])[None,None,:]*gradient
    image = np.repeat(background, width, axis=1)
    key = unit(np.array([-5., 10., 8.]))
    fill = unit(np.array([7., 5., 2.]))
    rim = unit(np.array([-2., 6., -7.]))

    # A real geometric shadow pass; orthographic depth is encoded with unit w.
    light_cam, light_frame = camera_frame(key*30+np.array([0,3,0]), (0,3,0))
    shadow_size, span = 900, 24
    shadow = np.full((shadow_size,shadow_size), np.inf)

    def shadow_project(vertices):
        light = (vertices-light_cam)@light_frame
        return np.stack([shadow_size*(.5+light[:,0]/span), shadow_size*(.5-light[:,1]/span), light[:,2]], axis=1)

    for verts, _, faces, _ in geometries:
        raster(shadow_project(verts), faces, shadow, perspective=False)

    def visibility(verts):
        p = shadow_project(verts)
        x, y = p[:,0].astype(int), p[:,1].astype(int)
        value = np.zeros(len(verts))
        for ox, oy in ((0,0),(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,1)):
            xx, yy = np.clip(x+ox, 0, shadow_size-1), np.clip(y+oy, 0, shadow_size-1)
            value += (p[:,2] <= shadow[yy,xx]+.045)
        return .22+.78*value/7

    # Reconstruct a ground plane per screen pixel for contact shadows, not a
    # painted silhouette or an image-generated substitute for model geometry.
    yy, xx = np.mgrid[0:height,0:width]
    rays = frame[:,2]+((xx-width/2)/focal)[...,None]*frame[:,0]-((yy-height/2)/focal)[...,None]*frame[:,1]
    distance = -cam[1]/np.minimum(rays[:,:,1], -1e-8)
    ground = cam+rays*distance[...,None]
    flat = ground.reshape(-1,3)
    mask = ((rays[:,:,1] < -1e-5)&(distance > 0)).reshape(-1)
    vis = np.ones(len(flat))
    vis[mask] = visibility(flat[mask])
    contact = Image.fromarray(np.uint8((1-vis.reshape(height,width))*150)).filter(ImageFilter.GaussianBlur(width/300))
    image *= 1-np.asarray(contact)[...,None]/255*.46

    for verts, ns, faces, material in geometries:
        pbr = material['pbrMetallicRoughness']
        color = np.array(pbr['baseColorFactor'][:3])
        metallic, roughness = pbr['metallicFactor'], pbr['roughnessFactor']
        view = unit(cam-verts)
        half_key = unit(view+key)
        half_fill = unit(view+fill)
        ndotl = np.maximum(ns@key, 0)
        lit = visibility(verts)
        ambient = .30+.16*np.maximum(ns[:,1],0)+.07*np.maximum(-ns[:,2],0)
        diffuse = ambient+ndotl*lit*.78+np.maximum(ns@fill,0)*.30+np.maximum(ns@rim,0)*.24
        reflected = np.maximum(np.sum(ns*half_key,axis=1),0)**(10+95*(1-roughness))
        highlight = reflected*lit*1.35+np.maximum(np.sum(ns*half_fill,axis=1),0)**30*.35
        specular = .08*(1-metallic)+metallic*color
        shaded = color[None,:]*diffuse[:,None]*(1-.22*metallic)+highlight[:,None]*specular[None,:]
        # Broad studio softboxes produce readable specular edges on the metal.
        fresnel = (1-np.maximum(np.sum(ns*view,axis=1),0))**4
        shaded += fresnel[:,None]*(.025+metallic*.09)*np.array([1.0,.88,.66])
        if 'emissiveFactor' in material:
            strength = material.get('extensions',{}).get('KHR_materials_emissive_strength',{}).get('emissiveStrength',1)
            shaded += np.array(material['emissiveFactor'])*strength*.45
        transformed = (verts-cam)@frame
        projected = np.stack([width/2+transformed[:,0]/transformed[:,2]*focal, height/2-transformed[:,1]/transformed[:,2]*focal, transformed[:,2]],axis=1)
        raster(projected, faces, depth, shaded, image)

    # Compress highlights while preserving the actual material colour palette.
    mapped = np.clip((image*(2.51*image+.03))/(image*(2.43*image+.59)+.14),0,1)
    srgb = np.where(mapped <= .0031308, mapped*12.92, 1.055*mapped**(1/2.4)-.055)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.uint8(np.clip(srgb,0,1)*255)).save(OUT/name)
    print(f'Rendered {name}: {width}×{height}, geometry read from delivered GLB', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--width', type=int, default=1440)
    args = parser.parse_args()
    geometry = load()
    render(geometry, 'studio-front.png', (1.0,10.2,24.2), (0,3.7,-1), 40, args.width)
    render(geometry, 'studio-three-quarter.png', (18,14.5,22), (0,3.5,-1.5), 48, args.width)
