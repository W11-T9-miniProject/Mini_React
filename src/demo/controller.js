import { FunctionComponent } from '../runtime/index.js';
import { App } from './app.js';
import { showPatches } from '../playground/patch-view.js';

export function setupDemo(scope = document) {
  const get = (id) => scope.querySelector('#' + id);
  let instance;
  const entries = [];
  function logEffect(text) {
    entries.unshift(new Date().toLocaleTimeString('ko-KR') + ' ' + text);
    get('effect-log').textContent = entries.slice(0, 16).join('\n');
  }
  function mount() {
    instance = new FunctionComponent(App, { logEffect });
    instance.onCommit = (info) => {
      get('render-count').textContent = info.renderCount;
      get('memo-count').textContent = info.memoRuns;
      get('runtime-patch-count').textContent = info.patches.length;
      showPatches(get('runtime-patches'), info.patches);
      get('runtime-status').textContent =
        '마운트됨 · 상태 변경 시 microtask로 배칭 후 Diff/Patch';
    };
    instance.onError = (error) => {
      get('runtime-status').textContent = error.message;
    };
    instance.mount(get('component-root'));
    get('mount-toggle').textContent = 'Unmount · Effect 정리';
  }
  function toggle() {
    if (instance.disposed) mount();
    else {
      instance.unmount();
      get('runtime-status').textContent =
        'Unmount 완료 · 모든 Effect 정리. 다시 Mount하면 초기 상태로 시작합니다.';
      get('mount-toggle').textContent = '다시 Mount';
    }
  }
  get('mount-toggle').addEventListener('click', toggle);
  mount();
  return {
    get instance() {
      return instance;
    },
    destroy() {
      instance.unmount();
      get('mount-toggle').removeEventListener('click', toggle);
    },
  };
}
