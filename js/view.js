// =========================================================
// MVC — VIEW
// Owns the Three.js scene, the renderer, the post-processing
// composer, and all DOM read/write that depends on app state.
// Pure presentation: it never decides anything; the controller
// pushes state changes in via the public methods.
// =========================================================

import * as THREE from 'three';
import { OrbitControls }      from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }         from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }        from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment }    from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer }     from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }         from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }    from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }         from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader }         from 'three/addons/shaders/FXAAShader.js';
import { OutputPass }         from 'three/addons/postprocessing/OutputPass.js';

// The standalone fresnel shaders (js/shaders/fresnel.vert and .frag) document
// the GLSL technique. At runtime we *inject* an equivalent rim contribution
// into MeshStandardMaterial via onBeforeCompile (see _setRimOnMaterial below)
// so we keep PBR shading and add the rim glow on top — much higher quality
// than swapping the whole material for a flat custom shader.

const IDLE_BEFORE_AUTOROTATE_MS = 3000;

export class AppView {
  constructor(canvas) {
    this.canvas = canvas;
    this.modelRoot = null;
    this.modelMixer = null;
    this.audio = null;
    this.clock = new THREE.Clock();
    this._lastFps = performance.now();
    this._frames = 0;
    this._lastInteraction = performance.now();
    this._suspendAutoRotate = false;   // true while a manual animation is running
    this._currentMeta = null;          // current model meta (rim colour, audio fallback)
    this._fxState = { bloom: true, fresnel: true };  // remembered between model swaps
  }

  // ------------------------------------------------------ INIT
  async init() {
    // Renderer ----------------------------------------------------
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: true   // alpha=true so CSS grid bleeds through
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene -------------------------------------------------------
    this.scene = new THREE.Scene();

    // Image-based lighting via RoomEnvironment (no asset needed) -
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // Cameras (perspective + orthographic) -----------------------
    const { width, height } = this._size();
    this.cameraPersp = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.cameraPersp.position.set(3.4, 2.4, 4.8);

    const aspect = width / height, frustum = 3.5;
    this.cameraOrtho = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect, frustum, -frustum, 0.1, 100
    );
    this.cameraOrtho.position.copy(this.cameraPersp.position);
    this.camera = this.cameraPersp;

    // Lights ------------------------------------------------------
    // Lower-intensity lighting so light-coloured plastic (the cream NES, the
    // grey SNES) doesn't push past bloom threshold. Env map provides most of
    // the soft fill; the directionals just give shape definition.
    this.lightAmbient = new THREE.AmbientLight(0xffffff, 0.18);
    this.lightKey     = new THREE.DirectionalLight(0xffffff, 0.85);
    this.lightKey.position.set(4, 6, 5);
    this.lightKey.castShadow = true;
    this.lightKey.shadow.mapSize.set(1024, 1024);
    this.lightKey.shadow.camera.near = 0.5;
    this.lightKey.shadow.camera.far = 20;
    this.lightKey.shadow.bias = -0.0005;

    // Cool-toned fill from the opposite side so the shadow side never goes black.
    this.lightFill = new THREE.DirectionalLight(0x88a4ff, 0.30);
    this.lightFill.position.set(-4, 3, -3);

    this.lightSpot = new THREE.SpotLight(0xff5577, 0, 22, Math.PI / 6, 0.4, 1.2);
    this.lightSpot.position.set(-4, 5, 2);
    this.lightSpot.target.position.set(0, 0.5, 0);

    this.scene.add(this.lightAmbient, this.lightKey, this.lightFill, this.lightSpot, this.lightSpot.target);

    // Soft contact shadow on a transparent ground plane ----------
    // (Faked with a tinted radial-gradient sprite so it works regardless
    //  of whether a real glTF mesh writes to the depth buffer.)
    const shadowTex = makeRadialShadowTexture();
    this.contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({
        map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55, color: 0x000000
      })
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = -0.001;
    this.scene.add(this.contactShadow);

    // Controls ---------------------------------------------------
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.6, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 12;
    this.controls.maxPolarAngle = Math.PI * 0.55; // don't let user dip below floor
    this.controls.addEventListener('start', () => { this._lastInteraction = performance.now(); });
    this.controls.addEventListener('change', () => { this._lastInteraction = performance.now(); });

    // Loaders ----------------------------------------------------
    // Blender exports use KHR_draco_mesh_compression (see docs/blender-guide.md §8),
    // so GLTFLoader needs a DRACOLoader attached or every .glb load throws and we
    // silently fall back to the placeholder geometry. The decoder is pulled from
    // the same three@0.160.0 build as the loader so versions can't drift.
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
    this.dracoLoader.setDecoderConfig({ type: 'js' });   // 'js' decoder works without COOP/COEP headers; swap to 'wasm' if you serve them
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    // Post-processing composer -----------------------------------
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // strength=0.45, radius=0.7, threshold=1.05 — only HDR pixels brighter than
    // 1.0 bloom (i.e. emissive LEDs). Cream/grey plastic stays plastic.
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.45, 0.7, 1.05);
    this.composer.addPass(this.bloomPass);
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaaPass);
    this.composer.addPass(new OutputPass());

    // Resize + start animation loop ------------------------------
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.renderer.setAnimationLoop(() => this._tick());
  }

  // ------------------------------------------------------ HELPERS
  _size() {
    const r = this.canvas.getBoundingClientRect();
    return { width: Math.max(2, Math.floor(r.width)), height: Math.max(2, Math.floor(r.height)) };
  }

  _resize() {
    const { width, height } = this._size();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.cameraPersp.aspect = width / height;
    this.cameraPersp.updateProjectionMatrix();
    const aspect = width / height, frustum = 3.5;
    this.cameraOrtho.left   = -frustum * aspect;
    this.cameraOrtho.right  =  frustum * aspect;
    this.cameraOrtho.top    =  frustum;
    this.cameraOrtho.bottom = -frustum;
    this.cameraOrtho.updateProjectionMatrix();
    this.fxaaPass.material.uniforms['resolution'].value.set(1 / width, 1 / height);
  }

  _tick() {
    const dt = this.clock.getDelta();
    if (this.modelMixer) this.modelMixer.update(dt);

    // Idle auto-rotate (gives the page life when nobody is dragging)
    const idleFor = performance.now() - this._lastInteraction;
    if (this.modelRoot && !this._suspendAutoRotate && idleFor > IDLE_BEFORE_AUTOROTATE_MS) {
      this.modelRoot.rotation.y += dt * 0.25;
    }

    this.controls.update();
    this.composer.render();

    // FPS read-out
    this._frames++;
    const now = performance.now();
    if (now - this._lastFps > 500) {
      const fps = (this._frames / ((now - this._lastFps) / 1000)).toFixed(0);
      const el = document.getElementById('rv-fps');
      if (el) el.textContent = `${fps} fps`;
      this._frames = 0; this._lastFps = now;
    }
  }

  // ------------------------------------------------------ GALLERY DOM
  renderGallery(catalogue, currentId, onPick) {
    const ul = document.getElementById('gallery-list');
    if (!ul) return;
    ul.innerHTML = '';
    catalogue.forEach(m => {
      const li = document.createElement('li');
      li.tabIndex = 0;
      li.role = 'option';
      li.dataset.id = m.id;
      if (m.id === currentId) li.classList.add('active');
      li.innerHTML = `
        <span class="swatch" style="background: linear-gradient(135deg, ${m.color}, ${m.accent});"></span>
        <span class="name">${m.short}</span>
        <span class="year">${m.year}</span>
      `;
      const trigger = () => onPick(m.id);
      li.addEventListener('click', trigger);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); } });
      ul.appendChild(li);
    });
  }

  setActiveGalleryItem(id) {
    document.querySelectorAll('#gallery-list li').forEach(li => {
      li.classList.toggle('active', li.dataset.id === id);
    });
  }

  renderInfoPanel(m) {
    document.getElementById('model-title').textContent       = m?.name ?? '—';
    document.getElementById('model-year').textContent        = m ? `Released ${m.year}` : '—';
    document.getElementById('model-description').textContent = m?.description ?? '';
    // HUD on the stage
    const hudName = document.getElementById('hud-name');
    const hudYear = document.getElementById('hud-year');
    if (hudName) hudName.textContent = m?.short ?? '—';
    if (hudYear) hudYear.textContent = m ? `· ${m.year}` : '';
  }

  // ------------------------------------------------------ SCENE OPS
  setLoading(on, progress = null) {
    const el   = document.getElementById('rv-loading');
    const fill = document.getElementById('rv-loading-fill');
    if (el)   el.hidden = !on;
    if (fill && progress != null) fill.style.width = `${Math.round(progress * 100)}%`;
  }

  async loadModel(meta) {
    this.setLoading(true, 0.05);
    this._disposeModel();

    let inner;
    try {
      const gltf = await this.gltfLoader.loadAsync(meta.asset, ev => {
        if (ev.lengthComputable) this.setLoading(true, 0.05 + 0.9 * (ev.loaded / ev.total));
      });
      inner = gltf.scene;
      if (gltf.animations?.length) {
        this.modelMixer = new THREE.AnimationMixer(inner);
        gltf.animations.forEach(c => this.modelMixer.clipAction(c).play());
      }
    } catch (err) {
      console.warn(`[view] glb missing for ${meta.id}, using placeholder geometry`, err);
      inner = this._buildPlaceholder(meta);
      // Indeterminate progress for placeholders
      this.setLoading(true, 0.6);
    }

    // Auto-fit: scale the inner geometry so every model occupies a similar
    // on-screen footprint regardless of how it was exported from Blender
    // (NES exported at 0.25m vs SNES exported at 2.0m would otherwise look
    // wildly different sizes). We target a bounding-sphere radius the camera
    // is set up to frame nicely. Then we shift the model so it sits on Y=0.
    const TARGET_RADIUS = 1.25;
    const box = new THREE.Box3().setFromObject(inner);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (sphere.radius > 1e-4) {
      inner.scale.multiplyScalar(TARGET_RADIUS / sphere.radius);
    }
    const box2 = new THREE.Box3().setFromObject(inner);
    const c2 = box2.getCenter(new THREE.Vector3());
    inner.position.x -= c2.x;
    inner.position.z -= c2.z;
    inner.position.y -= box2.min.y;          // rest on the floor (Y=0)

    inner.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // Wrap in a group so the fade-in / play-animation transforms don't fight
    // the per-model auto-fit scale we just applied.
    const wrapper = new THREE.Group();
    wrapper.add(inner);
    this.modelRoot = wrapper;
    this.scene.add(wrapper);

    // Audio (optional). Remember meta so synth fallback can pick a tone.
    this._currentMeta = meta;
    this._loadAudio(meta.audio);

    // Smooth scale-in (on the wrapper, not the inner model)
    this._fadeIn(wrapper, 320);

    this.setLoading(true, 1);
    setTimeout(() => this.setLoading(false), 200);
    this._lastInteraction = performance.now();
    return root;
  }

  _fadeIn(obj, ms) {
    const start = performance.now();
    const startScale = 0.86;
    obj.scale.setScalar(startScale);
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      obj.scale.setScalar(startScale + (1 - startScale) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    step();
  }

  _loadAudio(url) {
    // Audio file is optional. We probe it; if it 404s or errors, we fall back
    // to a synthesised power-on chime via Web Audio API so the button always
    // produces a response.
    if (this.audio) { try { this.audio.pause(); } catch {} this.audio = null; }
    if (!url) return;
    const a = new Audio(url);
    a.preload = 'auto';
    a.addEventListener('error', () => { this.audio = null; }, { once: true });
    a.addEventListener('canplaythrough', () => { this.audio = a; }, { once: true });
  }

  playSound() {
    if (this.audio && this.audio.readyState >= 2) {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => this._synthChime());
    } else {
      this._synthChime();
    }
  }

  // Web Audio API fallback — a short rising-then-falling power-on chime.
  // Tone tuned per console: NES = warm triad, SNES = brighter, N64 = deeper.
  _synthChime() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this._actx) this._actx = new Ctx();
    const ctx = this._actx;
    if (ctx.state === 'suspended') ctx.resume();

    const id = this._currentMeta?.id ?? 'nes';
    const tones =
      id === 'snes' ? [523.25, 659.25, 783.99]   // C5, E5, G5
    : id === 'n64'  ? [196.00, 261.63, 329.63]   // G3, C4, E4
                    : [392.00, 493.88, 587.33];  // G4, B4, D5  (NES)

    const now = ctx.currentTime;
    tones.forEach((freq, i) => {
      const t0 = now + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.6);
    });
  }

  playAnimation() {
    // glTF mixer (if any) is already running. The button drives an extra
    // attention-grabbing pulse so the user gets clear feedback even when
    // the model has no embedded animation.
    if (!this.modelRoot) return;
    const root = this.modelRoot;
    const start = performance.now();
    const baseY = root.position.y;
    const baseR = root.rotation.y;
    const baseS = root.scale.x;
    const dur = 1100;

    this._suspendAutoRotate = true;          // don't fight the manual animation
    this._lastInteraction = performance.now();

    const step = () => {
      const t = Math.min(1, (performance.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 2.2);                 // ease-out
      root.rotation.y = baseR + Math.PI * 2 * eased;
      root.position.y = baseY + Math.sin(t * Math.PI) * 0.35; // bounce
      // brief 6% scale pulse peaking mid-animation
      const pulse = 1 + 0.06 * Math.sin(t * Math.PI);
      root.scale.setScalar(baseS * pulse);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        root.position.y = baseY;
        root.rotation.y = baseR + Math.PI * 2;
        root.scale.setScalar(baseS);
        this._suspendAutoRotate = false;
        this._lastInteraction = performance.now();
      }
    };
    step();
  }

  setViewMode(mode) {
    if (!this.modelRoot) return;
    const wire = mode === 'wireframe';
    this.modelRoot.traverse(o => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(mat => { if ('wireframe' in mat) mat.wireframe = wire; });
      }
    });
  }

  setCameraMode(mode) {
    const next = mode === 'orthographic' ? this.cameraOrtho : this.cameraPersp;
    next.position.copy(this.camera.position);
    this.camera = next;
    this.controls.object = this.camera;
    this.controls.update();
    this.composer.passes[0].camera = this.camera;
  }

  setPreset(name) {
    const target = new THREE.Vector3(0, 0.6, 0);
    let pos;
    switch (name) {
      case 'front': pos = new THREE.Vector3(0, 1.0, 5.0); break;
      case 'top':   pos = new THREE.Vector3(0, 6.0, 0.01); break;
      case 'iso':
      default:      pos = new THREE.Vector3(3.4, 2.4, 4.8); break;
    }
    this.camera.position.copy(pos);
    this.controls.target.copy(target);
    this.controls.update();
    this._lastInteraction = performance.now();
  }

  setLights({ ambient, key, spot, spotColor }) {
    this.lightAmbient.intensity = ambient ? 0.25 : 0;
    this.lightKey.intensity     = key ? 1.4 : 0;
    this.lightSpot.intensity    = spot ? 22 : 0;
    if (spotColor) this.lightSpot.color.set(spotColor);
  }

  setFx({ bloom, fresnel }) {
    if (this.bloomPass) this.bloomPass.enabled = !!bloom;
    if (!this.modelRoot) return;
    // Per-model rim colour: pick the active console's accent so the rim
    // characterises each model rather than being a generic blue.
    const rimHex = this._currentMeta?.accent ?? '#9ad8ff';
    this.modelRoot.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => this._setRimOnMaterial(m, fresnel, rimHex));
    });
  }

  // Inject the GLSL fresnel rim into a MeshStandardMaterial via onBeforeCompile.
  // Crucially this PRESERVES PBR shading (lighting, reflections, env map) and
  // simply ADDS the rim contribution — much higher quality than a full shader
  // swap, and showcases customisation of three.js's built-in shaders.
  _setRimOnMaterial(material, enabled, rimHex) {
    if (!material) return;
    if (enabled) {
      const rimColor = new THREE.Color(rimHex);
      // Keep the per-material uniform refs so we can tune at runtime.
      const u = material.userData._rimUniforms ?? {
        uRimColor:    { value: rimColor },
        uRimPower:    { value: 2.6 },
        uRimStrength: { value: 0.55 },
        uRimEnabled:  { value: 1.0 }
      };
      u.uRimColor.value.set(rimHex);
      u.uRimEnabled.value = 1.0;
      material.userData._rimUniforms = u;

      if (!material.userData._rimInstalled) {
        material.userData._rimInstalled = true;
        const prev = material.onBeforeCompile;
        material.onBeforeCompile = (shader) => {
          if (typeof prev === 'function') prev(shader);
          shader.uniforms.uRimColor    = u.uRimColor;
          shader.uniforms.uRimPower    = u.uRimPower;
          shader.uniforms.uRimStrength = u.uRimStrength;
          shader.uniforms.uRimEnabled  = u.uRimEnabled;

          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `
              #include <common>
              varying vec3 vRimNormalW;
              varying vec3 vRimViewDirW;
            `)
            .replace('#include <project_vertex>', `
              vec4 _rimWorldPos = modelMatrix * vec4(transformed, 1.0);
              vRimNormalW  = normalize(mat3(modelMatrix) * objectNormal);
              vRimViewDirW = normalize(cameraPosition - _rimWorldPos.xyz);
              #include <project_vertex>
            `);

          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `
              #include <common>
              uniform vec3  uRimColor;
              uniform float uRimPower;
              uniform float uRimStrength;
              uniform float uRimEnabled;
              varying vec3  vRimNormalW;
              varying vec3  vRimViewDirW;
            `)
            .replace('#include <dithering_fragment>', `
              #include <dithering_fragment>
              float _rim = pow(1.0 - max(dot(normalize(vRimNormalW), normalize(vRimViewDirW)), 0.0), uRimPower);
              gl_FragColor.rgb += uRimColor * _rim * uRimStrength * uRimEnabled;
            `);
        };
        material.needsUpdate = true;
      }
    } else if (material.userData?._rimUniforms) {
      // Toggle off without recompiling — flip the runtime uniform.
      material.userData._rimUniforms.uRimEnabled.value = 0.0;
    }
  }

  applyTextureColor(hex) {
    if (!this.modelRoot) return;
    let touched = 0;
    this.modelRoot.traverse(o => {
      if (!o.isMesh || o.userData._tintable !== true) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => { if (m && m.color) m.color.set(hex); });
      touched++;
    });
    // Real glTF models won't have _tintable tagged. Fall back to tinting every
    // non-emissive mesh so glTF models still respond to the button.
    if (touched === 0) {
      this.modelRoot.traverse(o => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if (!m || !m.color) return;
          const isEmissive = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05;
          if (!isEmissive) m.color.set(hex);
        });
      });
    }
  }

  // ------------------------------------------------------ PLACEHOLDERS
  // Procedural stand-ins until proper .glb files exist in assets/models/.
  // Each console gets recognisable silhouette + slot + buttons + ports + LED.
  _buildPlaceholder(meta) {
    const group = new THREE.Group();
    const matBody = new THREE.MeshStandardMaterial({
      color: new THREE.Color(meta.color), roughness: 0.6, metalness: 0.04, envMapIntensity: 0.55
    });
    const matAccent = new THREE.MeshStandardMaterial({
      color: new THREE.Color(meta.accent), roughness: 0.45, metalness: 0.08, envMapIntensity: 0.6
    });
    const matDark   = new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.5,  metalness: 0.2,  envMapIntensity: 0.5 });
    const matBtn    = new THREE.MeshStandardMaterial({ color: 0x7d8390, roughness: 0.4,  metalness: 0.25, envMapIntensity: 0.6 });
    const ledMat    = (hex) => new THREE.MeshStandardMaterial({
      color: hex, emissive: hex, emissiveIntensity: 4.0, roughness: 0.2
    });

    if (meta.id === 'nes') {
      // ---- NES — front-loading "toaster" ----
      const W = 2.4, D = 1.8, H = 0.55;

      const body = new THREE.Mesh(roundedBox(W, H, D, 0.05), matBody);
      body.userData._tintable = true;
      body.position.y = H / 2;
      group.add(body);

      // Recessed front panel where the cartridge door sits (slightly inset)
      const recess = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.78, H * 0.62, 0.025),
        new THREE.MeshStandardMaterial({ color: 0x807a6c, roughness: 0.6, metalness: 0.05 })
      );
      recess.position.set(0, H * 0.65, D / 2 - 0.012);
      group.add(recess);

      // Big red cartridge door (the unmistakable NES detail)
      const door = new THREE.Mesh(
        roundedBox(W * 0.72, H * 0.45, 0.05, 0.015),
        new THREE.MeshStandardMaterial({ color: 0xa61f24, roughness: 0.4, metalness: 0.05 })
      );
      door.position.set(0, H * 0.62, D / 2 + 0.005);
      group.add(door);

      // Two controller ports on the front lower band
      for (let i = 0; i < 2; i++) {
        const port = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.10, 0.04), matDark);
        port.position.set(-0.45 + i * 0.9, H * 0.18, D / 2 + 0.005);
        group.add(port);
      }

      // Top: Power button (left), Reset button (right), LED (front-left)
      const power = new THREE.Mesh(roundedBox(0.18, 0.05, 0.10, 0.012), matBtn);
      power.position.set(-0.55, H + 0.025, 0.55);
      const reset = new THREE.Mesh(roundedBox(0.16, 0.05, 0.09, 0.012), matBtn);
      reset.position.set( 0.55, H + 0.025, 0.55);
      const led = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 24), ledMat(0xff3333));
      led.position.set(-0.30, H + 0.008, 0.6);
      group.add(power, reset, led);

    } else if (meta.id === 'snes') {
      // ---- SNES (PAL/JP) — rounded grey body with clear top cartridge slot ----
      const W = 2.2, D = 1.7, H = 0.46;

      const body = new THREE.Mesh(roundedBox(W, H, D, 0.12), matBody);
      body.userData._tintable = true;
      body.position.y = H / 2;
      group.add(body);

      // ----- Cartridge slot (very visible from any angle) -------------
      // Construction:
      //   • A short raised lip (slightly darker than body) acts as a frame.
      //   • A TALLER dark opening sits inside, with its top higher than the
      //     lip, so it reads as the slot opening from above.
      const slotCenter = -0.28;     // Z position (back half of body)
      const lipMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(meta.color).clone().multiplyScalar(0.72),
        roughness: 0.55, metalness: 0.05, envMapIntensity: 0.5
      });
      const lip = new THREE.Mesh(roundedBox(1.68, 0.05, 0.66, 0.025), lipMat);
      lip.position.set(0, H + 0.025, slotCenter);
      group.add(lip);

      const slotOpening = new THREE.Mesh(
        new THREE.BoxGeometry(1.52, 0.10, 0.50),
        new THREE.MeshStandardMaterial({ color: 0x06080c, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.3 })
      );
      slotOpening.position.set(0, H + 0.05, slotCenter);
      group.add(slotOpening);

      // ----- Top control panel (front half) ---------------------------
      // POWER slider — the iconic purple/grey rectangle on the left.
      const power = new THREE.Mesh(roundedBox(0.50, 0.08, 0.16, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x6a4f8a, roughness: 0.4, metalness: 0.15, envMapIntensity: 0.6 }));
      power.position.set(-0.62, H + 0.04, 0.48);
      group.add(power);

      // RESET button — round, centre.
      const reset = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 32),
        new THREE.MeshStandardMaterial({ color: 0xb83a3a, roughness: 0.4, metalness: 0.1 }));
      reset.position.set(0.10, H + 0.025, 0.50);
      group.add(reset);

      // EJECT button — rectangular, right.
      const eject = new THREE.Mesh(roundedBox(0.22, 0.07, 0.13, 0.018), matBtn);
      eject.position.set(0.62, H + 0.035, 0.48);
      group.add(eject);

      // Power LED (green) — small but bright; bloom highlights it.
      const led = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 24), ledMat(0x46ff66));
      led.position.set(-0.30, H + 0.008, 0.56);
      group.add(led);

      // ----- Front controller ports (two on PAL/JP) -------------------
      for (let i = 0; i < 2; i++) {
        const portFrame = new THREE.Mesh(roundedBox(0.30, 0.16, 0.04, 0.015), lipMat);
        portFrame.position.set(-0.32 + i * 0.64, H * 0.42, D / 2 + 0.005);
        const portInner = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.025), matDark);
        portInner.position.set(-0.32 + i * 0.64, H * 0.42, D / 2 + 0.022);
        group.add(portFrame, portInner);
      }

    } else {
      // ---- N64 — trapezoidal body + iconic three controller ports ----
      const D = 1.7;
      const trap = new THREE.Shape();
      trap.moveTo(-0.95, 0);
      trap.lineTo( 0.95, 0);
      trap.lineTo( 0.78, 0.78);
      trap.lineTo(-0.78, 0.78);
      trap.closePath();
      const bodyGeo = new THREE.ExtrudeGeometry(trap, {
        depth: D, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4, curveSegments: 6
      });
      // Center on Z so depth spans -D/2 .. +D/2 (front/back). Width on X,
      // height on Y already from the 2D shape.
      bodyGeo.translate(0, 0, -D / 2);
      const body = new THREE.Mesh(bodyGeo, matBody);
      body.userData._tintable = true;
      group.add(body);

      // Recessed cartridge bay on top (back half)
      const bay = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.6), matDark);
      bay.position.set(0, 0.79, -0.30);
      group.add(bay);
      // Bay lip (raised frame)
      const bayLip = new THREE.Mesh(roundedBox(1.30, 0.06, 0.70, 0.02), matBody);
      bayLip.position.set(0, 0.785, -0.30);
      group.add(bayLip);

      // Top accent strip across the front edge (mint by default — matches accent)
      const strip = new THREE.Mesh(roundedBox(1.4, 0.02, 0.05, 0.005), matAccent);
      strip.position.set(0, 0.79, 0.18);
      group.add(strip);

      // Power button (red rectangular) and Reset button (round) on top-front
      const power = new THREE.Mesh(roundedBox(0.22, 0.04, 0.08, 0.012),
        new THREE.MeshStandardMaterial({ color: 0xc83030, roughness: 0.4, metalness: 0.1 }));
      power.position.set(-0.55, 0.81, 0.32);
      const reset = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 24), matBtn);
      reset.position.set(-0.25, 0.80, 0.32);
      const led = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 24), ledMat(0xff5040));
      led.position.set( 0.55, 0.795, 0.34);
      group.add(power, reset, led);

      // Three controller ports along the curved front face — the famous N64 detail.
      // Each is a small extruded "bay" + a dark port socket inside.
      for (let i = -1; i <= 1; i++) {
        const bayShell = new THREE.Mesh(roundedBox(0.36, 0.18, 0.10, 0.04), matBody);
        bayShell.position.set(i * 0.46, 0.16, 0.92);
        bayShell.userData._tintable = true;
        const socket = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.10, 0.04), matDark);
        socket.position.set(i * 0.46, 0.16, 0.96);
        group.add(bayShell, socket);
      }
    }
    return group;
  }

  _disposeModel() {
    if (!this.modelRoot) return;
    this.scene.remove(this.modelRoot);
    this.modelRoot.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m?.dispose?.());
      }
    });
    this.modelRoot = null;
    this.modelMixer = null;
  }

  // ------------------------------------------------------ FEEDBACK DOM
  renderFeedback(items) {
    const ul = document.getElementById('fb-list');
    if (!ul) return;
    ul.innerHTML = '';
    if (!items.length) {
      ul.innerHTML = '<li class="meta">No feedback yet — be the first.</li>';
      return;
    }
    for (const it of items) {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${escapeHtml(it.name)}</strong> <span class="meta">· ${it.rating}/5 · ${escapeHtml(it.created_at ?? '')}</span>
        <div>${escapeHtml(it.message)}</div>
      `;
      ul.appendChild(li);
    }
  }
}

// ---------- Free-standing helpers ----------------------------

// A simple rounded box via ExtrudeGeometry — sharper than BoxGeometry without
// requiring a third-party rounded-box helper.
function roundedBox(w, h, d, r = 0.05, smoothness = 4) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  shape.moveTo(x, y + r);
  shape.lineTo(x, y + d - r);
  shape.quadraticCurveTo(x, y + d, x + r, y + d);
  shape.lineTo(x + w - r, y + d);
  shape.quadraticCurveTo(x + w, y + d, x + w, y + d - r);
  shape.lineTo(x + w, y + r);
  shape.quadraticCurveTo(x + w, y, x + w - r, y);
  shape.lineTo(x + r, y);
  shape.quadraticCurveTo(x, y, x, y + r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h, bevelEnabled: true, bevelThickness: r * 0.6, bevelSize: r * 0.6, bevelSegments: smoothness, curveSegments: smoothness * 2
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, h / 2, 0);
  return geo;
}

// 256x256 radial-gradient texture for the soft contact shadow.
function makeRadialShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
