from pathlib import Path
exec((Path('/Users/papazed/dev/threejs-material-lab/scripts/blender/phase_helpers.py')).read_text())
import random
ahead=next(o for o in astro.children if o.name.startswith('Head'));cells=json.loads((ROOT/'assets/mascots/blender/rind-cells.json').read_text())
RIND=bpy.data.materials['Rind · fresh crimson'];rp=RIND.node_tree.nodes.get('Principled BSDF')
rp.inputs['Roughness'].default_value=.43;rp.inputs['Coat Weight'].default_value=.16;rp.inputs['Coat Roughness'].default_value=.26;rp.inputs['Subsurface Weight'].default_value=.04
noise=RIND.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=180;noise.inputs['Detail'].default_value=2.0
bump=RIND.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.19;bump.inputs['Distance'].default_value=.004
RIND.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);RIND.node_tree.links.new(bump.outputs['Normal'],rp.inputs['Normal'])

targets=[('Hood · sculpted cocoon',580,(Vector((0,-cos(.35),-sin(.35))),.66)),('Helmet · sculpted rind',580,(Vector((0,-1,0)),.90)),('Jacket · continuous rind',580,None)]
targets += [(o.name,72,None) for o in hood.children_recursive if o.name.startswith('Sleeve rind')]
for name,count,opening in targets:
    ob=scene.objects[name];old=ob.data;verts=[];faces=[];cols=[];offset=0;rng=random.Random(54)
    valley=rgb('881337');peak=rgb('E11D48')
    for seed,reg in zip(cells[str(count)]['centers'],cells[str(count)]['regions']):
        if opening and Vector(seed).dot(opening[0])>cos(opening[1]):continue
        k=len(reg);outer=[old.vertices[offset+i].co.copy() for i in range(k)];top=old.vertices[offset+3*k].co.copy();center=sum(outer,Vector())/k
        normal=(top-center).normalized();height=(top-center).length;tint=rng.uniform(.90,1.07);start=len(verts)
        # Broad, nearly level crown; the steepest slope is confined to the cell shoulder.
        for fraction,lift,mix in [(1,0,.18),(.82,.43,.65),(.52,.69,.95),(.24,.72,1.0)]:
            for corner in outer:
                p=center+(corner-center)*fraction+normal*height*lift
                verts.append(tuple(p));cols.append(tuple((valley[j]*(1-mix)+peak[j]*mix)*tint for j in range(3))+(1,))
        verts.append(tuple(center+normal*height*.73));cols.append(tuple(x*tint for x in peak)+(1,))
        for r in range(3):
            for i in range(k):j=(i+1)%k;faces.append((start+r*k+i,start+r*k+j,start+(r+1)*k+j,start+(r+1)*k+i))
        for i in range(k):faces.append((start+3*k+i,start+3*k+(i+1)%k,start+4*k))
        offset+=3*k+1
    new=mesh(name+' · rounded Voronoi',verts,faces,RIND,ob.parent,cols);new.matrix_basis=ob.matrix_basis.copy();new['li_part']=name;new['rounded_rind']=True
    # Weld shared valley edges, then round the shoulder without changing the approved silhouette.
    bm=bmesh.new();bm.from_mesh(new.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.0001);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(new.data);bm.free()
    bpy.context.view_layer.objects.active=new;new.select_set(True)
    sub=new.modifiers.new('Rounded cellular shoulders','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name);new.select_set(False)
    if name.startswith('Hood'):
        for v in new.data.vertices:
            if v.co.y>0:v.co.y*=.92
    if name.startswith('Jacket'):
        for v in new.data.vertices:v.co.y*=1.10
    retire(ob)
    for line in list(ob.parent.children):
        if line.name.startswith(name+' · star veins'):retire(line)

# Cream flesh with a warm scattering radius and baked radial peach blush.
JADE.node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value=.23
JADE.node_tree.nodes['Principled BSDF'].inputs['Subsurface Radius'].default_value=(1,.52,.36)
JADE.node_tree.nodes['Principled BSDF'].inputs['Subsurface Scale'].default_value=.075
face_mat=bpy.data.materials['Face · flesh and blush'];fp=face_mat.node_tree.nodes['Principled BSDF']
fp.inputs['Subsurface Weight'].default_value=.24;fp.inputs['Subsurface Radius'].default_value=(1,.52,.36);fp.inputs['Subsurface Scale'].default_value=.08
fp.inputs['Roughness'].default_value=.255;fp.inputs['Coat Weight'].default_value=.27;fp.inputs['Coat Roughness'].default_value=.18
cream=rgb('FFF1DF');pink=rgb('F58F9B')
for name,is_astro in [('Fruit core · sealed cheeks',False),('Astronaut fruit face',True)]:
    face=scene.objects[name];col=face.data.color_attributes.get('Col')
    if not col:col=face.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
    for v,c in zip(face.data.vertices,col.data):
        x,y,z=v.co;cz=-.34 if is_astro else -.435;cx=.44 if is_astro else .45
        w=min(.78,sum(math.exp(-((x-s*cx)/.17)**2-((z-cz)/.09)**2) for s in [-1,1])*.78)
        c.color=tuple(cream[j]*(1-w)+pink[j]*w for j in range(3))+(1,)
    face['blush']='baked radial peach gradient';face['sss_tint']='#FFE4D6'

EYE=bpy.data.materials['Eyes · obsidian'];ep=EYE.node_tree.nodes['Principled BSDF'];ep.inputs['Base Color'].default_value=(*rgb('090909'),1);ep.inputs['Roughness'].default_value=.12;ep.inputs['Coat Weight'].default_value=1.0
OPTIC=material('Eyes · clear outer lens','FFFFFF',.02,coat=1.0);op=OPTIC.node_tree.nodes['Principled BSDF'];op.inputs['Transmission Weight'].default_value=1;op.inputs['IOR'].default_value=1.36;op.inputs['Coat Roughness'].default_value=.02
GLINT=bpy.data.materials['Catchlight · softbox'];REFLECT=material('Eyes · lower reflected arc','999FB0',.12)
for h,is_astro in [(head,False),(ahead,True)]:
    face=scene.objects['Astronaut fruit face' if is_astro else 'Fruit core · sealed cheeks']
    face.hide_viewport=False;face.hide_set(False);bpy.context.view_layer.update()
    for eye in [o for o in h.children if o.name.startswith('Eye.')]:
        for child in list(eye.children):retire(child)
        if not is_astro:eye.scale.x*=1.12;eye.scale.z*=1.12;eye.location.x*=.95
        eye.scale.y=.66
        hit,point,normal,index=face.ray_cast(Vector((eye.location.x,-2,eye.location.z)),Vector((0,1,0)))
        if hit:eye.location.y=point.y+.023
        sphere('Obsidian inner pupil',(0,0,0),(.151,.056,.174),EYE,eye)
        lens=sphere('Optical outer lens',(0,-.002,0),(.157,.067,.180),OPTIC,eye);lens['li_optical_shell']=True
        sphere('Upper softbox reflection',(-.045,-.064,.085),(.026,.007,.030),GLINT,eye)
        pts=[(.106*cos(a),-.054,-.006+.139*sin(a)) for a in [pi*1.22+i*pi*.46/20 for i in range(21)]]
        curve('Lower reflected crescent',pts,.004,REFLECT,eye)
        eye['eye_scale_change']=1.12 if not is_astro else 1;eye['eye_spacing_change']=.95 if not is_astro else 1

# Engrave the smile into the sealed fruit core; coral pigment occupies only the groove floor.
face=scene.objects['Fruit core · sealed cheeks'];mouth=scene.objects['Mouth']
for child in list(mouth.children):retire(child)
pts=[]
for i in range(49):
    x=-.115+.230*i/48;z=-.460+.040*(x/.115)**2
    hit,point,normal,index=face.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    pts.append((x,point.y-.001 if hit else -1.00,z))
tool=curve('Smile engraving cutter',pts,.009,bpy.data.materials['Mouth · cherry'],head)
bpy.ops.object.select_all(action='DESELECT');tool.select_set(True);bpy.context.view_layer.objects.active=tool;bpy.ops.object.convert(target='MESH')
face.hide_viewport=False;bpy.context.view_layer.objects.active=face
boolean=face.modifiers.new('Incised smile 9 mm','BOOLEAN');boolean.operation='DIFFERENCE';boolean.solver='EXACT';boolean.object=tool;bpy.ops.object.modifier_apply(modifier=boolean.name)
retire(tool);bpy.context.view_layer.update()
pigment=[]
for x,y,z in pts:
    pigment.append(tuple(mouth.matrix_local.inverted()@Vector((x,y+.0068,z))))
smile=curve('Incised coral smile',pigment,.0035,bpy.data.materials['Tongue · coral'],mouth);smile['recessed']=True

# Fuller, raised toes and rounded ankle pith.
for root in [hood,astro]:
    for leg in [o for o in root.children if o.name.startswith('Leg.')]:
        shoe=next(o for o in leg.children if o.name.startswith('Rounded boot toe' if root==hood else 'Moon boot toe'))
        for v in shoe.data.vertices:
            x,y,z=v.co
            front=max(0,min(1,(-y-.10)/.39));vertical=max(0,1-((z-.245)/.17)**2)
            v.co.z+=.105*front*vertical;v.co.y-=.017*front*max(0,1-((z-.23)/.2)**2)
        if root==hood:
            cuff=next(o for o in leg.children if o.name.startswith('Cream ankle'))
            bpy.context.view_layer.objects.active=cuff;mod=cuff.modifiers.new('Soft ankle roll','BEVEL');mod.width=.035;mod.segments=4;bpy.ops.object.modifier_apply(modifier=mod.name)
            for p in cuff.data.polygons:p.use_smooth=True

# Readable optical glass and a soft frontal bounce preserve cheek color below the hood.
gp=GLASS.node_tree.nodes['Principled BSDF'];gp.inputs['IOR'].default_value=1.10;gp.inputs['Roughness'].default_value=.012;gp.inputs['Coat Weight'].default_value=0;gp.inputs['Specular IOR Level'].default_value=.26
d=bpy.data.lights.new('Bounce · face card','AREA');d.energy=95;d.shape='DISK';d.size=3.5
ob=bpy.data.objects.new('Bounce · face card',d);scene.collection.objects.link(ob);ob.location=(0,-4,1.4);ob.rotation_euler=(Vector((0,0,2))-ob.location).to_track_quat('-Z','Y').to_euler()
scene.view_settings.view_transform='AgX';scene.view_settings.look='None';scene.view_settings.exposure=.40
scene['review_phase']='phase3';(ROOT/'output/blender-mcp/phase3').mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mascots/blender/li-mascots-phase3.blend'))
print('PHASE3_SURFACES_COMPLETE')
