# RetroVerse 3D — Interactive Retro Console Gallery

A 3D web application showcasing the NES, SNES and Nintendo 64 in an interactive
gallery built with **Three.js**, **Bootstrap 5**, **PHP / Slim** and **SQLite**.

This project is the L6 3D Application Development assignment (2026).

## Run locally

A static file server is fine for the front-end, but the API requires PHP:

```bash
# from project root
php -S localhost:8000
# then open http://localhost:8000/
```

For the API, install dependencies once:

```bash
cd api && composer install
```

## Project layout

```
3DApp/
├── index.html              Main 3D app
├── about.html              Production decisions, MVC, accessibility
├── statement.html          Statement of originality
├── sitemap.html            Site map
├── references.html         Citations
├── submission.html         ITS / GitHub URLs + deeper-understanding statement
├── css/styles.css
├── js/
│   ├── app.js              Boot
│   ├── model.js            MVC – data model (fetches /api/models)
│   ├── view.js             MVC – Three.js scene + DOM rendering
│   ├── controller.js       MVC – user input → model → view
│   └── shaders/            Custom GLSL (fresnel rim light)
├── assets/
│   ├── models/             *.glb (NES, SNES, N64)
│   ├── source/             *.blend source files (required for submission)
│   ├── textures/
│   ├── audio/
│   └── images/
├── api/
│   ├── index.php           Slim REST API
│   ├── composer.json
│   ├── .htaccess
│   └── data/               SQLite db (created on first request)
└── docs/
    ├── nes-step-by-step.md   Detailed Blender walkthrough for the NES
    ├── blender-guide.md      High-level modelling notes for all three consoles
    └── winscp-publishing.md  How to upload to the ITS server
```

## Rubric coverage

| Criterion | Where it lives |
|---|---|
| 3D Models (20) | `assets/models/*.glb`, `assets/source/*.blend` |
| App design / fluid grid (15) | `index.html`, `css/styles.css` (Bootstrap 5) |
| Media integration (10) | gallery, audio triggers, lighting buttons, wireframe / texture swap |
| Interaction (10) | OrbitControls, camera presets, click-to-animate |
| About + MVC (15) | `about.html`, `js/{model,view,controller}.js`, `api/` |
| Deeper understanding (20) | GLSL fresnel shader, post-processing (bloom + FXAA), Slim micro-framework, SQLite REST API, Bootstrap framework, complex N64 controller |
| Publication + testing (10) | `submission.html`, `about.html` testing section |
