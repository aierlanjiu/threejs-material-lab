from pathlib import Path
exec((Path('/Users/papazed/dev/threejs-material-lab/scripts/blender/phase_helpers.py')).read_text())
ahead=next(o for o in astro.children if o.name.startswith('Head'))
EYE=bpy.data.materials['Eyes · obsidian'];OPTIC=bpy.data.materials['Eyes · clear outer lens'];GLINT=bpy.data.materials['Catchlight · softbox'];REFLECT=bpy.data.materials['Eyes · lower reflected arc']
for h,is_astro in [(ahead,True)]:
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
