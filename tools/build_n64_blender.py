"""
Build the RetroVerse N64 model inside Blender.

HOW TO USE
----------
1. Open Blender 4.x → File → New → General.
2. Switch to the **Scripting** workspace (top bar).
3. Open this file (Text → Open) or paste its contents into a new Text block.
4. Press **Run Script** (or Alt+P with the cursor in the editor).
5. Save as `assets/source/n64.blend`.
6. Export via File → Export → glTF 2.0 with the settings in docs/blender-guide.md §8
   (glTF Binary, Selected Objects, +Y Up, Apply Modifiers, Draco compression).
   Overwrite `assets/models/n64.glb`.

The script clears the default scene and produces a single editable `N64` object
that mirrors the geometry of `assets/models/n64.glb` — same proportions, same
named materials — so the marker can compare source-against-export. Feel free to
refine: add bevels, edge loops, the carry handle, decals, etc.
"""
import math
import bpy
import bmesh
from mathutils import Vector

# ---------------------------------------------------------------- helpers

def hex_rgba(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)

def get_or_make_material(name, color_hex, roughness=0.6, metallic=0.0, emissive_hex=None, emissive_strength=1.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = hex_rgba(color_hex)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emissive_hex:
        bsdf.inputs["Emission Color"].default_value = hex_rgba(emissive_hex)
        # Blender 4.x uses "Emission Strength"; fall back gracefully for older builds
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat

def new_mesh_obj(name):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj, mesh

def assign_material(obj, mat):
    if mat.name not in [m.name for m in obj.data.materials]:
        obj.data.materials.append(mat)
    # Make sure all faces use this material
    for poly in obj.data.polygons:
        poly.material_index = 0

def add_box(name, w, h, d, location=(0, 0, 0), material=None, base_y=True):
    """Box centered on XZ; `base_y=True` puts the base on Y=0 (world up in this scene is Y)."""
    obj, mesh = new_mesh_obj(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    # Scale: cube is unit cube centered at origin
    bmesh.ops.scale(bm, vec=(w, h, d), verts=bm.verts)
    if base_y:
        bmesh.ops.translate(bm, vec=(0, h / 2, 0), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    if material is not None:
        assign_material(obj, material)
    return obj

def add_cylinder(name, radius, height, segments=24, location=(0, 0, 0), material=None):
    """Cylinder along +Y, base on Y=0 (then translated to `location`)."""
    obj, mesh = new_mesh_obj(name)
    bm = bmesh.new()
    # Build a cylinder along Z then rotate to Y
    bmesh.ops.create_cone(
        bm, segments=segments, radius1=radius, radius2=radius, depth=height, cap_ends=True, cap_tris=False
    )
    # Default cylinder axis is +Z, centered on origin (so Z spans -h/2 to +h/2). Rotate to +Y axis and lift.
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=_rot_x(math.pi / 2), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, height / 2, 0), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    if material is not None:
        assign_material(obj, material)
    return obj

def _rot_x(theta):
    c, s = math.cos(theta), math.sin(theta)
    from mathutils import Matrix
    return Matrix(((1, 0, 0), (0, c, -s), (0, s, c)))

def add_trapezoidal_prism(name, bw, tw, h, d, location=(0, 0, 0), material=None):
    """Body of the N64 — trapezoidal prism tapering from `bw` (bottom) to `tw` (top)."""
    obj, mesh = new_mesh_obj(name)
    bm = bmesh.new()
    hwb, hwt, hd = bw / 2, tw / 2, d / 2
    v = [
        bm.verts.new((-hwb, 0, -hd)),  # 0
        bm.verts.new(( hwb, 0, -hd)),  # 1
        bm.verts.new(( hwb, 0,  hd)),  # 2
        bm.verts.new((-hwb, 0,  hd)),  # 3
        bm.verts.new((-hwt, h, -hd)),  # 4
        bm.verts.new(( hwt, h, -hd)),  # 5
        bm.verts.new(( hwt, h,  hd)),  # 6
        bm.verts.new((-hwt, h,  hd)),  # 7
    ]
    bm.faces.new((v[0], v[1], v[2], v[3]))  # bottom
    bm.faces.new((v[7], v[6], v[5], v[4]))  # top
    bm.faces.new((v[3], v[2], v[6], v[7]))  # +Z front
    bm.faces.new((v[1], v[0], v[4], v[5]))  # -Z back
    bm.faces.new((v[2], v[1], v[5], v[6]))  # +X side (tapered)
    bm.faces.new((v[0], v[3], v[7], v[4]))  # -X side (tapered)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # safety
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    if material is not None:
        assign_material(obj, material)
    return obj

# ---------------------------------------------------------------- build

def clear_scene():
    # Wipe the default cube/camera/light so we start clean.
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)

def build_n64():
    clear_scene()

    # Match the palette in js/model.js
    COL_BODY    = "#2a2c30"
    COL_BAY_LIP = "#3e4148"
    COL_DARK    = "#0e1014"
    COL_MINT    = "#6cffb6"
    COL_RED     = "#c83030"
    COL_BTN     = "#7d8390"

    mat_body  = get_or_make_material("N64.body",     COL_BODY,    roughness=0.55, metallic=0.04)
    mat_lip   = get_or_make_material("N64.bay_lip",  COL_BAY_LIP, roughness=0.55)
    mat_dark  = get_or_make_material("N64.dark",     COL_DARK,    roughness=0.85)
    mat_mint  = get_or_make_material("N64.accent",   COL_MINT,    roughness=0.30, metallic=0.10)
    mat_led   = get_or_make_material("N64.led",      COL_MINT,    roughness=0.20,
                                     emissive_hex=COL_MINT, emissive_strength=4.0)
    mat_red   = get_or_make_material("N64.power",    COL_RED,     roughness=0.40)
    mat_btn   = get_or_make_material("N64.button",   COL_BTN,     roughness=0.40, metallic=0.15)
    mat_shell = get_or_make_material("N64.port_shell", COL_BTN,   roughness=0.55, metallic=0.05)

    parts = []

    # Body (trapezoidal prism, base on Y=0)
    parts.append(add_trapezoidal_prism("Body", bw=1.90, tw=1.60, h=0.78, d=1.70, material=mat_body))

    # Cartridge bay: raised lip + recessed dark opening (back half of top)
    parts.append(add_box("BayLip",  1.32, 0.05, 0.72, location=(0, 0.78, -0.30), material=mat_lip))
    parts.append(add_box("BayHole", 1.22, 0.10, 0.62, location=(0, 0.80, -0.30), material=mat_dark))

    # Mint accent strip across top-front
    parts.append(add_box("AccentStrip", 1.40, 0.025, 0.06, location=(0, 0.78, 0.55), material=mat_mint))

    # Power (red rectangle), Reset (round), LED (round, emissive) on top-front
    parts.append(add_box("PowerButton", 0.22, 0.045, 0.10, location=(-0.42, 0.78, 0.28), material=mat_red))
    parts.append(add_cylinder("ResetButton", radius=0.05, height=0.04,
                              location=(-0.15, 0.78, 0.30), material=mat_btn))
    parts.append(add_cylinder("LED", radius=0.025, height=0.018, segments=16,
                              location=(0.50, 0.78, 0.32), material=mat_led))

    # Three controller ports along the front face (iconic N64 detail)
    for i, x_off in enumerate((-0.55, 0.0, 0.55)):
        parts.append(add_box(f"PortShell_{i}",  0.32, 0.18, 0.08,
                             location=(x_off, 0.18, 0.89), material=mat_shell))
        parts.append(add_box(f"PortSocket_{i}", 0.24, 0.10, 0.04,
                             location=(x_off, 0.22, 0.935), material=mat_dark))

    # Subtle dark cooling vents on each side
    for sign in (-1, 1):
        parts.append(add_box(f"Vent_{'L' if sign < 0 else 'R'}", 0.02, 0.32, 0.80,
                             location=(sign * 0.94, 0.10, 0.05), material=mat_dark))

    # Select all parts and join into a single "N64" object so the marker sees
    # one named object rather than a soup of cubes. Comment this block out if
    # you'd rather keep the parts editable separately.
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    bpy.context.active_object.name = "N64"

    # Apply scale (cleanly) so any future export uses unit metres.
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Frame the model in the 3D viewport for convenience.
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            for region in area.regions:
                if region.type == "WINDOW":
                    with bpy.context.temp_override(area=area, region=region):
                        bpy.ops.view3d.view_all(center=False)
            break

    print("Built N64. Save as assets/source/n64.blend, then export glTF 2.0 (.glb) per docs/blender-guide.md §8.")

if __name__ == "__main__":
    build_n64()
