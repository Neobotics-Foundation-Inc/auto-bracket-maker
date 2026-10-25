"""
Neobotics grandstand world: a grandstand beside a race track, in the style of the Neobotics
garage render (near-black navy field, cool-white LED panels, Neobotics-red LED strips, glossy
dark floor, light grey structure, red-rimmed tyres). The same scene renders at night (the dark
theme's background) or by day (the light theme's).

Run: blender -b --factory-startup --python art/grandstand.py -- <out_dir> <mode> [exposure] [light] [time]
The published renders used: final -1.6 0.05 night, and final -0.6 0 day
mode: preview (small, fast) | final (desktop 1920x1080 and mobile 608x1080)
time: night | day (outputs gain a -day suffix)
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.getcwd()
MODE = argv[1] if len(argv) > 1 else "preview"
EXPOSURE = float(argv[2]) if len(argv) > 2 else -0.6
LIGHT = float(argv[3]) if len(argv) > 3 else 1.0
DAY = (argv[4] if len(argv) > 4 else "night") == "day"
# By day the sun does the lighting: LEDs glow faintly, floodlights are off, the track is dry.
DAY_LED = 0.25

NB_RED = (1.0, 0.0, 0.025)  # #ff0033 in linear
COOL_WHITE = (0.82, 0.9, 1.0)

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.08
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def box(name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    return obj


def array(obj, count, offset):
    mod = obj.modifiers.new("Array", "ARRAY")
    mod.count = count
    mod.use_relative_offset = False
    mod.use_constant_offset = True
    mod.constant_offset_displace = offset
    return obj


# ---------------------------------------------------------------- materials
asphalt = material("Asphalt", (0.018, 0.02, 0.026), rough=0.38 if DAY else 0.22, coat=0.2 if DAY else 0.6)
# Fine noise so the wet track breaks reflections up a little, like the garage's floor.
nodes = asphalt.node_tree.nodes
links = asphalt.node_tree.links
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 180.0
bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.06
links.new(noise.outputs["Fac"], bump.inputs["Height"])
links.new(bump.outputs["Normal"], nodes["Principled BSDF"].inputs["Normal"])

concrete = material("Concrete", (0.05, 0.055, 0.065), rough=0.7)
structure = material("Structure", (0.55, 0.56, 0.58), rough=0.45, metal=0.3)  # garage's light grey poles
seat_mat = material("Seat", (0.025, 0.027, 0.034), rough=0.4)
seat_red = material("SeatRed", (0.25, 0.0, 0.01), rough=0.4)
roof_mat = material("Roof", (0.03, 0.032, 0.04), rough=0.6)
paint_white = material("LineWhite", (0.75, 0.76, 0.78), rough=0.5)
kerb_red = material("KerbRed", (0.45, 0.0, 0.012), rough=0.5)
tyre = material("Tyre", (0.012, 0.012, 0.014), rough=0.85)
rim_red = material("RimRed", (0.7, 0.02, 0.02), rough=0.35, metal=0.4, emit=NB_RED, strength=0.15)
led_white = material("LEDWhite", (1, 1, 1), emit=COOL_WHITE, strength=14.0 * (DAY_LED if DAY else 1))
led_panel = material("LEDPanel", (1, 1, 1), emit=COOL_WHITE, strength=6.0 * (DAY_LED if DAY else 1))
led_red = material("LEDRed", NB_RED, emit=NB_RED, strength=7.0 * (DAY_LED if DAY else 1))
flood_head = material("FloodHead", (0.8, 0.82, 0.85), emit=COOL_WHITE, strength=0.0 if DAY else 40.0)

# ---------------------------------------------------------------- track
TRACK_W = 13.0
# The straight runs from behind the camera to a left turn at TURN_Y (see "the turn" below).
TURN_Y = 138.0
LENGTH = TURN_Y + 10
box("Ground", (220, 260, 0.1), (0, 70, -0.05), asphalt)
# White track-limit lines at both edges (F1 circuits have no centre line).
for x in (-TRACK_W / 2, TRACK_W / 2):
    box(f"Edge{x}", (0.18, LENGTH, 0.012), (x, LENGTH / 2 - 10, 0.006), paint_white)
# The start line, under the gantry.
START_Y = 18
box("StartLine", (TRACK_W, 0.6, 0.013), (0, START_Y, 0.0065), paint_white)
# F1 grid slots behind it, staggered left and right: a line across the front of each slot with
# short legs running back along its sides.
SLOT_W = 2.8
for slot in range(8):
    sx = (-3.0 if slot % 2 == 0 else 3.0)
    sy = START_Y - 2.0 - slot * 3.2
    box(f"Slot{slot}", (SLOT_W, 0.16, 0.012), (sx, sy, 0.006), paint_white)
    for leg in (-1, 1):
        box(f"Slot{slot}Leg{leg}", (0.16, 1.1, 0.012), (sx + leg * (SLOT_W / 2 - 0.08), sy - 0.55, 0.006), paint_white)

# ---------------------------------------------------------------- walls along both edges
# The stand wall on the right and the pit wall on the left, each with a catch fence above it.
WALL_X = TRACK_W / 2 + 1.6
PIT_WALL_X = -WALL_X
for name, x in (("StandWall", WALL_X), ("PitWall", PIT_WALL_X)):
    box(name, (0.6, LENGTH, 1.1), (x, LENGTH / 2 - 10, 0.55), concrete)
    box(name + "LED", (0.62, LENGTH, 0.035), (x, LENGTH / 2 - 10, 1.12), led_red)
    post = box(name + "FencePost", (0.08, 0.08, 3.2), (x, -8, 2.7), structure)
    array(post, int((TURN_Y + 8) / 4) + 1, (0, 4.0, 0))
    box(name + "FenceRail", (0.06, LENGTH, 0.06), (x, LENGTH / 2 - 10, 4.25), structure)

# ---------------------------------------------------------------- the turn at the end of the straight
# A 90° left-hander, as at the end of an F1 pit straight. The lines, walls, LED strips and catch
# fences follow the curve round onto a short exit straight; red and white kerbs mark the apex and
# the exit, and a red and white barrier lines the outside of the corner so the turn reads from the grid.
TURN_R = 28.0  # of the track's centre line
EXIT_LEN = 70.0
turn_c = Vector((-TURN_R, TURN_Y, 0))


def arc_band(name, r_in, r_out, z0, z1, mat, a0=0.0, a1=math.pi / 2, steps=48):
    """A solid band between two radii round the turn's centre, from angle a0 to a1: 0 is the end
    of the straight, π/2 the start of the exit straight."""
    bm = bmesh.new()
    rings = []
    for s in range(steps + 1):
        a = a0 + (a1 - a0) * s / steps
        out = Vector((math.cos(a), math.sin(a), 0))
        rings.append([bm.verts.new(turn_c + out * r + Vector((0, 0, z)))
                      for r, z in ((r_in, z0), (r_out, z0), (r_out, z1), (r_in, z1))])
    for s in range(steps):
        for k in range(4):
            bm.faces.new((rings[s][k], rings[s][(k + 1) % 4], rings[s + 1][(k + 1) % 4], rings[s + 1][k]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def exit_box(name, r, width, z0, z1, mat, length=EXIT_LEN):
    """A box along the exit straight at radius r's line (y = TURN_Y + r), running off to the left."""
    return box(name, (length, width, z1 - z0), (-TURN_R - length / 2, TURN_Y + r, (z0 + z1) / 2), mat)


# Edge lines, walls with their LED strips, and catch fences, round the corner and along the exit.
for side, sign in (("In", -1), ("Out", 1)):
    edge = TURN_R + sign * TRACK_W / 2
    arc_band(f"TurnEdge{side}", edge - 0.09, edge + 0.09, 0, 0.012, paint_white)
    exit_box(f"ExitEdge{side}", edge, 0.18, 0, 0.012, paint_white)
    wall = TURN_R + sign * WALL_X
    arc_band(f"TurnWall{side}", wall - 0.3, wall + 0.3, 0, 1.1, concrete)
    arc_band(f"TurnWallLED{side}", wall - 0.31, wall + 0.31, 1.1, 1.14, led_red)
    arc_band(f"TurnFenceRail{side}", wall - 0.03, wall + 0.03, 4.22, 4.28, structure)
    exit_box(f"ExitWall{side}", wall, 0.6, 0, 1.1, concrete)
    exit_box(f"ExitWallLED{side}", wall, 0.62, 1.1, 1.14, led_red)
    exit_box(f"ExitFenceRail{side}", wall, 0.06, 4.22, 4.28, structure)
    posts = max(2, round(wall * math.pi / 2 / 4.0))
    for k in range(1, posts + 1):
        a = math.pi / 2 * k / posts
        p = turn_c + Vector((math.cos(a), math.sin(a), 0)) * wall
        box(f"TurnFencePost{side}{k}", (0.08, 0.08, 3.2), (p.x, p.y, 2.7), structure)
    post = box(f"ExitFencePost{side}", (0.08, 0.08, 3.2), (-TURN_R - 4.0, TURN_Y + wall, 2.7), structure)
    array(post, int(EXIT_LEN / 4), (-4.0, 0, 0))


def striped_arc(name, r_in, r_out, height, a0, a1, block, first=kerb_red, second=paint_white, z0=0.0):
    """Alternating blocks of two materials between two radii, each about `block` long."""
    count = max(2, round((r_in + r_out) / 2 * (a1 - a0) / block))
    step = (a1 - a0) / count
    for k in range(count):
        arc_band(f"{name}{k}", r_in, r_out, z0, z0 + height, first if k % 2 == 0 else second,
                 a0 + k * step, a0 + (k + 1) * step, steps=4)


# Kerbs on the apex (inside) and the exit (outside), and the barrier along the outside wall.
inner_edge, outer_edge = TURN_R - TRACK_W / 2, TURN_R + TRACK_W / 2
striped_arc("ApexKerb", inner_edge - 1.0, inner_edge, 0.06, math.pi * 0.12, math.pi * 0.38, 1.4)
striped_arc("ExitKerb", outer_edge, outer_edge + 0.8, 0.06, math.pi * 0.3, math.pi / 2, 1.4)
striped_arc("CornerBarrier", TURN_R + WALL_X - 0.75, TURN_R + WALL_X - 0.3, 1.0, 0.0, math.pi / 2, 2.0)

# ---------------------------------------------------------------- grandstand
STAND_X = WALL_X + 3.0
TIERS = 16
TREAD = 0.95
RISE = 0.5
STAND_Y0, STAND_Y1 = -6.0, TURN_Y  # on to the turn, where it carries on round the corner
stand_len = STAND_Y1 - STAND_Y0
for t in range(TIERS):
    x = STAND_X + t * TREAD + TREAD / 2
    h = 0.6 + t * RISE
    box(f"Tier{t}", (TREAD, stand_len, h), (x, (STAND_Y0 + STAND_Y1) / 2, h / 2), concrete)
    # A row of seats on each tier: one seat arrayed along the stand, with aisle gaps per block.
    for block in range(6):
        y0 = STAND_Y0 + 1.0 + block * (stand_len / 6)
        seat = box(f"Seat{t}_{block}", (0.5, 0.46, 0.42), (x - 0.12, y0, h + 0.21), seat_red if t in (6, 7) else seat_mat)
        array(seat, int((stand_len / 6 - 2.0) / 0.55), (0, 0.55, 0))
# Back wall.
back_x = STAND_X + TIERS * TREAD + 0.3
box("BackWall", (0.6, stand_len, 13.5), (back_x, (STAND_Y0 + STAND_Y1) / 2, 6.75), concrete)

# Roof: cantilevered slab tilting up towards the track, on light grey columns.
ROOF_H = 14.5
roof_depth = TIERS * TREAD + 4.5
roof_cx = STAND_X + roof_depth / 2 - 3.0
roof = box("Roof", (roof_depth, stand_len + 2, 0.5), (roof_cx, (STAND_Y0 + STAND_Y1) / 2, ROOF_H), roof_mat,
           rot=(0, math.radians(-4), 0))
col = box("Column", (0.45, 0.45, ROOF_H), (back_x - 0.6, STAND_Y0 + 2, ROOF_H / 2), structure)
array(col, 9, (0, stand_len / 8.2, 0))
# Front fascia beam with white and red LED lines, like the garage's beam.
front_x = roof_cx - roof_depth / 2 * math.cos(math.radians(4))
front_z = ROOF_H - roof_depth / 2 * math.sin(math.radians(4))
box("Fascia", (0.6, stand_len + 2, 1.4), (front_x, (STAND_Y0 + STAND_Y1) / 2, front_z - 0.3), roof_mat)
box("FasciaRed", (0.64, stand_len + 2, 0.07), (front_x, (STAND_Y0 + STAND_Y1) / 2, front_z - 0.75), led_red)
box("FasciaWhite", (0.64, stand_len + 2, 0.07), (front_x, (STAND_Y0 + STAND_Y1) / 2, front_z + 0.2), led_white)
# Grid of white LED panels under the roof, like the garage ceiling.
for row in range(4):
    px = front_x + 2.5 + row * (roof_depth - 5) / 3
    pz = ROOF_H - 0.3 - (roof_cx - px) * math.tan(math.radians(4)) * -1
    panel = box(f"Panel{row}", (1.6, 3.2, 0.05), (px, STAND_Y0 + 3, pz - 0.05), led_panel)
    array(panel, 22, (0, stand_len / 22.5, 0))
# Soft light from the panels onto the stands.
bpy.ops.object.light_add(type="AREA", location=(roof_cx, (STAND_Y0 + STAND_Y1) / 2, ROOF_H - 1.0))
area = bpy.context.active_object
area.data.shape = "RECTANGLE"
area.data.size = roof_depth - 3
area.data.size_y = stand_len
area.data.energy = 0 if DAY else 60000 * LIGHT
area.data.color = COOL_WHITE

# The stand carries on round the outside of the turn: the same tiers, seats, back wall, roof, LED
# panels and fascia lines, curved. From the grid this is what shows the corner, its roof line and
# LED strips sweeping away to the left. Radius TURN_R + x matches x on the straight.
for t in range(TIERS):
    r = TURN_R + STAND_X + t * TREAD
    h = 0.6 + t * RISE
    arc_band(f"TurnTier{t}", r, r + TREAD, 0, h, concrete)
    arc_band(f"TurnSeats{t}", r + 0.11, r + 0.61, h, h + 0.42, seat_red if t in (6, 7) else seat_mat)
arc_band("TurnBackWall", TURN_R + back_x - 0.3, TURN_R + back_x + 0.3, 0, 13.5, concrete)
arc_band("TurnRoof", TURN_R + front_x, TURN_R + front_x + roof_depth, ROOF_H - 0.45, ROOF_H + 0.05, roof_mat)
arc_band("TurnFascia", TURN_R + front_x - 0.3, TURN_R + front_x + 0.3, front_z - 1.0, front_z + 0.4, roof_mat)
arc_band("TurnFasciaRed", TURN_R + front_x - 0.32, TURN_R + front_x - 0.28, front_z - 0.785, front_z - 0.715, led_red)
arc_band("TurnFasciaWhite", TURN_R + front_x - 0.32, TURN_R + front_x - 0.28, front_z + 0.165, front_z + 0.235, led_white)
for row in range(4):
    r = TURN_R + front_x + 2.5 + row * (roof_depth - 5) / 3
    striped_arc(f"TurnPanels{row}", r - 0.8, r + 0.8, 0.05, 0, math.pi / 2, 3.2, first=led_panel, second=roof_mat,
                z0=ROOF_H - 0.5)
for k in range(5):
    a = math.pi / 2 * (k + 0.5) / 5
    p = turn_c + Vector((math.cos(a), math.sin(a), 0)) * (TURN_R + back_x - 0.6)
    box(f"TurnColumn{k}", (0.45, 0.45, ROOF_H), (p.x, p.y, ROOF_H / 2), structure)

# ---------------------------------------------------------------- start gantry (F1 style)
# A grey steel lattice truss across the track on two braced pylons, carrying the FIA start
# light cluster in the middle: five columns of four hooded lamps facing the grid, the lower
# pair of each lit red (the moment before lights out). Repeater lights on each pylon. No branding.
truss_mat = material("Truss", (0.3, 0.31, 0.33), rough=0.4, metal=0.6)
housing = material("LightHousing", (0.01, 0.01, 0.012), rough=0.35)
lamp_off = material("LampOff", (0.025, 0.012, 0.012), rough=0.12)
lamp_red = material("LampRed", NB_RED, emit=NB_RED, strength=30.0)

gx_l, gx_r = PIT_WALL_X + 0.6, WALL_X - 0.6
gw = gx_r - gx_l
gcx = (gx_l + gx_r) / 2
CHORD_LO, CHORD_HI = 7.8, 9.0
FRONT, BACK = START_Y - 0.45, START_Y + 0.45


def strut(name, a, b, size=0.08):
    """A straight member from point a to point b (x, y, z)."""
    va, vb = Vector(a), Vector(b)
    d = vb - va
    # Built at the origin (box() bakes its position into the mesh), turned, then moved into place.
    obj = box(name, (d.length, size, size), (0, 0, 0), truss_mat)
    # The "up" reference can't be the strut's own direction, so vertical struts use Y instead.
    up = "Y" if abs(d.normalized().z) > 0.9 else "Z"
    obj.rotation_euler = d.to_track_quat("X", up).to_euler()
    obj.location = (va + vb) / 2
    return obj


# Pylons: two posts on a concrete footing, tied and cross-braced.
for side, x in (("L", gx_l), ("R", gx_r)):
    box(f"Footing{side}", (1.3, 1.6, 0.4), (x, START_Y, 0.2), concrete)
    for y in (FRONT, BACK):
        box(f"Pylon{side}{y}", (0.26, 0.26, CHORD_HI + 0.2 - 0.4), (x, y, (CHORD_HI + 0.2 + 0.4) / 2), truss_mat)
    z = 0.4
    while z < CHORD_LO:
        strut(f"PylonTie{side}{z:.1f}", (x, FRONT, z), (x, BACK, z))
        strut(f"PylonBrace{side}{z:.1f}", (x, FRONT, z), (x, BACK, min(z + 1.2, CHORD_LO)))
        z += 1.2

# Truss: four chords, verticals and cross members at each panel point, alternating diagonals.
for y in (FRONT, BACK):
    for zc in (CHORD_LO, CHORD_HI):
        box(f"Chord{y}{zc}", (gw + 0.26, 0.16, 0.16), (gcx, y, zc), truss_mat)
panels = round(gw / 1.25)
step_x = gw / panels
for i in range(panels + 1):
    x = gx_l + i * step_x
    for y in (FRONT, BACK):
        strut(f"Vertical{i}{y}", (x, y, CHORD_LO), (x, y, CHORD_HI))
    for zc in (CHORD_LO, CHORD_HI):
        strut(f"Cross{i}{zc}", (x, FRONT, zc), (x, BACK, zc))
    if i < panels:
        up = i % 2 == 0
        for y in (FRONT, BACK):
            strut(
                f"Diagonal{i}{y}",
                (x, y, CHORD_LO if up else CHORD_HI),
                (x + step_x, y, CHORD_HI if up else CHORD_LO),
            )


def light_cluster(name, cx, cz, columns, rows, lit_rows, pitch, lamp_r, y):
    """Lamp columns in a black housing facing the grid (-y), each lamp under a small hood."""
    width = columns * pitch + 0.3
    height = rows * pitch + 0.25
    box(f"{name}Back", (width, 0.14, height), (cx, y, cz), housing)
    for c in range(columns):
        x = cx + (c - (columns - 1) / 2) * pitch
        box(f"{name}Col{c}", (pitch * 0.82, 0.12, height - 0.12), (x, y - 0.12, cz), housing)
        for r in range(rows):
            z = cz + ((rows - 1) / 2 - r) * pitch
            bpy.ops.mesh.primitive_cylinder_add(radius=lamp_r, depth=0.08, location=(x, y - 0.2, z),
                                                rotation=(math.radians(90), 0, 0))
            lamp = bpy.context.active_object
            lamp.data.materials.append(lamp_red if r in lit_rows else lamp_off)
            box(f"{name}Hood{c}{r}", (lamp_r * 2.4, 0.16, 0.025), (x, y - 0.27, z + lamp_r + 0.03), housing)


# The main cluster hangs on the front of the truss, centred over the track.
light_cluster("StartLights", 0.0, (CHORD_LO + CHORD_HI) / 2, columns=5, rows=4, lit_rows=(2, 3),
              pitch=0.46, lamp_r=0.16, y=FRONT - 0.15)
# Repeaters on each pylon, lower down, for the cars further back on the grid.
for side, x in (("L", gx_l), ("R", gx_r)):
    light_cluster(f"Repeater{side}", x, 4.6, columns=5, rows=1, lit_rows=(0,), pitch=0.26, lamp_r=0.09,
                  y=FRONT - 0.2)
# A faint red cast from the lit lamps onto the truss.
bpy.ops.object.light_add(type="POINT", location=(0.0, FRONT - 1.2, (CHORD_LO + CHORD_HI) / 2))
glow = bpy.context.active_object
glow.data.energy = 0 if DAY else 400
glow.data.color = NB_RED
glow.data.shadow_soft_size = 0.8

# ---------------------------------------------------------------- pit lane (left side, F1 style)
# As at Monza: team stands on the pit wall, the fast lane and the working lane, then a row of lit
# garages, each with an overhead rig reaching out over its pit box, under hospitality floors
# behind a mirrored glass front that leans out over the lane.
epoxy = material("Epoxy", (0.2, 0.21, 0.23), rough=0.3, coat=0.3)  # light grey garage and working-lane floor
glass = material("Glass", (0.05, 0.06, 0.08), rough=0.03, metal=0.85)
PIT_LINE_X = -15.0  # between the fast lane and the working lane
GARAGE_X = -20.4  # the garage fronts
GARAGE_D = 8.0
GARAGE_H = 4.9
BAY = 8.0
BAYS = 17
PIT_Y0 = -6.0
pit_len = BAYS * BAY
pit_cy = PIT_Y0 + pit_len / 2
garage_back = GARAGE_X - GARAGE_D


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def tyre_stack(x, y, n):
    for k in range(n):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.32, minor_radius=0.14, location=(x, y, 0.14 + k * 0.28))
        t = bpy.context.active_object
        t.data.materials.append(tyre)
        bpy.ops.object.shade_smooth()
        bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.2, location=(x, y, 0.14 + k * 0.28))
        r = bpy.context.active_object
        r.data.materials.append(rim_red)


def pit_stand(name, y):
    """A team's stand on the pit wall: a raised deck behind the wall with a desk of screens under a
    canopy that reaches over the wall, a red LED line along its track-side edge."""
    x = PIT_WALL_X - 1.1
    parts = [box(name + "Deck", (1.4, 5.6, 0.12), (x, y, 0.9), truss_mat)]
    for dy in (-2.6, 2.6):
        for dx in (-0.6, 0.6):
            parts.append(box(name + "Leg", (0.1, 0.1, 0.9), (x + dx, y + dy, 0.45), truss_mat))
        parts.append(box(name + "Mast", (0.12, 0.12, 2.4), (x - 0.6, y + dy, 2.1), truss_mat))
    parts.append(box(name + "Desk", (0.6, 5.2, 0.08), (PIT_WALL_X - 0.55, y, 1.75), housing))
    for k in range(6):
        parts.append(box(name + "Screen", (0.06, 0.7, 0.45), (PIT_WALL_X - 0.5, y + (k - 2.5) * 0.85, 2.15), housing))
    parts.append(box(name + "Canopy", (1.9, 6.0, 0.16), (x + 0.15, y, 3.35), housing))
    parts.append(box(name + "CanopyLED", (0.04, 6.0, 0.06), (x + 1.12, y, 3.35), led_red))
    return join(parts, name)


def pit_rig(name, y):
    """A team's overhead rig: an arm out from the garage over the pit box on a post, carrying a
    board and a light bar, with a cross bar at its end."""
    reach = GARAGE_X - PIT_LINE_X - 0.6
    arm_x = GARAGE_X - reach / 2
    end_x = GARAGE_X - reach
    parts = [
        box(name + "Arm", (reach, 0.25, 0.3), (arm_x, y, 4.0), housing),
        box(name + "Post", (0.16, 0.16, 4.0), (end_x, y, 2.0), housing),
        box(name + "Cross", (0.22, 2.8, 0.22), (end_x, y, 4.0), housing),
        box(name + "Board", (reach - 0.8, 0.08, 0.55), (arm_x, y, 4.45), housing),
        box(name + "BoardLED", (reach - 0.8, 0.1, 0.04), (arm_x, y, 4.15), led_red),
        box(name + "Lights", (reach - 0.6, 0.12, 0.04), (arm_x, y, 3.83), led_white),
    ]
    return join(parts, name)


# Team stands along the pit wall, one for every two garages.
for i in range(BAYS // 2):
    pit_stand(f"PitStand{i}", PIT_Y0 + BAY + i * 2 * BAY)

# Lanes: the line between them, a red band beside it, and a box marked out in front of each garage.
box("WorkingLane", (PIT_LINE_X - GARAGE_X, pit_len, 0.01), ((PIT_LINE_X + GARAGE_X) / 2, pit_cy, 0.005), epoxy)
box("PitLine", (0.18, pit_len, 0.013), (PIT_LINE_X, pit_cy, 0.0065), paint_white)
box("PitBand", (0.5, pit_len, 0.012), (PIT_LINE_X + 0.45, pit_cy, 0.006), kerb_red)
for b in range(BAYS):
    y = PIT_Y0 + b * BAY + BAY / 2
    for dy in (-1.6, 1.6):
        box(f"PitBox{b}{dy}", (4.2, 0.14, 0.013), ((PIT_LINE_X + GARAGE_X) / 2, y + dy, 0.0065), paint_white)
    pit_rig(f"PitRig{b}", y)
    # Two sets of tyres against the back wall of each garage.
    for dy in (-1.4, 1.4):
        tyre_stack(garage_back + 0.9, y + dy, 4)

# Garages: epoxy floors, dividing walls, a dark back wall with a red LED line, white LED panels in
# the ceiling and pillars between the doors.
box("GarageFloor", (GARAGE_D, pit_len, 0.02), (GARAGE_X - GARAGE_D / 2, pit_cy, 0.01), epoxy)
box("GarageBack", (0.4, pit_len, GARAGE_H), (garage_back - 0.2, pit_cy, GARAGE_H / 2), concrete)
box("GarageBackLED", (0.05, pit_len, 0.06), (garage_back + 0.03, pit_cy, 2.6), led_red)
divider = box("GarageDivider", (GARAGE_D, 0.3, GARAGE_H), (GARAGE_X - GARAGE_D / 2, PIT_Y0, GARAGE_H / 2), concrete)
array(divider, BAYS + 1, (0, BAY, 0))
pillar = box("GaragePillar", (0.6, 0.9, GARAGE_H), (GARAGE_X, PIT_Y0, GARAGE_H / 2), structure)
array(pillar, BAYS + 1, (0, BAY, 0))
box("GarageLintel", (0.6, pit_len, 0.5), (GARAGE_X, pit_cy, GARAGE_H - 0.25), structure)
for px in (GARAGE_X - 2.4, GARAGE_X - 5.6):
    panel = box(f"GaragePanel{px}", (1.4, 3.6, 0.04), (px, PIT_Y0 + BAY / 2, GARAGE_H - 0.05), led_panel)
    array(panel, BAYS, (0, BAY, 0))
for b in range(BAYS):
    bpy.ops.object.light_add(type="AREA", location=(GARAGE_X - GARAGE_D / 2, PIT_Y0 + b * BAY + BAY / 2, GARAGE_H - 0.2))
    lamp = bpy.context.active_object
    lamp.data.shape = "RECTANGLE"
    lamp.data.size = GARAGE_D - 1.5
    lamp.data.size_y = BAY - 1.5
    lamp.data.energy = (400 if DAY else 1500) * LIGHT
    lamp.data.color = COOL_WHITE

# Hospitality floors: a slab over the garages with white and red LED lines on its edge, a mirrored
# glass front leaning out towards the track, and a roof overhanging it.
SLAB_Z = GARAGE_H + 0.3
box("PitSlab", (GARAGE_D + 1.4, pit_len, 0.6), (garage_back + (GARAGE_D + 1.4) / 2, pit_cy, SLAB_Z), concrete)
slab_front = GARAGE_X + 1.4
box("PitSlabWhite", (0.04, pit_len, 0.07), (slab_front + 0.02, pit_cy, SLAB_Z + 0.18), led_white)
box("PitSlabRed", (0.04, pit_len, 0.07), (slab_front + 0.02, pit_cy, SLAB_Z - 0.18), led_red)
LEAN = math.radians(14)
glass_z0, glass_z1 = SLAB_Z + 0.3, 12.6
glass_x0 = GARAGE_X + 0.8
glass_h = glass_z1 - glass_z0


def on_glass(z):
    """Where the leaning front is at height z."""
    return glass_x0 + (z - glass_z0) * math.tan(LEAN)


glass_mid = (glass_z0 + glass_z1) / 2
box("PitBody", (on_glass(glass_z0) - 0.3 - garage_back, pit_len, glass_h), ((on_glass(glass_z0) - 0.3 + garage_back) / 2, pit_cy, glass_mid), concrete)
box("PitGlass", (0.06, pit_len, glass_h / math.cos(LEAN)), (on_glass(glass_mid), pit_cy, glass_mid), glass, rot=(0, LEAN, 0))
mullion = box("PitMullion", (0.12, 0.12, glass_h / math.cos(LEAN)), (on_glass(glass_mid) + 0.06, PIT_Y0, glass_mid), structure,
              rot=(0, LEAN, 0))
array(mullion, int(pit_len / 2) + 1, (0, 2.0, 0))
box("PitTransom", (0.22, pit_len, 0.22), (on_glass(9.0) + 0.06, pit_cy, 9.0), structure)
roof_front = on_glass(glass_z1) + 0.9
box("PitRoof", (roof_front - garage_back, pit_len, 0.5), ((roof_front + garage_back) / 2, pit_cy, glass_z1 + 0.25), roof_mat)
box("PitRoofWhite", (0.04, pit_len, 0.07), (roof_front + 0.02, pit_cy, glass_z1 + 0.25), led_white)

# ---------------------------------------------------------------- floodlight masts across the track
# As at F1 night races (Bahrain, Lusail, Jeddah): a tall tapered steel mast topped by a headframe,
# a steel frame holding a grid of rectangular LED floodlights tilted down at the track, with a
# maintenance platform and railing beneath it.
lamp_case = material("LampCase", (0.06, 0.065, 0.07), rough=0.4, metal=0.5)
MAST_H = 28.0
LAMP_COLS, LAMP_ROWS = 6, 4


def headframe(name):
    """The headframe at the origin, lamps facing +X: a frame of beams with the floodlight grid
    in front, the platform and railing underneath."""
    parts = []
    w, h = LAMP_COLS * 0.95, LAMP_ROWS * 0.85
    for z in (-h / 2, h / 2):
        parts.append(box(name + "Beam", (0.14, w + 0.3, 0.14), (0, 0, z), truss_mat))
    for y in (-w / 2 - 0.08, 0, w / 2 + 0.08):
        parts.append(box(name + "Post", (0.14, 0.14, h + 0.14), (0, y, 0), truss_mat))
    for c in range(LAMP_COLS):
        for r in range(LAMP_ROWS):
            y = (c - (LAMP_COLS - 1) / 2) * 0.95
            z = (r - (LAMP_ROWS - 1) / 2) * 0.85
            parts.append(box(name + "Case", (0.3, 0.8, 0.68), (0.24, y, z), lamp_case))
            parts.append(box(name + "Lens", (0.03, 0.7, 0.58), (0.4, y, z), flood_head))
    floor_z = -h / 2 - 0.35
    parts.append(box(name + "Deck", (1.3, w + 0.5, 0.06), (0.3, 0, floor_z), truss_mat))
    parts.append(box(name + "Rail", (0.05, w + 0.5, 0.05), (0.92, 0, floor_z + 0.3), truss_mat))
    for y in (-w / 2 - 0.2, 0, w / 2 + 0.2):
        parts.append(box(name + "RailPost", (0.05, 0.05, 0.3), (0.92, y, floor_z + 0.15), truss_mat))
    return join(parts, name)


# Behind the pit building.
for i, y in enumerate((-2, 30, 62, 94, 126)):
    tx = garage_back - 3.0
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.42, radius2=0.18, depth=MAST_H, location=(tx, y, MAST_H / 2))
    mast = bpy.context.active_object
    mast.name = f"Mast{i}"
    mast.data.materials.append(structure)
    bpy.ops.object.shade_smooth()
    box(f"MastBase{i}", (1.2, 1.2, 0.5), (tx, y, 0.25), concrete)
    # Aimed back up the track at the grid, so the lamps face the camera.
    aim = Vector((3, y - 12, 0))
    top = Vector((tx, y, MAST_H + 0.6))
    to_aim = aim - top
    yaw = math.atan2(to_aim.y, to_aim.x)
    head = headframe(f"Head{i}")
    head.rotation_euler = (0, math.radians(24), yaw)
    head.location = top + Vector((math.cos(yaw), math.sin(yaw), 0)) * 0.45
    # The bracket from the mast top to the headframe.
    box(f"Bracket{i}", (0.9, 0.22, 0.22), (tx + math.cos(yaw) * 0.25, y + math.sin(yaw) * 0.25, MAST_H - 0.2), truss_mat,
        rot=(0, 0, yaw))
    bpy.ops.object.light_add(type="SPOT", location=head.location + Vector((math.cos(yaw), math.sin(yaw), 0)) * 0.8)
    spot = bpy.context.active_object
    spot.data.energy = 0 if DAY else 1400000 * LIGHT
    spot.data.spot_size = math.radians(70)
    spot.data.spot_blend = 0.6
    spot.data.color = COOL_WHITE
    direction = aim - spot.location
    spot.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

# ---------------------------------------------------------------- camera
def make_camera(name, loc, target, lens):
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.active_object
    cam.name = name
    cam.data.lens = lens
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return cam


desktop_cam = make_camera("CamDesktop", (-1.5, -16, 1.5), (5.5, 40, 4.2), 22)
mobile_cam = make_camera("CamMobile", (1.5, -12, 1.6), (10.5, 30, 3.4), 19)

# ---------------------------------------------------------------- sky
world = bpy.data.worlds.new("Day" if DAY else "Night")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
if DAY:
    # A physical daytime sky, with the sun low over the track behind the camera so it lights
    # the face of the grandstand; the sun disc itself stays out of the sky texture.
    SUN_ELEVATION = math.radians(38)
    SUN_AZIMUTH = math.radians(-35)
    sky = world.node_tree.nodes.new("ShaderNodeTexSky")
    for kind in ("MULTIPLE_SCATTERING", "SINGLE_SCATTERING", "NISHITA", "HOSEK_WILKIE", "PREETHAM"):
        try:
            sky.sky_type = kind
            break
        except TypeError:
            continue
    for prop, value in (("sun_disc", False), ("sun_elevation", SUN_ELEVATION), ("sun_rotation", SUN_AZIMUTH),
                        ("air_density", 1.0), ("dust_density", 1.5)):
        if hasattr(sky, prop):
            setattr(sky, prop, value)
    world.node_tree.links.new(sky.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.35
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 50))
    sun = bpy.context.active_object
    sun.data.energy = 4.0
    sun.data.angle = math.radians(1.5)
    sun.data.color = (1.0, 0.96, 0.9)
    # Shining from the sun's position (azimuth/elevation) towards the scene.
    toward = Vector((math.cos(SUN_ELEVATION) * math.sin(SUN_AZIMUTH), -math.cos(SUN_ELEVATION) * math.cos(SUN_AZIMUTH), math.sin(SUN_ELEVATION)))
    sun.rotation_euler = (-toward).to_track_quat("-Z", "Y").to_euler()
else:
    bg.inputs["Color"].default_value = (0.004, 0.006, 0.014, 1)
    bg.inputs["Strength"].default_value = 0.6

# ---------------------------------------------------------------- sky as seen (clouds, moon, stars)
# The sky above lights the scene as before; the camera and reflections see a painted one: blue
# with clouds by day, stars and a moon by night.
nodes, links = world.node_tree.nodes, world.node_tree.links


def plug(socket, value):
    if isinstance(value, bpy.types.NodeSocket):
        links.new(value, socket)
    elif socket.type == "RGBA" and len(value) == 3:
        socket.default_value = (*value, 1)
    else:
        socket.default_value = value


def maths(op, a, b=None):
    m = nodes.new("ShaderNodeMath")
    m.operation = op
    plug(m.inputs[0], a)
    if b is not None:
        plug(m.inputs[1], b)
    return m.outputs[0]


def remap(value, lo, hi, out_lo=0.0, out_hi=1.0):
    """value mapped from lo..hi to out_lo..out_hi, smoothly and clamped."""
    m = nodes.new("ShaderNodeMapRange")
    m.interpolation_type = "SMOOTHSTEP"
    m.clamp = True
    for name, v in (("Value", value), ("From Min", lo), ("From Max", hi), ("To Min", out_lo), ("To Max", out_hi)):
        plug(m.inputs[name], v)
    return m.outputs[0]


def emit(color, strength):
    b = nodes.new("ShaderNodeBackground")
    plug(b.inputs["Color"], color)
    plug(b.inputs["Strength"], strength)
    return b.outputs[0]


def add(*shaders):
    total = shaders[0]
    for s in shaders[1:]:
        a = nodes.new("ShaderNodeAddShader")
        links.new(total, a.inputs[0])
        links.new(s, a.inputs[1])
        total = a.outputs[0]
    return total


def mix(fac, a, b):
    m = nodes.new("ShaderNodeMixShader")
    plug(m.inputs[0], fac)
    links.new(a, m.inputs[1])
    links.new(b, m.inputs[2])
    return m.outputs[0]


def ramp(value, stops):
    r = nodes.new("ShaderNodeValToRGB")
    plug(r.inputs["Fac"], value)
    elems = r.color_ramp.elements
    while len(elems) < len(stops):
        elems.new(0.5)
    for el, (pos, color) in zip(elems, stops):
        el.position = pos
        el.color = (*color, 1)
    return r.outputs["Color"]


def pixel_direction(cam, x, y, w, h):
    """The world direction through pixel (x, y) of a w x h render from cam."""
    bpy.context.view_layer.update()
    sensor = cam.data.sensor_width
    span = sensor / max(w, h)
    local = Vector(((x - w / 2) * span, (h / 2 - y) * span, -cam.data.lens))
    return (cam.matrix_world.to_3x3() @ local).normalized()


direction = nodes.new("ShaderNodeTexCoord").outputs["Generated"]
xyz = nodes.new("ShaderNodeSeparateXYZ")
links.new(direction, xyz.inputs[0])
elevation = xyz.outputs["Z"]

if DAY:
    # Deep blue overhead, paling towards the horizon.
    sky_color = ramp(remap(elevation, 0.0, 0.75), [(0.0, (0.6, 0.76, 0.95)), (0.3, (0.24, 0.47, 0.9)), (1.0, (0.07, 0.24, 0.78))])
    painted = emit(sky_color, 1.25)
    # Clouds on a flat layer overhead: each direction meets the layer at (x, y) / z, so they
    # shrink and crowd together towards the horizon as real ones do.
    height = maths("MAXIMUM", elevation, 0.02)
    layer = nodes.new("ShaderNodeCombineXYZ")
    links.new(maths("DIVIDE", xyz.outputs["X"], height), layer.inputs["X"])
    links.new(maths("DIVIDE", xyz.outputs["Y"], height), layer.inputs["Y"])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    links.new(layer.outputs[0], noise.inputs["Vector"])
    for name, v in (("W", 3.7), ("Scale", 0.42), ("Detail", 9.0), ("Roughness", 0.58), ("Distortion", 0.25)):
        plug(noise.inputs[name], v)
    density = noise.outputs["Fac"]
    cover = maths("MULTIPLY", remap(density, 0.49, 0.6), remap(elevation, 0.015, 0.12))
    # Thick middles a little greyer than the sunlit edges.
    shade = remap(density, 0.56, 0.85, 1.0, 0.74)
    clouds = emit((1.0, 1.0, 1.0), maths("MULTIPLY", shade, 2.4))
    painted = mix(cover, painted, clouds)
else:
    # Stars: two layers of random points, a few bright and many faint, thinning out low down.
    def star_layer(scale, radius, keep, strength):
        cells = nodes.new("ShaderNodeTexVoronoi")
        cells.voronoi_dimensions = "3D"
        cells.feature = "F1"
        links.new(direction, cells.inputs["Vector"])
        cells.inputs["Scale"].default_value = scale
        pick = nodes.new("ShaderNodeSeparateColor")
        links.new(cells.outputs["Color"], pick.inputs[0])
        point = remap(cells.outputs["Distance"], 0.0, radius, 1.0, 0.0)
        brightness = maths("POWER", remap(pick.outputs["Red"], keep, 1.0), 2.0)
        return maths("MULTIPLY", maths("MULTIPLY", point, brightness), strength)

    stars = maths("ADD", star_layer(90, 0.09, 0.82, 6.0), star_layer(220, 0.16, 0.7, 2.2))
    stars = maths("MULTIPLY", stars, remap(elevation, 0.03, 0.2))

    # The moon, in open sky in each framing: between the floodlight poles on the left of the
    # desktop view, above the gantry and below a phone's top bar in the portrait one. aim_moon sets it
    # before each render.
    MOON_RADIUS = math.radians(1.7)
    MOON_AT = {desktop_cam: (600, 120, 1920, 1080), mobile_cam: (150, 280, 608, 1080)}
    toward_moon = nodes.new("ShaderNodeVectorMath")
    toward_moon.operation = "DOT_PRODUCT"
    links.new(direction, toward_moon.inputs[0])
    closeness = toward_moon.outputs["Value"]
    disc = remap(closeness, math.cos(MOON_RADIUS * 1.04), math.cos(MOON_RADIUS * 0.96))
    # Darker seas across its face, from where each direction falls on the disc.
    across = nodes.new("ShaderNodeVectorMath")
    across.operation = "CROSS_PRODUCT"
    links.new(direction, across.inputs[0])
    face = nodes.new("ShaderNodeVectorMath")
    face.operation = "SCALE"
    links.new(across.outputs[0], face.inputs[0])
    face.inputs["Scale"].default_value = 1 / math.sin(MOON_RADIUS)
    seas = nodes.new("ShaderNodeTexNoise")
    links.new(face.outputs[0], seas.inputs["Vector"])
    for name, v in (("Scale", 1.6), ("Detail", 6.0), ("Roughness", 0.6)):
        plug(seas.inputs[name], v)
    surface = remap(seas.outputs["Fac"], 0.38, 0.62, 0.58, 1.0)
    moon = maths("MULTIPLY", maths("MULTIPLY", disc, surface), 3.2)
    halo = maths("MULTIPLY", maths("POWER", remap(closeness, math.cos(MOON_RADIUS * 9), 1.0), 3.0), 0.05)

    def aim_moon(cam):
        toward_moon.inputs[1].default_value = across.inputs[1].default_value = pixel_direction(cam, *MOON_AT[cam])

    painted = add(
        emit((0.004, 0.006, 0.014), 0.6),
        emit((0.85, 0.9, 1.0), maths("MULTIPLY", stars, maths("SUBTRACT", 1.0, disc))),
        emit((0.93, 0.95, 1.0), moon),
        emit((0.55, 0.65, 0.9), halo),
    )

light_path = nodes.new("ShaderNodeLightPath")
seen = maths("MAXIMUM", light_path.outputs["Is Camera Ray"], light_path.outputs["Is Glossy Ray"])
output = nodes["World Output"]
links.new(mix(seen, bg.outputs[0], painted), output.inputs["Surface"])

# ---------------------------------------------------------------- render settings
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for backend in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = backend
        prefs.get_devices()
        if any(d.type == backend for d in prefs.devices):
            break
    except TypeError:
        continue
for d in prefs.devices:
    d.use = d.type != "CPU"
scene.cycles.device = "GPU"
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.view_settings.view_transform = "AgX"
for look in ("AgX - Medium High Contrast", "AgX - Punchy", "Medium High Contrast"):
    try:
        scene.view_settings.look = look
        break
    except TypeError:
        continue
scene.view_settings.exposure = EXPOSURE


def bloom(pixels, w, h):
    """Glow around the lights, as in the garage render: blurred over-bright light added back."""
    img = pixels.reshape(h, w, 4)
    rgb = img[..., :3]
    bright = np.maximum(rgb - 1.0, 0.0)

    def box_blur(a, r):
        for axis in (0, 1):
            c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in range(3)], mode="edge"), axis=axis)
            hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
            a = (hi - lo) / (2 * r + 1)
        return a

    glow = np.zeros_like(bright)
    scale = w / 1920
    for radius, weight in ((6, 0.5), (18, 0.35), (48, 0.25)):
        r = max(1, int(radius * scale))
        glow += box_blur(box_blur(bright, r), r) * weight
    img[..., :3] = rgb + glow * 0.45
    return img.ravel()


def render(cam, w, h, samples, path):
    scene.camera = cam
    if not DAY:
        aim_moon(cam)
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    raw = path + ".exr"
    scene.render.image_settings.file_format = "OPEN_EXR"
    scene.render.image_settings.color_depth = "32"
    scene.render.filepath = raw
    bpy.ops.render.render(write_still=True)
    src = bpy.data.images.load(raw)
    px = np.empty(w * h * 4, dtype=np.float32)
    src.pixels.foreach_get(px)
    out = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=True)
    # Glow belongs to the night's lights; by day it would only haze the sky.
    out.pixels.foreach_set(px if DAY else bloom(px, w, h))
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.quality = 88
    out.save_render(path + ".webp", scene=scene)
    os.remove(raw)
    print("WROTE", path + ".webp")


os.makedirs(OUT, exist_ok=True)
SUFFIX = "-day" if DAY else ""
if MODE == "preview":
    render(desktop_cam, 960, 540, 64, os.path.join(OUT, "preview" + SUFFIX))
    render(mobile_cam, 304, 540, 64, os.path.join(OUT, "preview" + SUFFIX + "-m"))
else:
    render(desktop_cam, 1920, 1080, 384, os.path.join(OUT, "grandstand" + SUFFIX))
    render(mobile_cam, 608, 1080, 384, os.path.join(OUT, "grandstand" + SUFFIX + "-m"))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "grandstand" + SUFFIX + ".blend"))
