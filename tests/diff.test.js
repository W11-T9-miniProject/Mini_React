import { describe, it, expect } from 'vitest';
import { diff } from '../src/vdom/diff.js';

describe('diff', () => {
  it('동일 트리이면 빈 목록을 반환하고 변경을 분류한다', () => {
    const old = {
      type: 'element',
      tag: 'div',
      props: { id: 'a' },
      children: [
        { type: 'text', value: 'a' },
        { type: 'element', tag: 'i', props: {}, children: [] },
      ],
    };
    expect(diff(old, structuredClone(old))).toEqual([]);
    const next = {
      type: 'element',
      tag: 'div',
      props: { title: 'b' },
      children: [
        { type: 'text', value: 'b' },
        { type: 'b', tag: 'b', props: {}, children: [] },
        { type: 'text', value: 'c' },
      ],
    };
    expect(diff(old, next).map((p) => p.type)).toEqual([
      'PROPS',
      'TEXT',
      'REPLACE',
      'INSERT',
    ]);
    expect(
      diff(
        { type: 'text', value: 'x' },
        { type: 'element', tag: 'p', props: {}, children: [] },
      )[0].type,
    ).toBe('REPLACE');
    expect(
      diff(old, { type: 'element', tag: 'div', props: {}, children: [] }).map(
        (p) => p.type,
      ),
    ).toContain('REMOVE');
  });
  it('입력 VDOM을 수정하지 않는다', () => {
    const old = {
      type: 'element',
      tag: 'div',
      props: {},
      children: [{ type: 'text', value: 'a' }],
    };
    const next = {
      type: 'element',
      tag: 'div',
      props: { title: 'x' },
      children: [{ type: 'text', value: 'b' }],
    };
    const snapshot = structuredClone(old);
    diff(old, next);
    expect(old).toEqual(snapshot);
  });

  it('모든 형제에 key가 있으면 순서 변경을 REORDER 하나로 표현한다', () => {
    const child = (key, text = key) => ({
      type: 'element',
      tag: 'li',
      key,
      props: { 'data-key': String(key) },
      children: [{ type: 'text', value: text }],
    });
    const old = {
      type: 'element',
      tag: 'ul',
      props: {},
      children: [child('a'), child('b'), child('c')],
    };
    const next = {
      ...old,
      children: [child('c'), child('a'), child('b')],
    };
    const before = structuredClone(old);
    const changes = diff(old, next);

    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('REORDER');
    expect(changes[0].path).toEqual([]);
    expect(changes[0].children.map(({ key }) => key)).toEqual(['c', 'a', 'b']);
    expect(changes[0].children.map(({ node }) => node)).toEqual(next.children);
    expect(old).toEqual(before);
  });

  it('재정렬 뒤 자식 콘텐츠 변경 경로는 새 인덱스를 가리킨다', () => {
    const child = (key, text) => ({
      type: 'element',
      tag: 'li',
      key,
      props: { 'data-key': key },
      children: [{ type: 'text', value: text }],
    });
    const old = {
      type: 'element',
      tag: 'ul',
      props: {},
      children: [child('a', 'A'), child('b', 'B')],
    };
    const next = {
      ...old,
      children: [child('b', 'B updated'), child('a', 'A')],
    };

    expect(diff(old, next)).toEqual([
      {
        type: 'REORDER',
        path: [],
        children: [
          { key: 'b', node: next.children[0] },
          { key: 'a', node: next.children[1] },
        ],
      },
      { type: 'TEXT', path: [0, 0], value: 'B updated' },
    ]);
  });

  it('새 key 추가와 사라진 key 삭제를 목표 순서대로 한 번에 표현한다', () => {
    const child = (key) => ({
      type: 'element',
      tag: 'li',
      key,
      props: {},
      children: [{ type: 'text', value: key }],
    });
    const old = {
      type: 'element',
      tag: 'ul',
      props: {},
      children: [child('a'), child('b'), child('c')],
    };
    const next = { ...old, children: [child('d'), child('a'), child('c')] };

    const changes = diff(old, next);
    expect(changes[0].type).toBe('REORDER');
    expect(changes[0].children.map(({ key }) => key)).toEqual(['d', 'a', 'c']);
  });

  it('중복 형제 key는 TypeError이며 일부만 key가 있으면 인덱스 비교한다', () => {
    const item = (key, text) => ({
      type: 'element',
      tag: 'li',
      ...(key === undefined ? {} : { key }),
      props: {},
      children: [{ type: 'text', value: text }],
    });
    const parent = (children) => ({
      type: 'element',
      tag: 'ul',
      props: {},
      children,
    });

    expect(() =>
      diff(parent([item('x', 'one'), item('x', 'two')]), parent([])),
    ).toThrow(TypeError);
    const fallback = diff(
      parent([item('x', 'one'), item(undefined, 'two')]),
      parent([item(undefined, 'two'), item('x', 'one')]),
    );
    expect(fallback.some(({ type }) => type === 'REORDER')).toBe(false);
  });

  it('문자열/숫자 key는 문자열 형태로 비교하며 빈 key와 객체 key를 거부한다', () => {
    const keyed = (key) => ({
      type: 'element',
      tag: 'li',
      key,
      props: {},
      children: [],
    });
    const parent = (children) => ({
      type: 'element',
      tag: 'ul',
      props: {},
      children,
    });

    expect(() => diff(parent([keyed('')]), parent([]))).toThrow(TypeError);
    expect(() => diff(parent([keyed({ id: 1 })]), parent([]))).toThrow(
      TypeError,
    );
    expect(() => diff(parent([keyed(7), keyed('7')]), parent([]))).toThrow(
      TypeError,
    );
    expect(diff(parent([keyed(7)]), parent([keyed('7')]))).toEqual([]);
  });

  it('텍스트 자식이 섞인 형제 집합은 key 재정렬 대신 기존 인덱스 규칙을 쓴다', () => {
    const keyed = (key) => ({
      type: 'element',
      tag: 'li',
      key,
      props: {},
      children: [],
    });
    const old = {
      type: 'element',
      tag: 'ul',
      props: {},
      children: [keyed('a'), { type: 'text', value: 'tail' }],
    };
    const next = {
      ...old,
      children: [{ type: 'text', value: 'tail' }, keyed('a')],
    };

    expect(diff(old, next).some(({ type }) => type === 'REORDER')).toBe(false);
  });
});
