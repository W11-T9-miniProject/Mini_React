import { describe, expect, it } from 'vitest';
import { diff } from '../src/vdom/diff.js';
import { patch } from '../src/vdom/patch.js';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';
import { vnodeToDom } from '../src/vdom/vnode-to-dom.js';

const text = (value) => ({ type: 'text', value });
const element = (tag, children = [], props = {}) => ({
  type: 'element',
  tag,
  props,
  children,
});
const item = (key, label = key, tag = 'li') =>
  element(
    tag,
    [
      element('span', [text(label)]),
      element('input', [], { 'aria-label': `${key} 메모` }),
    ],
    { 'data-key': key },
  );
const list = (keys) =>
  element(
    'ul',
    keys.map((key) => item(key)),
  );

describe('data-key로 자식 식별', () => {
  it('맨 앞 삽입은 기존 글자를 고치지 않고 새 요소 하나만 추가한다', () => {
    const before = list(['mouse', 'keyboard']);
    const after = list(['monitor', 'mouse', 'keyboard']);
    const root = vnodeToDom(before);
    const [mouse, keyboard] = root.children;
    mouse.querySelector('input').value = '선물용';
    let clicks = 0;
    mouse.addEventListener('click', () => clicks++);
    const changes = diff(before, after);
    expect(changes).toEqual([
      { type: 'INSERT', path: [], index: 0, node: after.children[0] },
    ]);
    patch(root, changes);
    expect(root.children[1]).toBe(mouse);
    expect(root.children[2]).toBe(keyboard);
    expect(mouse.querySelector('input').value).toBe('선물용');
    mouse.click();
    expect(clicks).toBe(1);
    expect(domToVNode(root)).toEqual(after);
  });

  it('같은 항목을 재정렬하며 DOM과 메모를 함께 이동한다', () => {
    const before = list(['a', 'b', 'c']);
    const after = list(['c', 'b', 'a']);
    const root = vnodeToDom(before);
    const nodes = [...root.children];
    nodes.forEach((node, i) => {
      node.querySelector('input').value = `메모 ${i}`;
    });
    const changes = diff(before, after);
    expect(changes.every((change) => change.type === 'MOVE')).toBe(true);
    patch(root, changes);
    expect([...root.children]).toEqual([nodes[2], nodes[1], nodes[0]]);
    expect(
      [...root.querySelectorAll('input')].map((input) => input.value),
    ).toEqual(['메모 2', '메모 1', '메모 0']);
  });

  it('삭제·추가·이동·글자와 속성 변경을 함께 처리한다', () => {
    const before = list(['a', 'b', 'c', 'd']);
    const after = element('ul', [
      item('x'),
      item('b', '변경한 B'),
      item('d'),
      item('a'),
    ]);
    after.children[1].props.class = 'selected';
    const root = vnodeToDom(before);
    const nodes = [...root.children];
    patch(root, diff(before, after));
    expect(domToVNode(root)).toEqual(after);
    expect(root.children[1]).toBe(nodes[1]);
    expect(root.children[2]).toBe(nodes[3]);
    expect(root.children[3]).toBe(nodes[0]);
    expect(nodes[2].parentNode).toBeNull();
  });

  it('이동할 항목의 태그가 달라지면 교체한 새 노드를 이동한다', () => {
    const before = list(['a', 'b']);
    const after = element('ul', [item('b', '새 B', 'div'), item('a')]);
    const root = vnodeToDom(before);
    const a = root.firstChild;
    const b = root.lastChild;
    patch(root, diff(before, after));
    expect(domToVNode(root)).toEqual(after);
    expect(root.lastChild).toBe(a);
    expect(root.firstChild).not.toBe(b);
    expect(b.parentNode).toBeNull();
  });

  it('공백·키 없는 자식과 키 있는 자식을 함께 다루며 주석은 경로에서 제외한다', () => {
    const before = element('ul', [text('\n'), item('a'), text(' '), item('b')]);
    const after = element('ul', [text('\n'), item('b'), text(' '), item('a')]);
    const root = vnodeToDom(before);
    const a = root.children[0];
    const b = root.children[1];
    root.insertBefore(document.createComment('경로 제외'), root.firstChild);
    patch(root, diff(before, after));
    expect(domToVNode(root)).toEqual(after);
    expect([...root.children]).toEqual([b, a]);
  });

  it('키가 바뀐 항목은 새로 만들고, 다른 부모의 같은 키는 허용한다', () => {
    const before = element('div', [list(['a']), list(['a'])]);
    const after = element('div', [list(['new']), list(['a'])]);
    const root = vnodeToDom(before);
    const previous = root.children[0].firstChild;
    const other = root.children[1].firstChild;
    patch(root, diff(before, after));
    expect(domToVNode(root)).toEqual(after);
    expect(root.children[0].firstChild).not.toBe(previous);
    expect(root.children[1].firstChild).toBe(other);
  });

  it.each([['a', 'a'], [''], ['   ']])(
    '중복 또는 빈 키를 DOM 변경 전에 거부한다: %j',
    (...keys) => {
      const before = list(['valid']);
      const invalid = list(keys);
      expect(() => diff(before, invalid)).toThrow(/key/);
      expect(() => diff(invalid, before)).toThrow(/key/);
      expect(() => vnodeToDom(invalid)).toThrow(/key/);
    },
  );

  it('기존 루트의 식별 키가 달라지면 같은 태그여도 교체한다', () => {
    const before = item('a');
    const after = item('b');
    expect(diff(before, after)).toEqual([
      { type: 'REPLACE', path: [], node: after },
    ]);
  });

  it('부모 이동과 내부 자식의 추가·재정렬을 함께 처리한다', () => {
    const group = (key, keys) =>
      element('section', [list(keys)], { 'data-key': key });
    const before = element('div', [
      group('left', ['a', 'b']),
      group('right', ['a', 'b', 'c']),
    ]);
    const after = element('div', [
      group('right', ['c', 'new', 'a']),
      group('left', ['b', 'a']),
    ]);
    const root = vnodeToDom(before);
    const [left, right] = root.children;
    const rightA = right.querySelector('[data-key="a"]');
    rightA.querySelector('input').value = '부모와 함께 이동';
    patch(root, diff(before, after));
    expect(domToVNode(root)).toEqual(after);
    expect([...root.children]).toEqual([right, left]);
    expect(right.querySelector('[data-key="a"]')).toBe(rightA);
    expect(rightA.querySelector('input').value).toBe('부모와 함께 이동');
  });

  it('여러 삽입·삭제·재정렬 조합에서 결과와 기존 항목의 정체성을 보존한다', () => {
    const permutations = (keys) => [
      [],
      ...keys.flatMap((key) =>
        permutations(keys.filter((k) => k !== key)).map((rest) => [
          key,
          ...rest,
        ]),
      ),
    ];
    const before = list(['a', 'b', '__proto__']);
    for (const keys of permutations(['a', 'b', '__proto__', 'new'])) {
      const root = vnodeToDom(before);
      const originals = new Map(
        [...root.children].map((node) => [node.dataset.key, node]),
      );
      const snapshot = structuredClone(before);
      const after = list(keys);
      patch(root, diff(before, after));
      expect(domToVNode(root)).toEqual(after);
      for (const node of root.children) {
        if (originals.has(node.dataset.key))
          expect(node).toBe(originals.get(node.dataset.key));
      }
      expect(before).toEqual(snapshot);
    }
  });
});
