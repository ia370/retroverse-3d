# Blender modelling guide — NES, SNES, N64

This guide gets you from an empty Blender file to three rubric‑grade models
exported as `.glb` and dropped into `assets/models/`. Aim for **clean topology**,
**efficient geometry** (≤ 15k triangles each) and a **single base‑colour atlas**
per model.

> **Why this matters for marks**: the rubric awards 20 points for "3D Models"
> based on geometry quality, materials/textures, lighting and camera. The
> N64 doubles as your **complex** model — that unlocks one of the
> 5‑mark "deeper understanding" blocks.

---

## 1 · One‑off setup

1. Install **Blender 4.x** (free, blender.org).
2. Save your work into `assets/source/`:
   * `nes.blend`
   * `snes.blend`
   * `n64.blend`
3. Set the unit system to **Metric / centimetres** (`Properties → Scene → Units`).
4. Background colour to dark grey so light models read clearly.

## 2 · Reference imagery

For each console, find:

* a **front** orthographic photo
* a **top** photo
* a **side** photo

Drop each into Blender via `Add → Image → Reference`, align to the relevant
orthographic axis (Numpad 1 / 3 / 7), and lock visibility per view in the
Object‑Data properties so they don't clutter the perspective viewport.

## 3 · Modelling workflow (same for all three)

1. Start from a **Cube** scaled to the rough body proportions of the console.
2. Edit‑mode (`Tab`) → enable **proportional editing** off, **mirror** on the
   X‑axis (`Mirror modifier` with clipping).
3. Add **loop cuts** (`Ctrl+R`) to give yourself rows for the slot, button area
   and corner bevels.
4. **Bevel** all visible edges by ~1 mm with 2 segments (`Ctrl+B`, scroll wheel).
5. Inset and extrude the **cartridge slot** (NES, SNES, N64 cartridge bay) and
   the **expansion bay** (N64 underside).
6. Add face details (power button, reset button, LED) with extra small cuboids,
   then **join** them into the main mesh (`Ctrl+J`) once the topology is final.
7. **Shade smooth** on the rounded corners; **shade flat** on the boxy faces.
   Use `Auto Smooth` at 30° in the mesh data panel.

### Per‑console specifics

| Console | Distinctive features to nail |
|---|---|
| **NES**  | Top‑loading slot lip, the front "door" panel, the round red power LED, the diagonal grey stripes near the controller ports. |
| **SNES** | Soft rounded corners (heavier bevel), the eject button on top, the four PAL/JP coloured face buttons (model these on the controller). |
| **N64**  | Trapezoidal silhouette, the recessed cartridge bay on top, the carry handle, **and the controller** — three‑pronged grip with analogue stick (this is the model that earns the "complex" mark). |

## 4 · UV unwrapping

1. In Edit mode, select all (`A`).
2. Mark seams along hidden edges (`Edge → Mark Seam`).
3. `U → Smart UV Project` for a first pass, then refine in the UV editor.
4. Pack islands (`UV → Pack Islands`, margin 0.005) into a 2K square.

## 5 · Texturing

For each model, paint or composite a single **2048 × 2048** PNG containing:

* base colour (the plastic body)
* the printed Nintendo logo / decals (use separate UV islands so you can swap)
* dust / wear (very subtle, just to make the surface read)

Plug the texture into a **Principled BSDF** with:

* Base Colour ← your atlas
* Roughness ≈ 0.45
* Specular ≈ 0.5
* Metallic = 0 (consoles are matte plastic)

Optional: a black‑and‑white roughness map plugged into the Roughness input
(adds the subtle scratch/finger‑print look).

## 6 · Lighting (sanity check inside Blender)

Add three lights so you can preview before export:

* **Sun** (key) at 35° from above‑right, strength ≈ 5
* **Area** (fill) opposite the key, strength ≈ 50, large
* **Spot** (rim) behind the model, coloured slightly warm, strength ≈ 200

These are just for your reference; the runtime lights live in `view.js`.
Keep them in the file so the marker can open `.blend` and see the intent.

## 7 · Cameras

Add **two** cameras to each `.blend`:

* `Camera_Persp` — focal length 50 mm, ¾ view
* `Camera_Ortho` — orthographic, top‑down

Bind hot‑keys (`Numpad 0`) for review. Again, this is for the marker reading
the source file.

## 8 · Export to glTF

`File → Export → glTF 2.0 (.glb/.gltf)` with these settings:

* **Format**: `glTF Binary (.glb)`
* **Include** → Selected Objects only (so you skip the reference images)
* **Transform** → +Y Up (default)
* **Geometry** → Apply Modifiers ✓, UVs ✓, Normals ✓, Tangents ✓
* **Material** → Export Materials = `Export`
* **Compression** → Draco ✓ (level 6)  — keeps the file small

Save into `assets/models/`:

```
assets/models/nes.glb
assets/models/snes.glb
assets/models/n64.glb
```

## 9 · Sanity check in the app

```bash
php -S localhost:8000   # from the project root
```

Open `http://localhost:8000/`, pick each console from the gallery, then check:

* Auto‑framing centres the model (the view bounds it from `Box3`).
* Solid / wireframe toggle works.
* Camera presets (Front / Top / Iso) frame sensibly.
* The fresnel rim outlines the silhouette without smearing.
* Bloom highlights the LED / reset button without blowing out the body.

If something looks off, fix it in `.blend` and re‑export — the runtime caches
nothing besides the JS modules, so a hard refresh is enough.

## 10 · Polygon budget

| Model | Target tris |
|---|---|
| NES   | 4 000 – 6 000 |
| SNES  | 5 000 – 8 000 |
| N64 console | 6 000 – 9 000 |
| N64 controller (the complex piece) | 9 000 – 14 000 |

Use `Statistics` overlay in the viewport to keep an eye on the counter.

## 11 · Common pitfalls

| Symptom | Fix |
|---|---|
| Model appears tiny / huge | Apply scale in Object mode (`Ctrl+A → Scale`) before export. |
| Model looks shiny‑plastic chrome in browser | Roughness too low, or normals inverted. Check `Mesh → Normals → Recalculate Outside`. |
| Texture is mirrored | UV islands flipped — in UV editor, `Mesh → UV → Mirror`. |
| Animation doesn’t play | Make sure the action is pushed down to an NLA track, otherwise glTF won’t export it. |
| File is huge (> 5 MB) | Re‑export with Draco compression and downscale the texture atlas. |
