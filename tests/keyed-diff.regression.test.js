import { describe, it, expect } from 'vitest';
import { diff } from '../src/vdom/diff.js';
import { h } from '../src/runtime/index.js';

const item = (key, text, props = {}) =>
  h('li', key === undefined ? props : { ...props, key }, text);
const list = (keys, labels) =>
  h(
    'ul',
    {},
    keys.map((key, index) => item(key, labels[index])),
  );

describe('keyed diff regression contracts', () => {
  it.each([
    ['previous missing', ['a', undefined], ['b', 'a']],
    ['next missing', ['a', 'b'], ['b', undefined]],
    ['previous duplicate', ['a', 'a'], ['b', 'a']],
    ['next duplicate', ['a', 'b'], ['b', 'b']],
  ])(
    '%s falls back for the entire sibling list',
    (_, previousKeys, nextKeys) => {
      const patches = diff(
        list(previousKeys, ['old first', 'old second']),
        list(nextKeys, ['new first', 'new second']),
      );

      expect(patches.filter((patch) => patch.type === 'TEXT')).toEqual([
        { type: 'TEXT', path: [0, 0], value: 'new first' },
        { type: 'TEXT', path: [1, 0], value: 'new second' },
      ]);
      expect(
        patches.some((patch) =>
          ['MOVE', 'INSERT', 'REMOVE', 'REPLACE'].includes(patch.type),
        ),
      ).toBe(false);
    },
  );

  it('inserts keyed children from an empty list in next-index order', () => {
    const next = list(['b', 'a'], ['B', 'A']);
    expect(diff(h('ul'), next)).toEqual([
      { type: 'INSERT', path: [], index: 0, node: next.children[0] },
      { type: 'INSERT', path: [], index: 1, node: next.children[1] },
    ]);
  });

  it('removes all keyed children in descending previous-index order', () => {
    expect(diff(list(['b', 'a'], ['B', 'A']), h('ul'))).toEqual([
      { type: 'REMOVE', path: [1] },
      { type: 'REMOVE', path: [0] },
    ]);
    expect(diff(h('ul'), h('ul'))).toEqual([]);
  });

  it('addresses moved matching nodes and their descendants by previous paths', () => {
    const previous = h(
      'ul',
      {},
      item('a', 'old A', { title: 'old' }),
      item('b', 'B'),
    );
    const next = h(
      'ul',
      {},
      item('b', 'B'),
      item('a', 'new A', { title: 'new' }),
    );
    const patches = diff(previous, next);

    expect(patches).toEqual(
      expect.arrayContaining([
        { type: 'MOVE', path: [0], index: 1 },
        { type: 'PROPS', path: [0], set: { title: 'new' }, remove: [] },
        { type: 'TEXT', path: [0, 0], value: 'new A' },
      ]),
    );
    expect(patches.filter((patch) => patch.type !== 'MOVE')).toHaveLength(2);
    for (const move of patches.filter((patch) => patch.type === 'MOVE')) {
      expect(previous.children[move.path[0]].props.key).toBe(
        next.children[move.index].props.key,
      );
    }
  });

  it('replaces a reordered same-key tag at its previous path without descendant patches', () => {
    const previous = h('ul', {}, item('a', 'A'), item('b', 'old B'));
    const replacement = h('strong', { key: 'b', title: 'new' }, 'new B');
    const patches = diff(previous, h('ul', {}, replacement, item('a', 'A')));

    expect(patches).toContainEqual({ type: 'MOVE', path: [1], index: 0 });
    expect(patches.filter((patch) => patch.type !== 'MOVE')).toEqual([
      { type: 'REPLACE', path: [1], node: replacement },
    ]);
  });
});
