import { setupLearning } from './playground/learning.js';
import { setupProof } from './playground/proof.js';
import { setupPlayground } from './playground/controller.js';
import { setupDemo } from './demo/controller.js';
import { setupSelfTests } from './playground/self-test.js';
import { setupCharacterScene } from './characters/scene.js';
import { setupWorld } from './characters/world.js';
import { setupJourney } from './characters/journey.js';

export function setupApplication(scope = document) {
  const journey = setupJourney(scope.querySelector('#node-journey'));
  const scene = setupCharacterScene(scope);
  const record = (frame) => scene.record(frame);
  const playground = setupPlayground(scope, record);
  const demo = setupDemo(scope, record);
  const cleanupSelfTests = setupSelfTests(scope);
  const cleanupProof = setupProof(scope);
  const cleanupLearning = setupLearning(scope);
  const world = setupWorld(scope, (frame) =>
    record({ ...frame, follow: true }),
  );
  const buttons = scope.querySelectorAll('[data-view]');
  const listeners = [];
  for (const button of buttons) {
    const select = () => {
      for (const item of buttons) {
        const active = item === button;
        item.setAttribute('aria-pressed', String(active));
        scope.querySelector('#' + item.dataset.view).hidden = !active;
      }
    };
    button.addEventListener('click', select);
    listeners.push(() => button.removeEventListener('click', select));
  }
  scope.querySelector('[data-view="characters"]')?.click();
  return {
    journey,
    scene,
    world,
    playground,
    demo,
    destroy() {
      journey.destroy();
      world.destroy();
      scene.destroy();
      playground.destroy();
      demo.destroy();
      cleanupSelfTests();
      cleanupProof();
      cleanupLearning();
      listeners.forEach((fn) => fn());
    },
  };
}
