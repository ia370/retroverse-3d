# NES — step-by-step Blender walkthrough

This guide gets you from empty Blender to a finished `nes.glb` in
`assets/models/` that drops straight into your 3D app.

> **Time budget**: 3–5 hours, split across one or two sittings. Aim for
> *recognisable*, not photorealistic. The marker wants clean topology,
> sensible materials and a model that reads as an NES — not a CAD-perfect
> replica.

> **Convention**: keys in `<kbd>K</kbd>`. On macOS, Blender uses the same
> hotkeys as Windows — **Ctrl is Ctrl, not Cmd** in Blender. Numpad keys
> matter. If you're on a laptop without a numpad, turn on
> *Edit → Preferences → Input → Emulate Numpad* before you start.

---

## Section 0 — Setup (15 min)

1. Install **Blender 4.x** from <https://www.blender.org/download/>. Free.
2. Open Blender. You'll see a default scene with a cube, a camera and a
   light.
3. **Save the file now** so autosaves work:
   - <kbd>Ctrl</kbd> + <kbd>S</kbd>
   - Navigate to `~/Desktop/3DApp/assets/source/`
   - Filename: `nes.blend` → **Save As**
4. Set unit scale so numbers feel sensible:
   - Right-hand panel → **Scene Properties** (the cone-and-sphere icon)
   - **Units** section → **Unit Scale** = `0.1`
   - Length stays Metric. Now `1 BU` ≈ `100 mm`, so an NES (~256 mm wide)
     will be `2.56` units wide — comfortable to type and to look at.
5. Set viewport shading to **Material Preview** so you can see colours as
   you go: top-right of the 3D viewport, click the **3rd sphere** icon.
6. Delete the default cube — you'll start fresh:
   - Left-click the cube to select → <kbd>X</kbd> → **Delete**.

**Checkpoint 0**: empty grey viewport with a camera and a light. File saved
as `nes.blend` in `assets/source/`.

---

## Section 1 — Reference imagery (10 min)

You'll model from photos. You need **three** orthographic-style photos of
a front-loading NES (the original "toaster"):

- **Front** view (the side with the red cartridge door)
- **Top** view (showing the POWER and RESET buttons)
- **Side** view (right side, no controls visible)

Source the photos:

1. In a browser, search Google Images for `NES front view`,
   `NES top view`, `NES side view`. Look for Wikipedia or Nintendo
   product pages — those photos tend to be square-on.
2. Save the three images to `~/Desktop/3DApp/assets/source/refs/`. Name
   them `nes-front.jpg`, `nes-top.jpg`, `nes-side.jpg`.

Bring them into Blender as background reference:

3. In Blender, look down the **−Y axis** (front view): <kbd>Numpad 1</kbd>
4. <kbd>Shift</kbd> + <kbd>A</kbd> → **Image** → **Reference**
5. Pick `nes-front.jpg`. The image appears in the viewport.
6. With it selected, right-side N-panel → **Item** tab. Set:
   - **Location** = `0, 0, 0.35` (we'll lift it so it sits behind the
     model)
   - **Rotation** = `90°, 0°, 0°` so it stands up facing −Y
   - **Empty** tab → **Side**: `Front` (only shows when looking from front)
   - **Empty** tab → **Opacity** = `0.4` so it doesn't dominate
7. Repeat for the **side** image: <kbd>Numpad 3</kbd> view, location
   `0, 0, 0.35`, rotation `90°, 0°, 90°`, side = `Front`.
8. Repeat for the **top** image: <kbd>Numpad 7</kbd> view, location
   `0, 0, 0.7`, rotation `0°, 0°, 0°`, side = `Front`.

You don't have to scale them perfectly — you'll just use them for
proportions.

**Checkpoint 1**: when you orbit the viewport (middle-mouse-drag) you see
three faded reference images at right-angles to each other.

---

## Section 2 — Main body (30 min)

This is the cream-coloured cuboid that everything else hangs off.

1. <kbd>Shift</kbd> + <kbd>A</kbd> → **Mesh** → **Cube**. A 2×2×2 cube
   spawns at the origin.
2. With it selected, press <kbd>N</kbd> to open the right-side panel.
   In the **Item** tab, set:
   - **Dimensions** → `X = 2.56`, `Y = 2.00`, `Z = 0.70`
3. Move the cube up so it sits *on* the floor (Z=0):
   - **Location** → `Z = 0.35`
4. **Apply scale and location** so future operations work in real units:
   - <kbd>Ctrl</kbd> + <kbd>A</kbd> → **All Transforms**
5. Rename the object: in the **Outliner** (top-right list), double-click
   the cube and rename to `Body`.

### 2a · Bevel the edges

A real NES has slightly rounded corners — never perfectly sharp.

6. Switch to **Edit Mode**: <kbd>Tab</kbd>
7. Make sure all geometry is selected: <kbd>A</kbd>
8. <kbd>Ctrl</kbd> + <kbd>B</kbd> to bevel. **Drag mouse slightly**, then
   **scroll wheel up twice** (gives 3 segments). Type `0.02` for the bevel
   width, then <kbd>Enter</kbd>.

### 2b · Front recess (where the cartridge door sits)

The NES door doesn't sit flush with the front face; it's recessed into a
shallow rectangular pocket.

9. Still in Edit Mode. Switch to face-select: <kbd>3</kbd>.
10. Look at the front: <kbd>Numpad 1</kbd>.
11. Click the front face once to select it.
12. <kbd>I</kbd> (inset) → type `0.10` → <kbd>Enter</kbd>. A smaller face
    appears inside.
13. <kbd>I</kbd> again → type `0.05` → <kbd>Enter</kbd> (a second, even
    smaller inset, gives us a clean lip).
14. Now extrude the inner face *into* the body to create the pocket:
    <kbd>E</kbd> → type `-0.04` → <kbd>Enter</kbd>.

You should see a rectangular recess on the front, framed by a thin lip.

### 2c · Tag the recess for the door

15. With that recessed face still selected, look at the **Item** tab on the
    right. The face **Median** should be roughly `Y = -0.96`. Note this
    number — you'll position the door against it.

### 2d · Apply shade smoothing

16. Out of Edit Mode: <kbd>Tab</kbd>.
17. Right-click the body → **Shade Auto Smooth**. In the popup, set
    **Angle** to `30°`.

**Checkpoint 2**: a cream-coloured rounded cuboid with a clear rectangular
pocket on the front. Save: <kbd>Ctrl</kbd> + <kbd>S</kbd>.

---

## Section 3 — Cartridge door (the red flap, 20 min)

1. <kbd>Shift</kbd> + <kbd>A</kbd> → **Mesh** → **Cube**.
2. <kbd>N</kbd> → set **Dimensions** = `1.85, 0.04, 0.50`.
3. **Location** = `0, -0.97, 0.45`. (The Y is just outside the recessed
   face from step 2c. Tweak if your recess sits at a different Y.)
4. Apply scale + location: <kbd>Ctrl</kbd> + <kbd>A</kbd> → **All
   Transforms**.
5. Rename to `Door` in the Outliner.
6. Bevel the edges: <kbd>Tab</kbd> → <kbd>A</kbd> → <kbd>Ctrl</kbd> +
   <kbd>B</kbd> → drag slightly → scroll up twice → type `0.008` →
   <kbd>Enter</kbd>.
7. <kbd>Tab</kbd> out. Right-click → **Shade Auto Smooth** at `30°`.

**Checkpoint 3**: red door (still cream-coloured for now) is sitting in
the front recess. View from the front (<kbd>Numpad 1</kbd>) and it should
fill the recess neatly with a small frame visible around it.

---

## Section 4 — Controller ports (the two black slots, 20 min)

The NES has two black D-shaped controller ports on the front-bottom edge.
For our purposes, simple rectangular cuboids read fine.

1. <kbd>Shift</kbd> + <kbd>A</kbd> → **Mesh** → **Cube**.
2. <kbd>N</kbd> → **Dimensions** = `0.32, 0.04, 0.10`.
3. **Location** = `-0.50, -0.98, 0.10`.
4. Apply transforms: <kbd>Ctrl</kbd> + <kbd>A</kbd> → **All Transforms**.
5. Rename `PortLeft`.
6. Bevel: <kbd>Tab</kbd> → <kbd>A</kbd> → <kbd>Ctrl</kbd> + <kbd>B</kbd>
   → `0.005` → <kbd>Enter</kbd> → <kbd>Tab</kbd>.
7. Duplicate for the right port:
   - With `PortLeft` selected, <kbd>Shift</kbd> + <kbd>D</kbd> → type
     `1` then <kbd>Tab</kbd> then `0` → <kbd>Enter</kbd> (moves it 1.0
     units along X).
   - Rename the duplicate `PortRight` in the Outliner.

**Checkpoint 4**: two small dark rectangles on the lower front face,
symmetric.

---

## Section 5 — Top buttons (POWER + RESET + LED, 25 min)

The top of the NES has two small grey rectangular buttons (POWER on the
left, RESET on the right) and a tiny red LED next to POWER.

1. **POWER** — <kbd>Shift</kbd> + <kbd>A</kbd> → **Mesh** → **Cube**:
   - Dimensions: `0.20, 0.10, 0.05`
   - Location: `-0.50, 0.30, 0.74`
   - Apply transforms; rename `Power`; bevel `0.005`.
2. **RESET** — duplicate Power (<kbd>Shift</kbd> + <kbd>D</kbd>):
   - Move to X `0.50`, leave Y/Z alone
   - Rename `Reset`.
3. **LED** — <kbd>Shift</kbd> + <kbd>A</kbd> → **Mesh** → **UV Sphere**:
   - In the bottom-left popup that appears, set **Segments** = `16`,
     **Rings** = `8`.
   - Dimensions: `0.06, 0.06, 0.06`
   - Location: `-0.30, 0.45, 0.72`
   - Apply transforms; rename `LED`; right-click → **Shade Smooth**.

**Checkpoint 5**: from <kbd>Numpad 7</kbd> (top view) you can see two
rectangular buttons and a tiny dot near POWER.

---

## Section 6 — Top vent (optional, 10 min)

The original NES has a slotted vent grille on top. Easiest version:

1. <kbd>Shift</kbd> + <kbd>A</kbd> → **Mesh** → **Cube**.
2. Dimensions: `0.04, 1.4, 0.04`. Location: `-0.6, -0.10, 0.74`.
3. Apply transforms. Rename `Vent01`.
4. With it selected, <kbd>Shift</kbd> + <kbd>D</kbd>, then <kbd>X</kbd>,
   then type `0.15` → <kbd>Enter</kbd> to duplicate 0.15 units to the
   right.
5. Repeat 8 more times (or use **Array modifier** → Count `9`, Relative
   Offset `0, 0, 0`, Constant Offset `0.15, 0, 0`).

Skip this if you're tight on time — POWER, RESET and the LED are enough
to "read" as the top of an NES.

---

## Section 7 — Materials (30 min)

Switch the right-side panel to **Material Properties** (the red sphere
icon).

For each piece below: select the object in the Outliner, click **+ New**
in Material Properties, then set the Surface values.

| Object         | Base Colour     | Roughness | Metallic |
|----------------|-----------------|-----------|----------|
| `Body`         | `#D6D2C2` (cream) | 0.55    | 0.0      |
| `Door`         | `#A61F24` (deep red) | 0.45 | 0.0     |
| `PortLeft` / `PortRight` | `#0E1014` (near-black) | 0.5 | 0.2 |
| `Power` / `Reset`  | `#7D8390` (medium grey) | 0.4 | 0.3 |
| `LED`          | `#FF3333` (bright red) | 0.2 | 0.0     |
| `Vent01`–`Vent09` | `#222222` (very dark grey) | 0.7 | 0.0 |

For the **LED** specifically, also set **Emission → Color** = `#FF3333`,
**Emission → Strength** = `4.0` so it glows in the final render and
catches the bloom pass.

> Tip: select all the vent strips, then in Material Properties, click the
> material dropdown and pick the existing dark-grey material so they share
> it.

**Checkpoint 7**: in viewport with **Material Preview** shading, the NES
should now look like an NES — cream body, big red door, dark ports,
glowing LED.

---

## Section 8 — UV unwrap (skip-able for first pass, 15 min)

Per-object colour materials don't actually need UV unwrapping. But the
glTF exporter is happier when meshes have UVs. Quick path:

1. Select all your meshes in the Outliner: click `Body`, then
   <kbd>Shift</kbd> + click each child until they're all highlighted.
2. <kbd>Tab</kbd> into Edit Mode (operates on all selected).
3. <kbd>A</kbd> to select everything.
4. <kbd>U</kbd> → **Smart UV Project** → defaults → OK.
5. <kbd>Tab</kbd> back out.

Done. (You can paint a proper texture atlas later if you want — for now
the per-mesh colours will do.)

---

## Section 9 — Export to glTF (10 min)

1. Click somewhere empty in the viewport to deselect.
2. In the Outliner, **select all the NES parts** but not the camera, the
   light or the reference images:
   - Click `Body`, then <kbd>Shift</kbd> + click `Door`, `PortLeft`,
     `PortRight`, `Power`, `Reset`, `LED`, and any `Vent` pieces.
3. **File → Export → glTF 2.0 (.glb/.gltf)**.
4. In the export panel on the right:
   - **Format**: `glTF Binary (.glb)`
   - **Include** → check **Selected Objects**
   - **Transform** → +Y Up ✓ (default)
   - **Geometry** → check **Apply Modifiers**, **UVs**, **Normals**
   - **Material** → Export Materials = `Export`
   - **Compression** → check **Draco mesh compression**, level `6`
5. Navigate to `~/Desktop/3DApp/assets/models/`.
6. Filename: `nes.glb` → **Export glTF 2.0**.

> If Blender complains "no selection" make sure you actually had your NES
> meshes selected (highlighted blue in the Outliner) before opening the
> export dialog.

**Checkpoint 9**: a `nes.glb` file (~50–500 KB) sits in `assets/models/`.

---

## Section 10 — See it in the app (5 min)

1. Make sure your dev server is running:
   ```bash
   cd ~/Desktop/3DApp && php -S localhost:8000
   ```
2. Open `http://localhost:8000/` in your browser (or Incognito to avoid
   cache).
3. Click **NES** in the gallery.

The app's `GLTFLoader` will pick up `assets/models/nes.glb` and use it
instead of the procedural placeholder. You'll see your real NES with the
fresnel rim, the bloom on the LED, the contact shadow, and all the
controls (wireframe, lighting, presets, swap-colour).

If the model is too big or too small, no worries — the auto-frame in
`view.js` (`Box3.setFromObject` → recentre) handles arbitrary sizes.

---

## Common pitfalls

| Symptom | Cause / Fix |
|---|---|
| Model export errors saying "no selection" | You opened export with nothing selected. Select all NES parts in the Outliner first. |
| Model appears tiny in the browser | Forgot to apply scale before exporting. In Object Mode: <kbd>Ctrl</kbd> + <kbd>A</kbd> → **All Transforms**, then re-export. |
| Body is shiny chrome in the browser | Roughness too low or Metallic > 0 on the body. Roughness 0.55, Metallic 0. |
| Sharp ugly corners after the bevel | You set bevel segments to 1. In Edit Mode, undo and re-bevel — *scroll up* during the bevel to add segments. |
| LED doesn't glow in the browser | Emission Strength is 0 or you only set Base Colour. Set both Color *and* Strength to a positive number. |
| Texture / Door wrong direction in the browser | Blender's −Y is the front (<kbd>Numpad 1</kbd> view). Three.js uses +Z forward. The glTF exporter handles this if "+Y Up" is checked, which it is by default. |

---

## When you're done with the NES

1. Save `nes.blend` one last time (<kbd>Ctrl</kbd> + <kbd>S</kbd>).
2. Take a screenshot of the model in the browser (with `nes.glb` loaded).
3. Move on to the SNES — same workflow, with **top-loading slot** instead
   of front door, **rounded corners** (heavier bevel — try `0.08`), and
   the iconic **purple POWER slider** + RESET + EJECT on top.
4. Then the N64 — the trickier one because of the trapezoidal silhouette
   (use the **Knife tool** <kbd>K</kbd> in Edit Mode to slice the corners
   off a cube), the recessed cartridge bay on top, and the **three
   curved-row controller ports** along the front face.

Both follow the same pattern: cube → dimensions → bevel → cut/inset for
slots and recesses → small parts (buttons, ports) → materials → UV →
export.

Pace yourself. One console per sitting is plenty.
