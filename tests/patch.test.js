import { describe, it, expect, vi } from 'vitest';
import { diff } from '../src/vdom/diff.js';
import { patch } from '../src/vdom/patch.js';
import { render } from '../src/vdom/render.js';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';
import { h } from '../src/runtime/index.js';

function update(a, b) {
  return patch(render(a), diff(a, b));
}
describe('patch', () => {
  it('연속 삭제와 다른 형제 텍스트 수정을 안전하게 적용한다', () => {
    const a = h(
      'div',
      {},
      h('ul', {}, h('li', {}, 'a'), h('li', {}, 'b'), h('li', {}, 'c')),
      h('p', {}, 'old'),
    );
    const b = h('div', {}, h('ul', {}, h('li', {}, 'a')), h('p', {}, 'new'));
    expect(domToVNode(update(a, b))).toEqual(b);
  });
  it('중간 삽입과 태그 교체를 결과 트리대로 적용한다', () => {
    const a = h('ul', {}, h('li', {}, 'a'), h('li', {}, 'c'));
    const b = h(
      'ul',
      {},
      h('li', {}, 'a'),
      h('strong', {}, 'b'),
      h('li', {}, 'c'),
    );
    expect(domToVNode(update(a, b))).toEqual(b);
  });
  it('루트 교체 결과를 반환하고 실제 부모에도 반영한다', () => {
    const a = h('p', {}, 'old'),
      b = h('section', {}, 'new'),
      root = render(a);
    document.body.append(root);
    const result = patch(root, diff(a, b));
    expect(document.body.firstChild).toBe(result);
    expect(result.tagName).toBe('SECTION');
  });
  it('주석이 있어도 텍스트 경로가 어긋나지 않는다', () => {
    const root = document.createElement('p');
    root.innerHTML = '<!-- comment -->old';
    patch(root, diff(domToVNode(root), h('p', {}, 'new')));
    expect(root.textContent).toBe('new');
  });
  it('변경 없는 노드와 입력 포커스/커서를 유지한다', () => {
    const a = h('div', {}, h('input', { value: 'hello' }), h('p', {}, 'a'));
    const b = h('div', {}, h('input', { value: 'hello' }), h('p', {}, 'b'));
    const root = render(a);
    document.body.append(root);
    const input = root.firstChild;
    input.focus();
    input.setSelectionRange(2, 2);
    patch(root, diff(a, b));
    expect(root.firstChild).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(2);
  });
  it('이벤트 리스너를 교체/삭제하고 중복 등록하지 않는다', () => {
    const first = vi.fn(),
      second = vi.fn();
    const a = h('button', { onClick: first }, 'x'),
      b = h('button', { onClick: second }, 'x'),
      c = h('button', {}, 'x');
    const root = render(a);
    root.click();
    patch(root, diff(a, b));
    root.click();
    patch(root, diff(b, c));
    root.click();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
  it('속성과 boolean 프로퍼티를 삭제한다', () => {
    const result = update(
      h('button', { title: 'x', disabled: true }),
      h('button', { disabled: false }),
    );
    expect(result.hasAttribute('title')).toBe(false);
    expect(result.disabled).toBe(false);
  });
  it('option 구조 변경 후 select value를 적용한다', () => {
    const a = h('select', { value: 'a' }, h('option', { value: 'a' }, 'A'));
    const b = h('select', { value: 'b' }, h('option', { value: 'b' }, 'B'));
    expect(update(a, b).value).toBe('b');
  });
  it('텍스트와 요소 사이를 교체한다', () => {
    expect(
      domToVNode(update(h('div', {}, 'a'), h('div', {}, h('span', {}, 'b')))),
    ).toEqual(h('div', {}, h('span', {}, 'b')));
  });
  it('select value가 같아도 option 순서가 바뀌면 선택값을 유지한다', () => {
    const a = h(
      'select',
      { value: 'b' },
      h('option', { value: 'a' }, 'A'),
      h('option', { value: 'b' }, 'B'),
    );
    const b = h(
      'select',
      { value: 'b' },
      h('option', { value: 'b' }, 'B'),
      h('option', { value: 'a' }, 'A'),
    );
    expect(update(a, b).value).toBe('b');
  });
  it('결정적 난수로 만든 150개 트리 쌍에서 render → diff → patch 성질을 검증한다', () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    function tree(depth) {
      if (!depth || random() < 0.3)
        return { type: 'text', value: String(Math.floor(random() * 10)) };
      return h(
        ['div', 'section', 'span'][Math.floor(random() * 3)],
        { title: String(Math.floor(random() * 4)) },
        Array.from({ length: Math.floor(random() * 4) }, () => tree(depth - 1)),
      );
    }
    for (let i = 0; i < 150; i++) {
      const a = tree(3),
        b = tree(3);
      expect(domToVNode(update(a, b))).toEqual(b);
    }
  });
});
