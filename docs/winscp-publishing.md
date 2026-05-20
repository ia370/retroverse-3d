# Publishing to the university ITS web server with WinSCP

The rubric awards 10 points for publication, and the brief is explicit:

> **YOU ARE NOT ALLOWED TO SUBMIT YOUR 3D APP ON AN EXTERNAL ISP SITE.
> IF YOU SUBMIT ANYWHERE ELSE, OTHER THAN THE UNIVERSITY ITS WEB SERVER
> YOUR WORK WILL NOT BE MARKED**.

Do this in **week 11** so you have time to test and fix issues.

---

## 0 · What you need before you start

* Your **university username** (the one you log into the lab PCs with).
* Your **university password**.
* The **ITS web‑server hostname** — your module page or IT services portal
  will tell you (typically something like `students.yourdomain.ac.uk` or
  `webhost.yourdomain.ac.uk`). **Confirm this with your tutor before
  uploading.**
* The **upload path** on that server. Most ITS servers expose a folder named
  `public_html` or `www` inside your home directory.
* **WinSCP** installed: <https://winscp.net/eng/index.php>

> On macOS, **Cyberduck** or `sftp` from Terminal does the same job. The
> rest of this guide is WinSCP‑specific but the principles are identical.

## 1 · Configure the connection

1. Open WinSCP → **New Session**.
2. **File protocol** = `SFTP` (avoid FTP — it transmits credentials in
   the clear).
3. **Host name** = your ITS server (e.g. `webhost.yourdomain.ac.uk`).
4. **Port** = `22`.
5. **User name** = your university username.
6. **Password** = leave blank; you’ll be asked at connect time.
7. **Save** the session as `Uni — 3D App`.

## 2 · First connection

* Click **Login**. Accept the host key fingerprint **only** if it matches
  what your IT services portal documents.
* Once connected you’ll see two panes — local on the left, remote on the
  right.
* On the right, navigate to **`public_html/`** (or whatever your ITS path
  is). Create a sub‑folder `3dapp/`.

## 3 · Build the upload set

Upload **everything except** the local‑only bits. From the project root,
the files and folders you do want on the server are:

```
index.html
about.html
statement.html
sitemap.html
references.html
submission.html
css/
js/
assets/
api/
```

The files you do **NOT** upload:

* `.git/`             (version control history — huge and irrelevant)
* `node_modules/`     (none, but just in case)
* `.DS_Store`         (macOS junk)
* `*.blend1`, `*.blend2`  (Blender autosaves)
* `api/data/*.sqlite` (the server should create its own; if you upload
  yours it’ll contain your local feedback test rows)

In WinSCP you can right‑click → **Find Files** to exclude these, or just
drag the allowed folders one by one.

## 4 · Composer dependencies for the API

The `api/vendor/` folder is not in git. You need it on the server.

If the ITS server lets you SSH in:

```bash
cd ~/public_html/3dapp/api
composer install --no-dev --optimize-autoloader
```

If it doesn’t:

1. On your local machine run `cd api && composer install --no-dev` once.
2. **Then** upload the resulting `api/vendor/` folder via WinSCP.

## 5 · File permissions

After upload, in WinSCP right‑click each folder/file → **Properties**
and set:

| Path                | Permissions |
|---------------------|-------------|
| `3dapp/`            | `755`       |
| every other folder  | `755`       |
| every `.html`/`.css`/`.js`/`.glb`/`.php` | `644` |
| `api/data/`         | `775`  *(needs to be writable by PHP for SQLite)* |

## 6 · Test

Open `https://<your-its-hostname>/~<username>/3dapp/` (or whatever URL
pattern your university uses — your module page documents this).

Check:

| ✓ | Test |
|---|------|
| ☐ | The page loads — Bootstrap and Three.js fetch from the CDN. |
| ☐ | The gallery shows three consoles. |
| ☐ | Selecting a console loads a 3D model (placeholder or real `.glb`). |
| ☐ | Wireframe toggle works. |
| ☐ | Lighting switches work; spot colour picker updates the spot light. |
| ☐ | Camera presets reposition the camera. |
| ☐ | The "Play animation" button rotates / bounces the model. |
| ☐ | The Fresnel toggle changes the look of the model. |
| ☐ | Bloom toggle dims the highlight glow. |
| ☐ | The feedback form `POST`s and the new entry appears in the list  
       (proves the SQLite API is alive on the server). |
| ☐ | All five sub‑pages (About, Originality, References, Site Map,
       Submission) render correctly. |
| ☐ | The site looks correct at 360 px wide, 768 px, 1280 px and 1920 px. |
| ☐ | Keyboard‑only navigation reaches every interactive element. |

## 7 · After testing — update the Submission page

Edit `submission.html` and replace each `[YOUR ... URL HERE]` placeholder
with the real URLs:

* **ITS Web Server URL** — section 2
* **GitHub Codebase URL** — section 3
* **GitHub Models URL** — section 4 (a separate repo containing the
  `.blend` source files and `.glb` exports)

Re‑upload `submission.html`.

## 8 · Submit on Canvas

Either:

* Zip the **complete** project folder (including `assets/source/*.blend`)
  and upload to Canvas, **or**
* Upload `submission.html` to Canvas as the entry point — Canvas will
  follow the links inside it.

You're done.

---

## Troubleshooting

| Problem | Cause / Fix |
|---|---|
| `403 Forbidden` on any page | Folder permission too tight — set the folder to `755`. |
| `500 Internal Server Error` on `/api/...` | Usually a missing `vendor/` folder, or `data/` not writable. Re‑run `composer install` and `chmod 775 api/data`. |
| `.htaccess` not honoured (the API only works via `/api/index.php/models`) | The ITS Apache may not allow `AllowOverride All`. That’s fine — the front‑end already addresses `api/index.php/models`, so it works either way. |
| Mixed‑content warning | If the page loads over `https://`, make sure none of your asset URLs are hard‑coded with `http://`. |
| CORS error in console | Same‑origin in production should be fine. If you ever serve the API from a different host, the API already sets `Access-Control-Allow-Origin: *`. |
