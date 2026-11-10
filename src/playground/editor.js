import { domToVNode } from '../vdom/dom-to-vnode.js';
import { diff } from '../vdom/diff.js';

export function getSampleRoot(container) {
  return container.querySelector('[data-sample-root]');
}

/** 테스트 영역과 마지막 적용 VNode의 차이를 상태 문구로 반영한다. */
export function observeEditor({ container, status, getApplied }) {
  const refresh = () => {
    const root = getSampleRoot(container);
    if (!root) {
      status.textContent = '샘플 루트 없음';
      return;
    }
    try {
      status.textContent = diff(getApplied(), domToVNode(root)).length
        ? '미적용 변경 있음'
        : '적용된 상태';
    } catch (error) {
      status.textContent = `편집 오류: ${error.message}`;
    }
  };

  if (typeof MutationObserver === 'undefined') {
    status.textContent = '편집 감지 미지원';
    return { refresh, disconnect() {} };
  }

  const observer = new MutationObserver(refresh);
  observer.observe(container, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  refresh();
  return {
    refresh,
    disconnect: () => observer.disconnect(),
  };
}
