"""Shared, renderer-independent geometry for the selected pearl-shell stage.

Coordinates use Blender's right-handed Z-up convention; dimensions are metres.
Both the Blender builder and the portable GLB exporter use this source.
"""
import math


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def scale(v, s):
    return tuple(x * s for x in v)


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def unit(v):
    length = math.sqrt(dot(v, v))
    if length < 1e-12:
        raise ValueError('Degenerate vector in stage geometry')
    return scale(v, 1/length)


def linear_color(value):
    rgb = [int(value.lstrip('#')[i:i+2], 16)/255 for i in (0, 2, 4)]
    return [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]


MATERIALS = [
    dict(id='porcelain', name='Polished_pearl_marble', color='#f3ecdf', metallic=.07, roughness=.06, coat=1.0, coat_roughness=.03, subsurface=.04),
    dict(id='ivory', name='Mother_of_pearl_shell_lip', color='#f5e9ce', metallic=.10, roughness=.16, coat=.50, iridescence=.30, film_thickness=450),
    dict(id='jade', name='Opalescent_seafoam_jade', color='#cdebe0', metallic=.0, roughness=.20, transmission=.65, subsurface=.35, subsurface_radius=(1.0,.8,.5), iridescence=.45, film_thickness=450, coat=.50, coat_roughness=.10),
    dict(id='jade_rib', name='Fluted_opalescent_glass_ribs', color='#d6ede4', metallic=.0, roughness=.16, transmission=.35, subsurface=.18, iridescence=.35, film_thickness=450, coat=.50),
    dict(id='gold', name='Polished_champagne_gold', color='#f7d896', metallic=.95, roughness=.12, coat=.40, coat_roughness=.10),
    dict(id='pearl', name='Iridescent_pearl', color='#fff0d4', metallic=.08, roughness=.13, subsurface=.25, iridescence=.45, film_thickness=450, coat=.50, emission=2.2, emission_color='#bca375'),
    dict(id='mother', name='Luminous_mother_pearl', color='#f5eadb', metallic=.05, roughness=.12, subsurface=.30, iridescence=.60, film_thickness=450, emission=1.2, emission_color='#7b6d60', coat=.80, coat_roughness=.10),
    dict(id='glow', name='Warm_LED_2700K', color='#ffd19a', metallic=.0, roughness=.24, emission=8.0),
    dict(id='bulb', name='Opal_lantern_2700K', color='#ffe0ad', metallic=.0, roughness=.22, emission=22.0, emission_color='#b77d3e'),
    dict(id='dark', name='Lamp_hardware', color='#403e37', metallic=.50, roughness=.32),
    dict(id='island_near', name='Twilight_island_near', color='#4a3e4d', metallic=.0, roughness=1.0, coat=0, emission=.12),
    dict(id='island_mid', name='Twilight_island_mid', color='#79677b', metallic=.0, roughness=1.0, coat=0, emission=.20),
    dict(id='island_far', name='Twilight_island_far', color='#a08b9b', metallic=.0, roughness=1.0, coat=0, emission=.28),
    dict(id='harbour_2200', name='Harbour_warm_2200K', color='#ffb66b', metallic=.0, roughness=.50, coat=0, emission=7),
    dict(id='harbour_2500', name='Harbour_warm_2500K', color='#ffc78e', metallic=.0, roughness=.50, coat=0, emission=6),
    dict(id='harbour_2800', name='Harbour_warm_2800K', color='#ffd6a8', metallic=.0, roughness=.50, coat=0, emission=5),
]

CAST = [
    ('luffy', '路飞', 0, -4.15, .50, 2.18, 2),
    ('zoro', '索隆', -4.9, -1.10, .85, 2.0, 1),
    ('nami', '娜美', 3.35, -1.45, .85, 1.92, 2),
    ('chopper', '乔巴', 5.25, -.75, .85, 1.62, 1),
    ('sanji', '山治', -2.8, .45, 1.24, 1.9, 2),
    ('robin', '罗宾', -4.60, .50, 1.24, 2.0, 2),
    ('usopp', '乌索普', -1.15, 2.15, 1.62, 1.90, 2),
    ('ace', '艾斯', .85, 2.15, 1.62, 1.92, 1),
    ('law', '罗', 3.70, .50, 1.24, 1.95, 1),
    ('shanks', '香克斯', 5.2, 1.35, 1.24, 2.05, 1),
]


def normals(vertices, faces):
    accumulated = [[0., 0., 0.] for _ in vertices]
    for a, b, c in faces:
        n = cross(sub(vertices[b], vertices[a]), sub(vertices[c], vertices[a]))
        for index in (a, b, c):
            for axis in range(3):
                accumulated[index][axis] += n[axis]
    return [unit(v) for v in accumulated]


def mesh(vertices, faces, material, face_materials=None, vertex_normals=None):
    return dict(vertices=vertices, faces=faces, materials=[material],
                face_materials=face_materials or [0]*len(faces),
                normals=vertex_normals or normals(vertices, faces))


def sphere(radius, segments=20, rings=12):
    vertices = [(0, 0, radius)]
    for j in range(1, rings):
        phi = math.pi*j/rings
        for i in range(segments):
            a = math.tau*i/segments
            vertices.append((radius*math.sin(phi)*math.cos(a), radius*math.sin(phi)*math.sin(a), radius*math.cos(phi)))
    bottom = len(vertices)
    vertices.append((0, 0, -radius))
    faces = [(0, 1+i, 1+(i+1)%segments) for i in range(segments)]
    for j in range(rings-2):
        row = 1+j*segments
        for i in range(segments):
            k = (i+1)%segments
            faces.extend([(row+i, row+segments+i, row+segments+k), (row+i, row+segments+k, row+k)])
    row = 1+(rings-2)*segments
    faces += [(row+i, bottom, row+(i+1)%segments) for i in range(segments)]
    return vertices, faces, [unit(v) for v in vertices]


def tube_mesh(points, radius, cyclic=False, sides=8):
    vertices, vertex_normals, faces = [], [], []
    count = len(points)
    previous = None
    for i, p in enumerate(points):
        before = points[(i-1)%count] if i or cyclic else p
        after = points[(i+1)%count] if i < count-1 or cyclic else p
        tangent = unit(sub(after, before))
        if previous is None:
            reference = (0, 0, 1) if abs(tangent[2]) < .92 else (0, 1, 0)
            u = unit(cross(tangent, reference))
        else:
            projected = sub(previous, scale(tangent, dot(previous, tangent)))
            u = unit(projected)
        v = unit(cross(tangent, u))
        previous = u
        for j in range(sides):
            a = math.tau*j/sides
            n = add(scale(u, math.cos(a)), scale(v, math.sin(a)))
            vertices.append(add(p, scale(n, radius)))
            vertex_normals.append(n)
    for i in range(count if cyclic else count-1):
        next_row = ((i+1)%count)*sides
        for j in range(sides):
            k = (j+1)%sides
            a, b, c, d = i*sides+j, i*sides+k, next_row+k, next_row+j
            faces.extend([(a, b, c), (a, c, d)])
    if not cyclic:
        for row, direction in ((0, -1), (count-1, 1)):
            normal = scale(unit(sub(points[1], points[0]) if row == 0 else sub(points[-1], points[-2])), direction)
            start = len(vertices)
            vertices.extend([points[row]] + [vertices[row*sides+j] for j in range(sides)])
            vertex_normals.extend([normal]*(sides+1))
            for j in range(sides):
                triangle = (start, start+1+j, start+1+(j+1)%sides)
                faces.append(triangle if direction > 0 else tuple(reversed(triangle)))
    return vertices, faces, vertex_normals


def shell_dish(rx, ry, depth, thickness=.06, segments=72, rings=12):
    """Closed scalloped bowl, with a submerged skirt for foreground shells."""
    vertices = [(0, 0, 0)]
    for j in range(1, rings+1):
        r = j/rings
        for i in range(segments):
            a = math.tau*i/segments
            scallop = 1 + .035*math.cos(a*12)*r**4
            vertices.append((rx*r*math.cos(a)*scallop, ry*r*math.sin(a)*scallop,
                             depth*r**1.7*(1+.12*math.sin(a)) + .025*math.cos(a*12)*r**3))
    faces = [(0, 1+i, 1+(i+1)%segments) for i in range(segments)]
    for j in range(rings-1):
        inner, outer = 1+j*segments, 1+(j+1)*segments
        for i in range(segments):
            k=(i+1)%segments
            faces.extend([(inner+i, outer+i, outer+k), (inner+i, outer+k, inner+k)])
    count=len(vertices)
    vertices += [(x,y,z-thickness) for x,y,z in vertices]
    faces += [tuple(i+count for i in reversed(f)) for f in list(faces)]
    rim=1+(rings-1)*segments
    for i in range(segments):
        a,b=rim+i,rim+(i+1)%segments
        faces.extend([(a,b+count,b),(a,a+count,b+count)])
    return vertices, faces


def build_stage():
    nodes = []

    def node(name, kind='empty', parent='ShellConcert_Stage', position=(0, 0, 0), **kwargs):
        item = dict(name=name, kind=kind, parent=parent, position=position, **kwargs)
        nodes.append(item)
        return item

    node('ShellConcert_Stage', parent=None, extras=dict(assetId='lu-shell-concert-v1', units='meters', reference='selected-image-2'))

    def tubing(name, points, radius, material, parent='ShellConcert_Stage', cyclic=False, sides=8):
        vertices, faces, ns = tube_mesh(points, radius, cyclic, sides)
        return node(name, 'curve', parent, geometry=mesh(vertices, faces, material, vertex_normals=ns),
                    curve=dict(points=points, radius=radius, cyclic=cyclic, sides=sides))

    def orb(name, position, radius, material, segments=20, rings=12):
        vertices, faces, ns = sphere(radius, segments, rings)
        node(name, 'mesh', position=position, geometry=mesh(vertices, faces, material, vertex_normals=ns))

    def deck(name, center, rx, ry, bottom, top, segments=120):
        cx, cy = center
        bevel = .055
        profile = []
        for j in range(4):
            a = math.pi*j/6
            profile.append((bevel*(1-math.sin(a)), bottom+bevel*(1-math.cos(a))))
        profile.append((0, top-bevel))
        for j in range(1, 4):
            a = math.pi*j/6
            profile.append((bevel*(1-math.cos(a)), top-bevel+bevel*math.sin(a)))
        vertices = [(cx+(rx-inset)*math.cos(i*math.tau/segments), cy+(ry-inset)*math.sin(i*math.tau/segments), z)
                    for inset, z in profile for i in range(segments)]
        faces = []
        for j in range(len(profile)-1):
            for i in range(segments):
                a, b, c, d = j*segments+i, j*segments+(i+1)%segments, (j+1)*segments+(i+1)%segments, (j+1)*segments+i
                faces.extend([(a, b, c), (a, c, d)])
        ns = normals(vertices, faces)
        for j, normal, z in ((0, (0, 0, -1), bottom), (len(profile)-1, (0, 0, 1), top)):
            start = len(vertices)
            vertices.extend([(cx, cy, z)] + vertices[j*segments:(j+1)*segments])
            ns.extend([normal]*(segments+1))
            for i in range(segments):
                triangle = (start, start+1+i, start+1+(i+1)%segments)
                faces.append(triangle if j else tuple(reversed(triangle)))
        node(name, 'mesh', geometry=mesh(vertices, faces, 'porcelain', vertex_normals=ns))
        ring = [(cx+rx*math.cos(i*math.tau/segments), cy+ry*math.sin(i*math.tau/segments), top-.045) for i in range(segments)]
        tubing(name+'_champagne_edge', ring, .045, 'gold', cyclic=True)
        ring = [(cx+(rx+.008)*math.cos(i*math.tau/segments), cy+(ry+.008)*math.sin(i*math.tau/segments), top-.115) for i in range(segments)]
        tubing(name+'_warm_underlight', ring, .024, 'glow', cyclic=True, sides=6)

    deck('01_Lagoon_foundation', (0, .25), 7.6, 4.45, .05, .43)
    deck('02_Lower_ensemble_deck', (0, .95), 6.8, 3.35, .4, .83)
    deck('03_Middle_ensemble_deck', (0, 1.60), 5.9, 2.82, .8, 1.22)
    deck('04_Back_ensemble_deck', (0, 2.30), 5.0, 2.20, 1.2, 1.60)
    deck('05_Solo_bridge', (0, -2.65), 1.88, 1.85, .08, .46, 80)
    deck('06_Foreground_solo_island', (0, -4.15), 2.28, 1.57, .05, .48)

    specs = [
        ('Shell_01_outer_left', (-.7, 2.80, 1.05), (-8.8, 3.75, 5.70), 2.60, 1.80),
        ('Shell_02_high_left', (-.35, 3.15, 1.15), (-4.80, 5.60, 8.20), 3.15, 2.10),
        ('Shell_03_crown_left', (0, 3.55, 1.25), (-.90, 6.40, 9.10), 3.45, 2.25),
        ('Shell_04_high_right', (.35, 3.30, 1.15), (4.90, 5.80, 8.10), 3.25, 2.15),
        ('Shell_05_mid_right', (.65, 3.0, 1.05), (8.60, 4.85, 6.40), 2.70, 1.90),
        ('Shell_06_outer_right', (.90, 2.65, 1.05), (9.40, 3.40, 4.60), 2.35, 1.70),
    ]
    shell_points = []
    for name, base, tip, width, depth in specs:
        axis = sub(tip, base)
        front = unit((0, -1, .04))
        across = unit(cross(axis, front))
        hinge = name+'_hinge'
        node(hinge, position=base, extras=dict(runtimeRole='canopy-petal', maxMotionRadians=.035))

        def point(u, t, width=width, depth=depth, axis=axis, across=across, front=front):
            # A broad upper fan with a rounded crown, rather than a long leaf.
            profile = (math.sin(math.pi*.5*t/.70)**.85 if t <= .70
                       else math.sqrt(max(0, 1-((t-.70)/.30)**2)))
            spread = width*profile
            wave = max(0, math.sin(math.pi*t))
            bow = -depth*wave**.85*(1-u*u) + .32*depth*wave**.55*abs(u)**6
            return add(add(scale(axis, t), scale(across, spread*u)), scale(front, bow))

        shell_points.append((base, point))
        nu, nv = 32, 56
        def station(s):
            return (1-math.cos(math.pi*s))/2
        vertices = [(0, 0, 0)]
        for j in range(1, nv):
            vertices += [point(-1+2*i/nu, station(j/nv)) for i in range(nu+1)]
        tip_index = len(vertices)
        vertices.append(axis)
        faces, face_mats = [], []
        for i in range(nu):
            faces.append((0, i+2, i+1))
            face_mats.append(int(i < 2 or i >= nu-2))
        for j in range(nv-2):
            row = 1+j*(nu+1)
            for i in range(nu):
                a, b, c, d = row+i, row+i+1, row+i+nu+2, row+i+nu+1
                faces.extend([(a, b, c), (a, c, d)])
                face_mats.extend([int(i < 2 or i >= nu-2)]*2)
        row = 1+(nv-2)*(nu+1)
        for i in range(nu):
            faces.append((row+i, row+i+1, tip_index))
            face_mats.append(1)
        ns = normals(vertices, faces)
        count = len(vertices)
        front_vertices = [add(v, scale(n, .035)) for v, n in zip(vertices, ns)]
        back_vertices = [sub(v, scale(n, .035)) for v, n in zip(vertices, ns)]
        solid_vertices = front_vertices+back_vertices
        solid_faces = faces+[tuple(i+count for i in reversed(f)) for f in faces]
        solid_ns = ns+[scale(n, -1) for n in ns]
        solid_mats = face_mats+face_mats
        # Duplicate rim vertices for separate side normals and a closed 7cm shell.
        boundary = [0]+[1+j*(nu+1) for j in range(nv-1)]+[tip_index]+[1+j*(nu+1)+nu for j in reversed(range(nv-1))]
        rim_start = len(solid_vertices)
        rim_vertices = front_vertices+back_vertices
        rim_faces = []
        for i, a in enumerate(boundary):
            b = boundary[(i+1)%len(boundary)]
            rim_faces.extend([(a, b, b+count), (a, b+count, a+count)])
        # Keep only boundary vertices; unused surface vertices have no normals.
        remap = {v: i for i, v in enumerate(boundary+[v+count for v in boundary])}
        compact = [rim_vertices[v] for v in remap]
        compact_faces = [tuple(remap[v] for v in f) for f in rim_faces]
        solid_vertices += compact
        solid_ns += normals(compact, compact_faces)
        solid_faces += [tuple(i+rim_start for i in f) for f in compact_faces]
        solid_mats += [1]*len(compact_faces)
        geometry = mesh(solid_vertices, solid_faces, 'jade', solid_mats, solid_ns)
        geometry['materials'].append('ivory')
        node(name+'_scooped_panel', 'mesh', hinge, geometry=geometry)
        edge = [point(-1, station(j/96)) for j in range(97)]+[point(1, station(j/96)) for j in range(95, 0, -1)]
        tubing(name+'_ivory_bolstered_rim', edge, .14, 'ivory', hinge, cyclic=True, sides=10)
        tubing(name+'_gold_perimeter', [add(p, scale(front, .13)) for p in edge], .055, 'gold', hinge, cyclic=True)
        for k in range(19):
            u = -.90+k*1.80/18
            points = [add(point(u, .075+j*.85/31), scale(front, .052)) for j in range(32)]
            tubing(name+f'_flute_{k:02}', points, .024, 'jade_rib', hinge, sides=6)

    # Canopy stations determine the overhead height; the final visible drops
    # share each globe's X/Y axis instead of cutting diagonally across petals.
    lanterns = [(1,.80,-.28,1.2), (1,.60,.25,1.0), (2,.84,.10,1.8), (2,.61,.14,1.2),
                (3,.83,-.18,1.1), (3,.64,.10,1.6), (4,.78,.10,1.0), (5,.64,.10,.7)]
    visible_lamps=[(-6.2,.15,4.8),(-4.1,-.15,5.8),(-1.5,-.35,6.8),(-2.6,-.25,4.45),
                   (1.2,-.35,6.65),(2.45,-.20,4.6),(4.6,0,5.65),(6.3,.25,4.15)]
    for i, (panel, t, u, drop) in enumerate(lanterns):
        base, surface = shell_points[panel]
        canopy_hook = add(add(base, surface(u,t)), (0,-.08,0))
        x,y,bottom=visible_lamps[i]
        radius=.29 if i%3 else .32
        mount=(x,y,max(canopy_hook[2],bottom+radius+.80))
        tubing(f'Pendant_{i:02}_cord', [mount,(x,y,bottom+radius)], .009, 'gold', sides=6)
        orb(f'Pendant_{i:02}_opal_globe', (x, y, bottom), radius, 'bulb')
        orb(f'Pendant_{i:02}_cap', (x, y, bottom+radius), .047, 'gold', segments=12, rings=8)
        orb(f'Pendant_{i:02}_mount', mount, .045, 'gold', segments=12, rings=8)

    for i, (x, y, z, r) in enumerate([
        (-6.80, -1.15, .64, .22), (-5.65, -2.5, .65, .21), (-4.85, -3.1, .64, .2),
        (-3.5, -3.55, .60, .18), (3.55, -3.55, .61, .19), (4.85, -3.0, .67, .24),
        (6.4, -1.85, .68, .25), (6.85, .2, .67, .24), (-6.8, .5, .7, .26),
        (-.95, -5.35, .68, .2), (1.2, -5.25, .66, .18),
    ]):
        orb(f'Pearl_{i:02}', (x, y, z), r, 'pearl')
    vertices,faces=shell_dish(1.22,.94,.36)
    node('Mother_pearl_gold_shell_seat','mesh',position=(0,3.20,1.74),geometry=mesh(vertices,faces,'gold'))
    orb('Mother_pearl_luminous_core',(0,3.20,2.32),.55,'mother',segments=40,rings=24)
    for i in range(38):
        a = math.tau*i/38
        orb(f'Deck_pinlight_{i:02}', (7.35*math.cos(a), .25+4.3*math.sin(a), .47), .028, 'bulb', segments=8, rings=6)
    for ident, label, x, y, z, height, _ in CAST:
        node('Actor_'+ident, position=(x, y, z), extras=dict(actorId='one-piece/'+ident, label=label, billboardHeight=height))
    return nodes


def build_environment():
    """Separate, real foreground shells, floating pearls and harbour islands."""
    import random
    rng=random.Random(291029)
    root='Lagoon_environment'
    nodes=[dict(name=root,kind='empty',parent=None,position=(0,0,0))]

    def put(name, geometry, position=(0,0,0), kind='mesh', **kwargs):
        item=dict(name=name,kind=kind,parent=root,position=position,geometry=geometry,**kwargs)
        nodes.append(item)

    for side,x,y in [('left',-9.4,-10.0),('right',9.5,-9.5)]:
        rx,ry,depth=3.5,2.3,2.25
        vertices,faces=shell_dish(rx,ry,depth,segments=72)
        put('Foreground_shell_'+side,mesh(vertices,faces,'ivory'),(x,y,-.95))
        for k in range(20):
            a=math.tau*k/20
            points=[]
            for j in range(2,33):
                r=j/32
                scallop=1+.035*math.cos(a*12)*r**4
                points.append((rx*r*math.cos(a)*scallop,ry*r*math.sin(a)*scallop,
                               depth*r**1.7*(1+.12*math.sin(a))+.025*math.cos(a*12)*r**3+.025))
            vs,fs,ns=tube_mesh(points,.028)
            put(f'Foreground_{side}_rib_{k:02}',mesh(vs,fs,'gold',vertex_normals=ns),(x,y,-.95),kind='curve',
                curve=dict(points=points,radius=.028,cyclic=False,sides=8))
    for i in range(24):
        a=math.tau*i/24
        rx=8.4+1.7*rng.random()
        ry=5.7+1.8*rng.random()
        radius=.12+.18*rng.random()
        vs,fs,ns=sphere(radius,16,10)
        put(f'Lagoon_floating_pearl_{i:02}',mesh(vs,fs,'pearl',vertex_normals=ns),
            (rx*math.cos(a),.5+ry*math.sin(a),radius*.30))

    specs=[(-63,91,55,15,8.7,'island_near'),(69,113,57,17,10.5,'island_mid'),(0,170,155,24,10.5,'island_far')]
    for index,(cx,cy,width,depth,height,mat) in enumerate(specs):
        nx,ny=112,24
        vertices=[]
        def elevation(x,y):
            t=x/width
            peaks=(.42*math.exp(-((t+.66)/.25)**2)+.82*math.exp(-((t+.26)/.28)**2)
                   +.55*math.exp(-((t-.16)/.24)**2)+.74*math.exp(-((t-.54)/.29)**2))
            ridge=1+.025*math.sin(x*.08+index)+.015*math.sin(x*.15-y*.07)
            shore=max(0,1-(y/depth)**2)**1.15
            edge=max(0,1-t*t)**.55
            return -.7+height*peaks*shore*edge*ridge
        for j in range(ny+1):
            y=-depth+2*depth*j/ny
            for i in range(nx+1):
                x=-width+2*width*i/nx
                vertices.append((x,y,elevation(x,y)))
        faces=[]
        for j in range(ny):
            for i in range(nx):
                a=j*(nx+1)+i
                faces.extend([(a,a+1,a+nx+2),(a,a+nx+2,a+nx+1)])
        put(f'Harbour_island_{index}',mesh(vertices,faces,mat),(cx,cy,0))
        for light in range(55 if index<2 else 30):
            # Five loose settlements follow the curving shore, with dark gaps.
            cluster=light%5
            center=(-.68,-.36,-.04,.31,.62)[cluster]+.035*math.sin(index+cluster)
            x=max(-width*.88,min(width*.88,rng.gauss(width*center,width*.035)))
            y=-depth*(.82+.065*math.sin(x/width*math.pi*2+index))+rng.gauss(0,depth*.045)
            z=max(.16,elevation(x,y)+.16)
            radius=rng.uniform(.045,.13)
            vs,fs,ns=sphere(radius,8,6)
            put(f'Harbour_{index}_window_{light:02}',mesh(vs,fs,rng.choice(['harbour_2200','harbour_2500','harbour_2800']),vertex_normals=ns),(cx+x,cy+y,z))
    return nodes
