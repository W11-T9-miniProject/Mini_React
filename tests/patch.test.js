import { describe, it, expect, vi } from 'vitest';
import { render } from '../src/vdom/render.js';
import { diff } from '../src/vdom/diff.js';
import { patch } from '../src/vdom/patch.js';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';

describe('patch', () => {
  it('삭제와 삽입 변경을 함께 적용한다', () => {
    const old = {
      type: 'element',
      tag: 'ul',
      props: {},
      children: ['a', 'b', 'c', 'd'].map((value) => ({
        type: 'element',
        tag: 'li',
        props: {},
        children: [{ type: 'text', value }],
      })),
    };
    const next = {
      type: 'element',
      tag: 'ul',
      props: {},
      children: ['a', 'x', 'd'].map((value) => ({
        type: 'element',
        tag: 'li',
        props: {},
        children: [{ type: 'text', value }],
      })),
    };
    const root = render(old);
    const result = patch(root, diff(old, next));
    expect(domToVNode(result)).toEqual(next);
  });
  it('중간에 자식을 삽입하고 기존 뒤쪽 노드를 보존한다', () => {
    const child = (value) => ({
      type: 'element',
      tag: 'li',
      props: {},
      children: [{ type: 'text', value }],
    });
    const old = {
      type: 'element',
      tag: 'ul',
      props: {},
      children: [child('a'), child('b')],
    };
    const next = {
      type: 'element',
      tag: 'ul',
      props: {},
      children: [child('a'), child('x'), child('b')],
    };
    const root = render(old),
      retained = root.lastChild;
    expect(diff(old, next).map((item) => item.type)).toEqual(['INSERT']);
    patch(root, diff(old, next));
    expect(root.lastChild).toBe(retained);
    expect(domToVNode(root)).toEqual(next);
  });
  it('루트를 교체하고 새 루트를 반환한다', () => {
    const old = { type: 'text', value: 'a' },
      next = { type: 'element', tag: 'p', props: {}, children: [] };
    expect(patch(render(old), diff(old, next)).nodeName).toBe('P');
  });
  it('바뀌지 않은 DOM 참조를 유지한다', () => {
    const old = {
      type: 'element',
      tag: 'div',
      props: {},
      children: [
        { type: 'element', tag: 'i', props: {}, children: [] },
        { type: 'text', value: 'a' },
      ],
    };
    const next = {
      ...old,
      children: [
        { type: 'element', tag: 'i', props: {}, children: [] },
        { type: 'text', value: 'b' },
      ],
    };
    const root = render(old),
      kept = root.firstChild;
    patch(root, diff(old, next));
    expect(root.firstChild).toBe(kept);
  });
  it('렌더 Diff Patch 재변환 결과가 목표 VDOM과 같다', () => {
    const old = {
      type: 'element',
      tag: 'div',
      props: { id: 'x' },
      children: [{ type: 'text', value: 'old' }],
    };
    const next = {
      type: 'element',
      tag: 'section',
      props: { title: 'new' },
      children: [
        {
          type: 'element',
          tag: 'b',
          props: {},
          children: [{ type: 'text', value: 'ok' }],
        },
      ],
    };
    expect(domToVNode(patch(render(old), diff(old, next)))).toEqual(next);
  });

  it('key 재정렬은 기존 DOM 노드 참조를 유지하며 add/remove와 함께 동작한다', () => {
    const child = (key, value = key) => ({
      type: 'element',
      tag: 'li',
      key,
      props: { 'data-key': key },
      children: [{ type: 'text', value }],
    });
    const old = {
      type: 'element',
      tag: 'ul',
      props: {},
      children: [child('a'), child('b'), child('c')],
    };
    const next = {
      ...old,
      children: [child('c'), child('d'), child('a', 'A updated')],
    };
    const root = render(old);
    const references = new Map(
      [...root.children].map((node) => [node.dataset.key, node]),
    );

    const updatedRoot = patch(root, diff(old, next));

    expect([...updatedRoot.children].map((node) => node.dataset.key)).toEqual([
      'c',
      'd',
      'a',
    ]);
    expect(updatedRoot.children[0]).toBe(references.get('c'));
    expect(updatedRoot.children[2]).toBe(references.get('a'));
    expect(updatedRoot.children[1]).not.toBe(references.get('b'));
    expect(updatedRoot.children[2].textContent).toBe('A updated');
    expect(domToVNode(updatedRoot)).toEqual(next);
  });

  it('key 재정렬 후 텍스트를 포함한 새 경로로 중첩 구조를 갱신한다', () => {
    const child = (key, label) => ({
      type: 'element',
      tag: 'li',
      key,
      props: { 'data-key': key },
      children: [
        {
          type: 'element',
          tag: 'b',
          props: {},
          children: [{ type: 'text', value: label }],
        },
      ],
    });
    const old = {
      type: 'element',
      tag: 'ul',
      props: {},
      children: [child('first', 'one'), child('second', 'two')],
    };
    const next = {
      ...old,
      children: [child('second', 'updated'), child('first', 'one')],
    };
    const root = render(old);
    const moved = root.children[1];

    const updatedRoot = patch(root, diff(old, next));

    expect(updatedRoot.firstChild).toBe(moved);
    expect(updatedRoot.firstChild.querySelector('b').textContent).toBe(
      'updated',
    );
    expect(domToVNode(updatedRoot)).toEqual(next);
  });

  it('조상과 자손 목록을 함께 재정렬하면 새 경로에 올바르게 적용한다', () => {
    const item = (key) => ({
      type: 'element',
      tag: 'i',
      key,
      props: { 'data-key': key },
      children: [{ type: 'text', value: key }],
    });
    const group = (key, children) => ({
      type: 'element',
      tag: 'section',
      key,
      props: { 'data-key': key },
      children,
    });
    const old = {
      type: 'element',
      tag: 'main',
      props: {},
      children: [group('a', [item('x'), item('y')]), group('b', [item('z')])],
    };
    const next = {
      ...old,
      children: [group('b', [item('z')]), group('a', [item('y'), item('x')])],
    };
    const root = render(old);
    const oldGroupA = root.children[0];
    const oldItemY = oldGroupA.children[1];

    const updated = patch(root, diff(old, next));

    expect(updated.children[1]).toBe(oldGroupA);
    expect(updated.children[1].children[0]).toBe(oldItemY);
    expect(domToVNode(updated)).toEqual(next);
  });

  it('콜백은 TEXT/PROPS/INSERT/REMOVE/REPLACE에 맞는 실노드를 전달한다', () => {
    const old = {
      type: 'element',
      tag: 'div',
      props: { title: 'old' },
      children: [
        { type: 'text', value: 'old' },
        { type: 'element', tag: 'i', props: {}, children: [] },
      ],
    };
    const next = {
      type: 'element',
      tag: 'div',
      props: { title: 'new' },
      children: [
        { type: 'text', value: 'new' },
        { type: 'element', tag: 'b', props: {}, children: [] },
        { type: 'element', tag: 'u', props: {}, children: [] },
      ],
    };
    const root = render(old);
    document.body.append(root);
    const textNode = root.firstChild;
    const removedParent = root;
    const targets = [];

    patch(root, diff(old, next), {
      onPatched: (entry) => targets.push(entry),
    });

    expect(targets.map(({ patch: item }) => item.type)).toEqual([
      'PROPS',
      'TEXT',
      'REPLACE',
      'INSERT',
    ]);
    expect(targets[0].node).toBe(root);
    expect(targets[1].node).toBe(textNode);
    expect(targets[2].node.tagName).toBe('B');
    expect(targets[3].node.tagName).toBe('U');
    expect(targets.every(({ node }) => node.isConnected)).toBe(true);
    expect(removedParent).toBe(root);
  });

  it('REMOVE 콜백은 삭제된 자리의 부모를 전달하고 루트 교체도 알린다', () => {
    const old = {
      type: 'element',
      tag: 'div',
      props: {},
      children: [{ type: 'element', tag: 'i', props: {}, children: [] }],
    };
    const next = { ...old, children: [] };
    const root = render(old);
    const target = [];

    patch(root, diff(old, next), {
      onPatched: (entry) => target.push(entry),
    });
    expect(target).toHaveLength(1);
    expect(target[0].patch.type).toBe('REMOVE');
    expect(target[0].node).toBe(root);

    const replaced = [];
    const result = patch(
      render({ type: 'text', value: 'a' }),
      [{ type: 'REPLACE', path: [], node: next }],
      { onPatched: (entry) => replaced.push(entry) },
    );
    expect(result.tagName).toBe('DIV');
    expect(replaced[0].node).toBe(result);
  });

  it('onPatched 오류는 DOM 적용을 마친 뒤 AggregateError로 전달한다', () => {
    const old = {
      type: 'element',
      tag: 'div',
      props: { title: 'old' },
      children: [{ type: 'text', value: 'old' }],
    };
    const next = {
      ...old,
      props: { title: 'new' },
      children: [{ type: 'text', value: 'new' }],
    };
    const root = render(old);
    const callback = vi.fn(() => {
      throw new Error('callback failed');
    });

    expect(() => patch(root, diff(old, next), { onPatched: callback })).toThrow(
      AggregateError,
    );
    expect(root.title).toBe('new');
    expect(root.textContent).toBe('new');
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
