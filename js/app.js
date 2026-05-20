// =========================================================
// Boot — wires Model, View, Controller together.
// =========================================================

// ?v= bumps to bust ES-module cache after any edit
import { AppModel }      from './model.js?v=7';
import { AppView }       from './view.js?v=7';
import { AppController } from './controller.js?v=7';

(async function main() {
  const canvas = document.getElementById('rv-canvas');
  if (!canvas) { console.error('Missing #rv-canvas'); return; }

  const model = new AppModel();
  const view  = new AppView(canvas);
  const controller = new AppController(model, view);

  await view.init();
  controller.start();

  await model.loadCatalogue();

  // Initial feedback render
  view.renderFeedback(await model.loadFeedback());
})();
