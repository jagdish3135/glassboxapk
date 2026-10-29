# Builds the GlassBoxAPK hero model: a rounded glass box with an Android-style package inside.
# Run headless:  blender -b -P scripts/blender/glass_box.py -- <out.glb> <poster.webp> <hdri.hdr>
# The web page replaces the materials (MeshTransmissionMaterial for the shell); the Blender
# materials only matter for the poster render. Object names are what the page looks up.
import math
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_GLB = argv[0] if len(argv) > 0 else "glass_box.glb"
OUT_POSTER = argv[1] if len(argv) > 1 else ""
HDRI = argv[2] if len(argv) > 2 else ""

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, rough=0.4, metal=0.0, transmission=0.0, emission=None, strength=0.0, ior=1.32):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1.0)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if transmission:
        p.inputs["Transmission Weight"].default_value = transmission
        p.inputs["IOR"].default_value = ior
    if emission:
        p.inputs["Emission Color"].default_value = (*emission, 1.0)
        p.inputs["Emission Strength"].default_value = strength
    return m


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


GLASS = material("Glass", srgb("#cfe9ec"), rough=0.04, transmission=1.0)
# Android green (#3DDC84), a soft satin plastic.
ANDROID = material("Android", srgb("#3ddc84"), rough=0.32)
EYES = material("Eyes", srgb("#ffffff"), rough=0.2, emission=srgb("#ffffff"), strength=2.0)


def finish(obj, mat, bevel=0.0, segments=4):
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "NONE"
        mod.harden_normals = False
    return obj


def cube(name, size, loc, mat, bevel=0.0, segments=4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, mat, bevel, segments)


# The glass shell: a hollow 2 m rounded cube with thin walls, like a display case. (A solid block
# mirrors its own top face back through the front and hides the package.)
shell = cube("Shell", (2.0, 2.0, 2.0), (0, 0, 0), GLASS, bevel=0.3, segments=6)
walls = shell.modifiers.new("Walls", "SOLIDIFY")
walls.thickness = 0.07
walls.offset = -1.0

# The Android robot inside the case, in the proportions of Google's classic robot: a half-dome
# head with antennae and eyes, a body with rounded bottom corners, two arms and two legs.
# The page turns the head toward the cursor (it pivots at the base of the dome) and sways the arms.
R = 0.5  # body radius; everything else is sized from it


def capsule(name, radius, length, loc):
    """A cylinder with fully rounded ends (arms, legs, antennae): a cylinder and two spheres, joined."""
    x, y, z = loc
    half = max(length / 2 - radius, 0.001)
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=half * 2, vertices=20, location=loc)
    parts = [bpy.context.active_object]
    for dz in (-half, half):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=20, ring_count=10, location=(x, y, z + dz))
        parts.append(bpy.context.active_object)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    # The pivot sits at the top end, so the page can swing arms from the shoulder.
    bpy.context.scene.cursor.location = (x, y, z + half)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return finish(o, ANDROID)


BODY_TOP, BODY_H = 0.17, 0.56
bpy.ops.mesh.primitive_cylinder_add(radius=R, depth=BODY_H, vertices=40, location=(0, 0, BODY_TOP - BODY_H / 2))
body = bpy.context.active_object
body.name = "Body"
finish(body, ANDROID, bevel=0.1, segments=4)

HEAD_BASE = BODY_TOP + 0.045
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=40, ring_count=20, location=(0, 0, HEAD_BASE))
head = bpy.context.active_object
head.name = "Head"
head.scale = (R, R, R * 0.92)
bpy.ops.object.transform_apply(scale=True)
bm = bmesh.new()
bm.from_mesh(head.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.001], context="VERTS")
bm.to_mesh(head.data)
bm.free()
cap = head.modifiers.new("Solid", "SOLIDIFY")
cap.thickness = 0.04
finish(head, ANDROID)

dome_top = HEAD_BASE + R * 0.92
for side, name in ((-1, "AntennaL"), (1, "AntennaR")):
    capsule(name, 0.026, 0.22, (side * 0.2, 0, dome_top - 0.02))
    bpy.context.active_object.rotation_euler = (0, side * math.radians(30), 0)

eye_up = 0.2
ring = R * math.sqrt(1 - (eye_up / (R * 0.92)) ** 2)
for side, name in ((-1, "EyeL"), (1, "EyeR")):
    x = side * 0.19
    y = -math.sqrt(max(ring ** 2 - x ** 2, 0)) + 0.01
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.052, segments=16, ring_count=8, location=(x, y, HEAD_BASE + eye_up))
    e = bpy.context.active_object
    e.name = name
    e.scale = (1.0, 0.55, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    finish(e, EYES)

ARM_R, ARM_LEN = 0.11, 0.46
for side, name in ((-1, "ArmL"), (1, "ArmR")):
    capsule(name, ARM_R, ARM_LEN, (side * (R + 0.05 + ARM_R), 0, BODY_TOP - ARM_LEN / 2 + 0.02))

LEG_R, LEG_LEN = 0.11, 0.34
for side, name in ((-1, "LegL"), (1, "LegR")):
    capsule(name, LEG_R, LEG_LEN, (side * 0.2, 0, BODY_TOP - BODY_H - LEG_LEN / 2 + 0.08))

# Centre the robot vertically in the case.
bpy.context.view_layer.update()
meshes = [o for o in scene.objects if o.type == "MESH"]
robot = [o for o in meshes if o.name != "Shell"]
lo = min((o.matrix_world @ v.co).z for o in robot for v in o.data.vertices)
hi = max((o.matrix_world @ v.co).z for o in robot for v in o.data.vertices)
for o in robot:
    o.location.z -= (lo + hi) / 2 + 0.02

# ---- Export the GLB (modifiers applied, +Y up for three.js).
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", use_selection=True,
                          export_apply=True, export_yup=True, export_materials="EXPORT")
print("exported", OUT_GLB)

if not OUT_POSTER:
    sys.exit(0)

# ---- Poster render (reduced motion / no WebGL): dark studio, glass box at a 3/4 angle.
pivot = bpy.data.objects.new("Pivot", None)
scene.collection.objects.link(pivot)
for o in meshes:
    o.parent = pivot
# With caustics off, glass would block direct light to the robot inside: let light pass through it.
bpy.data.objects["Shell"].visible_shadow = False

# A 3/4 view from slightly above: the front, one side and the top face all read.
pivot.rotation_euler = (math.radians(14), math.radians(6), math.radians(-30))

world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
out = nt.nodes.new("ShaderNodeOutputWorld")
mix = nt.nodes.new("ShaderNodeMixShader")
path = nt.nodes.new("ShaderNodeLightPath")
bg_light = nt.nodes.new("ShaderNodeBackground")
bg_cam = nt.nodes.new("ShaderNodeBackground")
bg_cam.inputs["Color"].default_value = (*srgb("#0c1012"), 1.0)
if HDRI:
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(HDRI)
    nt.links.new(env.outputs["Color"], bg_light.inputs["Color"])
bg_light.inputs["Strength"].default_value = 0.55
nt.links.new(path.outputs["Is Camera Ray"], mix.inputs["Fac"])
nt.links.new(bg_light.outputs["Background"], mix.inputs[1])
nt.links.new(bg_cam.outputs["Background"], mix.inputs[2])
nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])

# A soft cyan glow behind the box (the same idea as the website), so the glass has light to bend.
bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 4.5, 0.2), rotation=(math.radians(90), 0, 0))
backdrop = bpy.context.active_object
backdrop.scale = (16, 16, 1)  # object coords span ±16 m, so the glow below is ~4 m wide
glow = bpy.data.materials.new("Backdrop")
glow.use_nodes = True
gn = glow.node_tree
gn.nodes.clear()
g_out = gn.nodes.new("ShaderNodeOutputMaterial")
g_em = gn.nodes.new("ShaderNodeEmission")
g_tc = gn.nodes.new("ShaderNodeTexCoord")
g_grad = gn.nodes.new("ShaderNodeTexGradient")
g_grad.gradient_type = "SPHERICAL"
g_ramp = gn.nodes.new("ShaderNodeValToRGB")
g_ramp.color_ramp.elements[0].position = 0.74
g_ramp.color_ramp.elements[0].color = (*srgb("#0c1012"), 1.0)
g_ramp.color_ramp.elements[1].position = 1.0
g_ramp.color_ramp.elements[1].color = (*srgb("#2a6670"), 1.0)
g_ramp.color_ramp.interpolation = "EASE"
gn.links.new(g_tc.outputs["Object"], g_grad.inputs["Vector"])
gn.links.new(g_grad.outputs["Fac"], g_ramp.inputs["Fac"])
gn.links.new(g_ramp.outputs["Color"], g_em.inputs["Color"])
g_em.inputs["Strength"].default_value = 1.0
gn.links.new(g_em.outputs["Emission"], g_out.inputs["Surface"])
backdrop.data.materials.append(glow)


def area(loc, energy, color, size, target=(0, 0, 0)):
    bpy.ops.object.light_add(type="AREA", location=loc)
    lamp = bpy.context.active_object
    lamp.data.energy = energy
    lamp.data.color = srgb(color)
    lamp.data.size = size
    aim = lamp.constraints.new("TRACK_TO")
    tgt = bpy.data.objects.new(f"aim_{len(scene.objects)}", None)
    tgt.location = target
    scene.collection.objects.link(tgt)
    aim.target = tgt
    return lamp


area((-3.5, -2.5, 7.5), 750, "#f4fbfc", 3.5)        # key: big soft box, above-left (its glint lands on the top face)
area((4.5, 2.5, 2.5), 520, "#ff7a40", 2.0)          # rim: orange, behind-right
area((4.5, -4.0, 0.0), 140, "#cfe9ec", 3.0)         # fill: low, front-right
area((-1.8, -6.5, 0.6), 420, "#f4fbfc", 4.0)        # front: lights the robot through the glass

# Camera offset to the left, so the box sits in the right third and the headline has room.
bpy.ops.object.camera_add(location=(-1.9, -10.5, 2.6), rotation=(math.radians(77), 0, 0))
cam = bpy.context.active_object
cam.data.lens = 50
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.samples = 160
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 16
scene.cycles.transmission_bounces = 16
scene.cycles.glossy_bounces = 8
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.quality = 82
scene.render.filepath = OUT_POSTER
bpy.ops.render.render(write_still=True)
print("rendered", OUT_POSTER)
