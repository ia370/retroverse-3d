// =========================================================
// MVC — CONTROLLER
// Wires DOM events to model mutations, and model events
// to view updates. No rendering here, no app state here.
// =========================================================

export class AppController {
  constructor(model, view) {
    this.model = model;
    this.view  = view;
  }

  start() {
    this._wireModelToView();
    this._wireDomToModel();
  }

  _wireModelToView() {
    this.model.subscribe(async (event, payload) => {
      switch (event) {
        case 'catalogue:loaded':
          this.view.renderGallery(this.model.catalogue, this.model.currentId, id => this.model.select(id));
          break;
        case 'selection:changed':
          this.view.setActiveGalleryItem(payload.id);
          this.view.renderInfoPanel(payload);
          await this.view.loadModel(payload);
          // re-apply current display flags to the freshly loaded model
          this.view.setViewMode(this.model.viewMode);
          this.view.setLights(this.model.lights);
          this.view.setFx(this.model.fx);
          break;
        case 'viewMode:changed':   this.view.setViewMode(payload); break;
        case 'cameraMode:changed': this.view.setCameraMode(payload); break;
        case 'lights:changed':     this.view.setLights(payload); break;
        case 'fx:changed':         this.view.setFx(payload); break;
        case 'texture:changed':    this.view.applyTextureColor(payload.color); break;
      }
    });
  }

  _wireDomToModel() {
    // View mode -----------------------------------------------------
    const solid = document.getElementById('btn-solid');
    const wire  = document.getElementById('btn-wireframe');
    solid.addEventListener('click', () => { this._toggleActive(solid, wire); this.model.setViewMode('solid'); });
    wire .addEventListener('click', () => { this._toggleActive(wire, solid); this.model.setViewMode('wireframe'); });

    // Camera mode ---------------------------------------------------
    const persp = document.getElementById('btn-cam-persp');
    const ortho = document.getElementById('btn-cam-ortho');
    persp.addEventListener('click', () => { this._toggleActive(persp, ortho); this.model.setCameraMode('perspective'); });
    ortho.addEventListener('click', () => { this._toggleActive(ortho, persp); this.model.setCameraMode('orthographic'); });

    // Camera presets ------------------------------------------------
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.view.setPreset(btn.dataset.preset);
      });
    });

    // Lighting ------------------------------------------------------
    document.getElementById('light-ambient').addEventListener('change', e => this.model.setLight('ambient', e.target.checked));
    document.getElementById('light-key')    .addEventListener('change', e => this.model.setLight('key',     e.target.checked));
    document.getElementById('light-spot')   .addEventListener('change', e => this.model.setLight('spot',    e.target.checked));
    document.getElementById('light-color')  .addEventListener('input',  e => this.model.setLight('spotColor', e.target.value));

    // FX ------------------------------------------------------------
    document.getElementById('fx-bloom')  .addEventListener('change', e => this.model.setFx('bloom',   e.target.checked));
    document.getElementById('fx-fresnel').addEventListener('change', e => this.model.setFx('fresnel', e.target.checked));

    // Actions -------------------------------------------------------
    document.getElementById('btn-animate') .addEventListener('click', () => this.view.playAnimation());
    document.getElementById('btn-sound')   .addEventListener('click', () => this.view.playSound());
    document.getElementById('btn-swap-tex').addEventListener('click', () => this.model.cycleTexture());

    // Feedback form -------------------------------------------------
    const form = document.getElementById('feedback-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name    = document.getElementById('fb-name').value.trim();
        const message = document.getElementById('fb-msg').value.trim();
        const rating  = Number(document.getElementById('fb-rating').value);
        if (!name || !message) return;
        try {
          await this.model.submitFeedback({ name, message, rating });
          form.reset();
          document.getElementById('fb-rating').value = 5;
          const items = await this.model.loadFeedback();
          this.view.renderFeedback(items);
        } catch (err) {
          alert('Could not submit feedback (is the API running?). See console.');
          console.warn(err);
        }
      });
    }
  }

  _toggleActive(on, off) {
    on.classList.add('active');
    off.classList.remove('active');
  }
}
