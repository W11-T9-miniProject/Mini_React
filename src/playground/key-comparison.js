import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import { vnodeToDom } from '../vdom/vnode-to-dom.js';

const element = (tag, props, children = []) => ({
  type: 'element',
  tag,
  props,
  children,
});
const text = (value) => ({ type: 'text', value });
function createList(products, keyed) {
  return element(
    'ul',
    { class: 'key-list' },
    products.map(({ id, name }) =>
      element(
        'li',
        { 'data-product': id, ...(keyed ? { 'data-key': id } : {}) },
        [
          element('strong', { class: 'key-product-name' }, [text(name)]),
          element('label', {}, [
            text('메모'),
            element('input', {
              'aria-label': `${name} 메모`,
              maxlength: '80',
              placeholder: '메모를 직접 바꿔보세요',
            }),
          ]),
        ],
      ),
    ),
  );
}

export function setupKeyComparison() {
  const panel = document.querySelector('#key-comparison');
  const sides = ['position', 'stable'].map((id) => ({
    id,
    host: document.querySelector(`#key-${id}-root`),
    vnode: null,
    root: null,
  }));
  let products;
  let nextId;
  function show(label) {
    const orders = sides.map((side) =>
      [...side.root.querySelectorAll('.key-product-name')]
        .map((node) => node.textContent)
        .join(' → '),
    );
    document.querySelector('#key-status').textContent =
      `${label} · 상품 순서 ${orders[0] === orders[1] ? '일치' : '불일치'} · 현재 ${products.length}개`;
    for (const side of sides) {
      document.querySelector(`#key-${side.id}-memo`).textContent =
        side.root.querySelector('[data-product="mouse"] input')?.value ||
        '(마우스 항목이 없거나 메모가 비어 있음)';
    }
    document.querySelector('#key-prepend').disabled = products.length >= 6;
    document.querySelector('#key-remove').disabled = products.length === 0;
    document.querySelector('#key-reverse').disabled = products.length < 2;
  }
  function reset() {
    products = [
      { id: 'mouse', name: '마우스' },
      { id: 'keyboard', name: '키보드' },
    ];
    nextId = 1;
    for (const side of sides) {
      side.vnode = createList(products, side.id === 'stable');
      side.root = vnodeToDom(side.vnode);
      side.host.replaceChildren(side.root);
      side.root.querySelector('[data-product="mouse"] input').value = '선물용';
      side.root.querySelector('[data-product="keyboard"] input').value =
        '업무용';
      document.querySelector(`#key-${side.id}-commands`).textContent =
        '아직 실행 전';
    }
    show('처음 상태');
  }
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-key-action]');
    if (!button || !panel.contains(button) || button.disabled) return;
    const action = button.dataset.keyAction;
    if (action === 'reset') {
      reset();
      return;
    }
    if (action === 'prepend') {
      products = [
        { id: `monitor-${nextId}`, name: `모니터 ${nextId++}` },
        ...products,
      ];
    } else if (action === 'reverse') products = [...products].reverse();
    else if (action === 'remove') products = products.slice(1);
    else return;
    for (const side of sides) {
      const next = createList(products, side.id === 'stable');
      const changes = diff(side.vnode, next);
      side.root = patch(side.root, changes);
      side.vnode = next;
      const counts = new Map();
      for (const change of changes)
        counts.set(change.type, (counts.get(change.type) ?? 0) + 1);
      document.querySelector(`#key-${side.id}-commands`).textContent =
        [...counts].map(([type, count]) => `${type} ${count}개`).join(' · ') ||
        '변경 없음';
    }
    show(
      {
        prepend: '맨 앞에 상품 추가',
        reverse: '순서 뒤집기',
        remove: '맨 앞 상품 삭제',
      }[action],
    );
  });
  reset();
}
