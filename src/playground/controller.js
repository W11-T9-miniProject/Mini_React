import { sampleHTML } from './sample.js';
import { parseHTML, serializeContent } from './editor.js';
import { showPatches } from './patch-view.js';
import { domToVNode } from '../vdom/dom-to-vnode.js';
import { render } from '../vdom/render.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import { createHistory } from '../history/history.js';

export function setupPlayground(scope = document) {
  const get = (id) => scope.querySelector('#' + id);
  const actualContainer = get('actual-root'),
    testContainer = get('test-root');
  const source = get('html-source'),
    status = get('phase1-status');
  let actualRoot = parseHTML(sampleHTML);
  actualContainer.replaceChildren(actualRoot);
  const history = createHistory(domToVNode(actualRoot));
  let testRoot = render(history.current());
  testContainer.replaceChildren(testRoot);
  let invalid = false;
  const disposers = [];
  function listen(node, type, callback) {
    node.addEventListener(type, callback);
    disposers.push(() => node.removeEventListener(type, callback));
  }
  function message(text, error = false) {
    status.textContent = text;
    status.dataset.error = String(error);
  }
  function refresh() {
    get('dirty-indicator').textContent =
      invalid || diff(history.current(), domToVNode(testRoot)).length
        ? '미적용 변경 있음'
        : '동기화됨';
    get('undo-button').disabled = !history.canUndo();
    get('redo-button').disabled = !history.canRedo();
    get('history-status').textContent =
      '상태 ' + (history.index + 1) + ' / ' + history.length;
    get('vdom-output').textContent = JSON.stringify(
      domToVNode(testRoot),
      null,
      2,
    );
  }
  function syncSource() {
    source.value = serializeContent(testRoot);
  }
  function applySource() {
    try {
      const next = parseHTML(source.value);
      const vnode = domToVNode(next);
      testRoot = patch(testRoot, diff(domToVNode(testRoot), vnode));
      invalid = false;
      message('테스트 영역을 변경했습니다. Patch로 실제 영역에 반영하세요.');
      refresh();
    } catch (error) {
      invalid = true;
      message(error.message, true);
    }
  }
  function commit() {
    if (invalid) {
      message(
        'HTML 오류를 먼저 수정하세요. 실제 영역과 이력은 변경하지 않았습니다.',
        true,
      );
      return;
    }
    // DOM에서 직접 편집된 내용도 검증한 뒤 읽는다.
    try {
      parseHTML(serializeContent(testRoot));
    } catch (error) {
      message(error.message, true);
      return;
    }
    const next = domToVNode(testRoot);
    const patches = diff(history.current(), next);
    actualRoot = patch(actualRoot, patches);
    if (patches.length) history.push(next);
    showPatches(get('patch-output'), patches);
    get('patch-count').textContent = String(patches.length);
    syncSource();
    refresh();
    message(
      patches.length
        ? patches.length + '개의 변경 적용 · 새 상태 저장 완료'
        : '변경 없음 · 새 이력을 저장하지 않았습니다.',
    );
  }
  function travel(direction) {
    const previous = history.current();
    const target = history[direction]();
    const patches = diff(previous, target);
    actualRoot = patch(actualRoot, patches);
    testRoot = patch(testRoot, diff(domToVNode(testRoot), target));
    invalid = false;
    syncSource();
    refresh();
    showPatches(get('patch-output'), patches);
    get('patch-count').textContent = String(patches.length);
    message('이력 이동 완료. 미적용 편집도 선택한 상태로 복원했습니다.');
  }
  listen(source, 'input', applySource);
  listen(get('patch-button'), 'click', commit);
  listen(get('undo-button'), 'click', () => travel('undo'));
  listen(get('redo-button'), 'click', () => travel('redo'));
  listen(get('reset-editor'), 'click', () => {
    source.value = sampleHTML;
    applySource();
  });
  listen(get('add-element'), 'click', () => {
    source.value += '\n<p class="accent">새로 추가한 문장입니다.</p>';
    applySource();
  });
  listen(testContainer, 'input', () => {
    invalid = false;
    syncSource();
    refresh();
    message('화면을 편집했습니다. Patch를 눌러 반영하세요.');
  });
  listen(testContainer, 'paste', (event) => {
    // HTML 붙여넣기는 코드 편집창에서 검증한다. 직접 편집에는 일반 텍스트만 삽입.
    event.preventDefault();
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!testContainer.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const text = document.createTextNode(
      event.clipboardData?.getData('text/plain') ?? '',
    );
    range.insertNode(text);
    range.setStartAfter(text);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    testContainer.dispatchEvent(new Event('input', { bubbles: true }));
  });
  listen(testContainer, 'drop', (event) => {
    event.preventDefault();
    message('HTML은 코드 편집창에 붙여넣어 주세요.');
  });
  for (const container of [actualContainer, testContainer])
    listen(container, 'click', (event) => {
      if (event.target.closest('a')) event.preventDefault();
    });
  // 직접 편집에서 샘플 루트가 제거되는 것을 막고, 관찰 시에는 다시 렌더하지 않는다.
  const observer = new MutationObserver(() => {
    if (!testContainer.contains(testRoot)) {
      testContainer.replaceChildren(testRoot);
      message(
        '샘플 루트는 유지됩니다. 내부 요소는 HTML 편집창에서 자유롭게 바꿀 수 있습니다.',
      );
    }
    refresh();
  });
  observer.observe(testContainer, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  syncSource();
  refresh();
  showPatches(get('patch-output'), []);
  message('준비 완료. HTML 코드 또는 테스트 화면을 편집해 보세요.');
  return {
    history,
    commit,
    travel,
    destroy() {
      observer.disconnect();
      disposers.forEach((fn) => fn());
    },
  };
}
