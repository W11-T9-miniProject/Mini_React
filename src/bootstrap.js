import { setupPlayground } from './playground/controller.js';
import { setupDemo } from './demo/controller.js';
import { setupSelfTests } from './playground/self-test.js';

export function setupApplication(scope = document) {
  const playground = setupPlayground(scope);
  const demo = setupDemo(scope);
  const cleanupSelfTests = setupSelfTests(scope);
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
  return {
    playground,
    demo,
    destroy() {
      playground.destroy();
      demo.destroy();
      cleanupSelfTests();
      listeners.forEach((fn) => fn());
    },
  };
}
