import './styles/main.css';
import { setupPlayground } from './playground/controller.js';
import { setupComponentDemo } from './component/demo.js';

setupPlayground();
setupComponentDemo({
  container: document.querySelector('#phase2-root'),
  effectStatus: document.querySelector('#phase2-effect-status'),
  cleanupStatus: document.querySelector('#phase2-cleanup-status'),
});
