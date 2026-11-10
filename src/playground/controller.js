import { sampleHTML } from './sample.js';
import { domToVNode } from '../vdom/dom-to-vnode.js';
import { vnodeToDom } from '../vdom/vnode-to-dom.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import { showPatches } from './patch-view.js';
import { setupEditor, validateSample } from './editor.js';
import { createHistory } from '../history/history.js';

export function setupPlayground() {
  const actualContainer = document.querySelector('#actual-root');
  const testContainer = document.querySelector('#test-root');
  actualContainer.innerHTML = sampleHTML;
  let actualRoot = actualContainer.querySelector('[data-sample-root]');
  const initialVNode = domToVNode(actualRoot);
  testContainer.replaceChildren(vnodeToDom(initialVNode));
  let currentVNode = initialVNode;
  const status = document.querySelector('[role="status"]');
  const refreshEditor = setupEditor(testContainer, status);
  const history = createHistory(initialVNode);
  const undoButton = document.querySelector('#undo-button');
  const redoButton = document.querySelector('#redo-button');
  const updateButtons = () => {
    undoButton.disabled = !history.canUndo();
    redoButton.disabled = !history.canRedo();
  };
  const patchButton = document.querySelector('#patch-button');
  status.textContent = '테스트 영역을 수정한 뒤 Patch를 눌러 주세요.';
  showPatches([]);
  patchButton.disabled = false;
  patchButton.addEventListener('click', () => {
    const testRoot = testContainer.querySelector('[data-sample-root]');
    if (!testRoot) {
      status.textContent = '샘플 루트가 없습니다. 페이지를 새로고침해 주세요.';
      return;
    }

    try {
      validateSample(testRoot);
      const nextVNode = domToVNode(testRoot);
      const changes = diff(currentVNode, nextVNode);
      actualRoot = patch(actualRoot, changes);
      currentVNode = nextVNode;
      if (changes.length > 0) history.push(nextVNode);
      refreshEditor();
      updateButtons();
      showPatches(changes);
      status.textContent = changes.length
        ? `${changes.length}개 변경을 실제 영역에 반영했습니다.`
        : '변경 사항이 없습니다.';
    } catch (error) {
      status.textContent = `변경을 반영하지 못했습니다: ${error.message}`;
    }
  });
  function restore(target) {
    const changes = diff(currentVNode, target);
    actualRoot = patch(actualRoot, changes);
    const testRoot = testContainer.querySelector('[data-sample-root]');
    if (testRoot) {
      patch(testRoot, diff(domToVNode(testRoot), target));
    } else {
      testContainer.replaceChildren(vnodeToDom(target));
    }
    currentVNode = target;
    refreshEditor();
    showPatches(changes);
    updateButtons();
    status.textContent =
      '저장된 화면으로 이동했습니다. 미적용 편집은 취소됩니다.';
  }

  undoButton.addEventListener('click', () => restore(history.undo()));
  redoButton.addEventListener('click', () => restore(history.redo()));
  updateButtons();
}
