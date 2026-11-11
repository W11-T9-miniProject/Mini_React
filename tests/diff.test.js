import { describe, it, expect } from 'vitest';
import { diff } from '../src/vdom/diff.js';
import { h } from '../src/runtime/index.js';

describe('diff', () => {
  it('동일한 트리에 변경을 만들지 않는다', () => {
    expect(diff(h('p', {}, '안녕'), h('p', {}, '안녕'))).toEqual([]);
  });
  it('텍스트 경로를 계산한다', () => {
    expect(diff(h('p', {}, 'a'), h('p', {}, 'b'))).toEqual([
      { type: 'TEXT', path: [0], value: 'b' },
    ]);
  });
  it('속성 추가/수정/삭제를 계산한다', () => {
    expect(
      diff(
        h('p', { class: 'a', title: 'old' }),
        h('p', { class: 'b', id: 'new' }),
      ),
    ).toEqual([
      {
        type: 'PROPS',
        path: [],
        set: { class: 'b', id: 'new' },
        remove: ['title'],
      },
    ]);
  });
  it('부모 교체 시 자식 변경을 별도로 생성하지 않는다', () => {
    expect(
      diff(h('p', {}, h('b', {}, 'a')), h('section', {}, 'b')).map(
        (p) => p.type,
      ),
    ).toEqual(['REPLACE']);
  });
  it('추가와 삭제를 계산한다', () => {
    expect(diff(h('ul'), h('ul', {}, h('li', {}, 'a')))[0]).toMatchObject({
      type: 'INSERT',
      path: [],
      index: 0,
    });
    expect(diff(h('ul', {}, h('li')), h('ul'))[0]).toEqual({
      type: 'REMOVE',
      path: [0],
    });
  });
  it('입력 VDOM을 수정하지 않는다', () => {
    const previous = h('div', { title: 'x' }, 'a'),
      next = h('div', {}, 'b');
    const before = structuredClone({ previous, next });
    diff(previous, next);
    expect({ previous, next }).toEqual(before);
  });
});
