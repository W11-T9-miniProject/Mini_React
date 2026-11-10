import { FunctionComponent } from './function-component.js';
import { h, renderChild } from './create-element.js';
import { useEffect, useMemo, useState } from './hooks.js';

function CountSummary({ count, doubled }) {
  return h('p', { 'data-summary': '' }, `Count ${count}, double ${doubled}`);
}

function Counter({ effectStatus, cleanupStatus }) {
  const [count, setCount] = useState(0);
  const doubled = useMemo(() => count * 2, [count]);

  useEffect(() => {
    effectStatus.textContent = `Effect: count ${count}`;
    return () => {
      cleanupStatus.textContent = `Cleanup: count ${count}`;
    };
  }, [count]);

  return h(
    'div',
    { 'data-component-demo-root': '', class: 'counter-widget' },
    h(
      'p',
      { 'data-static': '' },
      '이 문장은 상태가 바뀌어도 그대로 유지됩니다.',
    ),
    h('p', { 'data-count': '', 'aria-live': 'polite' }, String(count)),
    h(
      'div',
      {
        class: 'counter-controls',
        role: 'group',
        'aria-label': '카운터 조작',
      },
      h(
        'button',
        {
          type: 'button',
          'data-action': 'decrement',
          'aria-label': '개수 줄이기',
          onClick: () => setCount((current) => current - 1),
        },
        '−',
      ),
      h(
        'button',
        {
          type: 'button',
          'data-action': 'increment',
          'aria-label': '개수 늘리기',
          onClick: () => setCount((current) => current + 1),
        },
        '+',
      ),
      h(
        'button',
        {
          type: 'button',
          'data-action': 'reset',
          onClick: () => setCount(0),
        },
        '초기화',
      ),
    ),
    h('p', { 'data-double': '' }, String(doubled)),
    renderChild(CountSummary, { count, doubled }),
  );
}

export function setupComponentDemo({ container, effectStatus, cleanupStatus }) {
  if (
    !container ||
    container.nodeType !== Node.ELEMENT_NODE ||
    !effectStatus ||
    !cleanupStatus
  ) {
    throw new TypeError('Phase 2 데모에 세 개의 DOM 요소가 필요합니다.');
  }
  const instance = new FunctionComponent(Counter, {
    effectStatus,
    cleanupStatus,
  });
  instance.mount(container);
  return instance;
}
