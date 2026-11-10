import { sampleHTML } from './sample.js';
import { domToVNode } from '../vdom/dom-to-vnode.js';
import { render } from '../vdom/render.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import { createHistory } from '../history/history.js';
import { getSampleRoot, observeEditor } from './editor.js';
import { showPatches } from './patch-view.js';

export function setupPlayground() {
  const actualContainer = document.querySelector('#actual-root');
  const testContainer = document.querySelector('#test-root');
  actualContainer.innerHTML = sampleHTML;
  const initial = domToVNode(getSampleRoot(actualContainer));
  let applied = initial;
  let actualRoot = getSampleRoot(actualContainer);
  const history = createHistory(initial);
  testContainer.replaceChildren(render(initial));

  const patchButton = document.querySelector('#patch-button');
  const undoButton = document.querySelector('#undo-button');
  const redoButton = document.querySelector('#redo-button');
  const output = document.querySelector('#patch-output');
  const editStatus = document.querySelector('#edit-status');
  const timeline = document.querySelector('#history-timeline');
  const highlightTimers = new WeakMap();

  const highlight = ({ node }) => {
    const element =
      node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element?.classList) return;
    const previous = highlightTimers.get(element);
    if (previous) clearTimeout(previous.timer);
    const ownsClass =
      previous?.ownsClass ?? !element.classList.contains('patch-highlight');
    if (element.classList.contains('patch-highlight')) {
      element.classList.remove('patch-highlight');
      void element.offsetWidth;
    }
    element.classList.add('patch-highlight');
    const timer = setTimeout(() => {
      if (ownsClass) element.classList.remove('patch-highlight');
      highlightTimers.delete(element);
    }, 800);
    highlightTimers.set(element, { timer, ownsClass });
  };

  const renderTimeline = () => {
    if (!timeline) return;
    const currentIndex = history.index();
    timeline.replaceChildren(
      ...history.entries().map((_, index) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.historyIndex = String(index);
        button.textContent = index === 0 ? '초기 상태' : `상태 ${index}`;
        if (index === currentIndex) {
          button.setAttribute('aria-current', 'step');
          button.disabled = true;
        } else {
          button.addEventListener('click', () => moveTo(history.goTo(index)));
        }
        item.append(button);
        return item;
      }),
    );
  };

  const refreshButtons = () => {
    if (undoButton) undoButton.disabled = !history.canUndo();
    if (redoButton) redoButton.disabled = !history.canRedo();
    renderTimeline();
  };

  const editorObserver = editStatus
    ? observeEditor({
        container: testContainer,
        status: editStatus,
        getApplied: () => applied,
      })
    : null;

  if (patchButton) patchButton.disabled = false;
  patchButton?.addEventListener('click', () => {
    const edited = getSampleRoot(testContainer);
    if (!edited) {
      if (editStatus) editStatus.textContent = '샘플 루트 없음';
      if (output)
        output.textContent = '샘플 루트(data-sample-root)를 유지해 주세요.';
      return;
    }
    try {
      const next = domToVNode(edited);
      const changes = diff(applied, next);
      actualRoot = patch(actualRoot, changes, { onPatched: highlight });
      if (changes.length) {
        applied = next;
        history.push(next);
      }
      if (output) showPatches(output, changes);
      refreshButtons();
      editorObserver?.refresh();
    } catch (error) {
      if (editStatus) editStatus.textContent = `편집 오류: ${error.message}`;
      if (output) output.textContent = `Patch 오류: ${error.message}`;
    }
  });

  const moveTo = (target) => {
    const changes = diff(applied, target);
    actualRoot = patch(actualRoot, changes, { onPatched: highlight });
    applied = target;
    testContainer.replaceChildren(render(target));
    if (output) showPatches(output, changes);
    refreshButtons();
    editorObserver?.refresh();
  };

  undoButton?.addEventListener('click', () => moveTo(history.undo()));
  redoButton?.addEventListener('click', () => moveTo(history.redo()));
  refreshButtons();
  if (output) showPatches(output, []);
  return { history, getApplied: () => applied };
}
