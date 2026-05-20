// =========================================================
// MVC — MODEL
// Owns the application state (model catalogue, current selection,
// view-mode flags) and talks to the PHP/SQLite REST API.
// Notifies subscribers on change so the View can re-render.
// =========================================================

const API_BASE = 'api/index.php';

const FALLBACK_CATALOGUE = [
  {
    id: 'nes',
    name: 'Nintendo Entertainment System',
    short: 'NES',
    year: 1983,
    color: '#d6d2c2',
    accent: '#8b1a1f',
    asset: 'assets/models/nes.glb?v=3',
    audio: 'assets/audio/nes-power.mp3',
    description:
      'The NES (Famicom outside Japan) revived the home console market after the 1983 crash. Its boxy, top-loading silhouette and red‑on‑grey livery defined a generation.',
    altTextures: ['#d6d2c2', '#222222', '#f4d35e']
  },
  {
    id: 'snes',
    name: 'Super Nintendo Entertainment System',
    short: 'SNES',
    year: 1990,
    color: '#cfcfd2',
    accent: '#5b3aa8',
    asset: 'assets/models/snes.glb?v=4',
    audio: 'assets/audio/snes-power.mp3',
    description:
      'The 16‑bit successor to the NES. The PAL/JP design used soft greys with four coloured face buttons — a palette that became iconic.',
    altTextures: ['#cfcfd2', '#3a3f55', '#a39bdc']
  },
  {
    id: 'n64',
    name: 'Nintendo 64',
    short: 'N64',
    year: 1996,
    color: '#2a2c30',
    accent: '#6cffb6',
    asset: 'assets/models/n64.glb?v=4',
    audio: 'assets/audio/n64-power.mp3',
    description:
      'Nintendo’s first 64‑bit console with a famously distinctive three‑pronged controller. Released in coloured translucent plastics including Atomic Purple and Jungle Green.',
    altTextures: ['#2a2c30', '#6c2a8c', '#1f6e3a']
  }
];

export class AppModel {
  constructor() {
    this.catalogue = [];
    this.currentId = null;
    this.viewMode = 'solid';        // 'solid' | 'wireframe'
    this.cameraMode = 'perspective'; // 'perspective' | 'orthographic'
    this.lights = { ambient: true, key: true, spot: false, spotColor: '#ff5577' };
    this.fx = { bloom: true, fresnel: true };
    this.textureIndex = 0;
    this._subs = new Set();
  }

  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
  notify(event, payload) { for (const fn of this._subs) fn(event, payload); }

  async loadCatalogue() {
    try {
      const res = await fetch(`${API_BASE}/models`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('empty catalogue');
      this.catalogue = data;
    } catch (err) {
      console.warn('[model] API unavailable, using fallback catalogue:', err.message);
      this.catalogue = FALLBACK_CATALOGUE;
    }
    this.notify('catalogue:loaded', this.catalogue);
    if (this.catalogue.length && !this.currentId) {
      this.select(this.catalogue[0].id);
    }
  }

  current() { return this.catalogue.find(m => m.id === this.currentId) ?? null; }

  select(id) {
    if (id === this.currentId) return;
    this.currentId = id;
    this.textureIndex = 0;
    this.notify('selection:changed', this.current());
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.notify('viewMode:changed', mode);
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    this.notify('cameraMode:changed', mode);
  }

  setLight(key, value) {
    this.lights[key] = value;
    this.notify('lights:changed', this.lights);
  }

  setFx(key, value) {
    this.fx[key] = value;
    this.notify('fx:changed', this.fx);
  }

  cycleTexture() {
    const m = this.current();
    if (!m) return;
    this.textureIndex = (this.textureIndex + 1) % m.altTextures.length;
    this.notify('texture:changed', { color: m.altTextures[this.textureIndex], index: this.textureIndex });
  }

  // --- Feedback (proves the API works end-to-end) -----------------
  async loadFeedback() {
    try {
      const res = await fetch(`${API_BASE}/feedback`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[model] feedback list unavailable:', err.message);
      return [];
    }
  }

  async submitFeedback({ name, message, rating }) {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message, rating })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }
}
