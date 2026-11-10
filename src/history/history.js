/**
 * DOM과 독립적인 불변 VDOM 스냅샷 관리. 경계 이동은 현재 상태 반환.
 * @param {import('../vdom/types.js').VNode} initial
 * @returns {{current: () => import('../vdom/types.js').VNode,
 * push: (next: import('../vdom/types.js').VNode) => void,
 * undo: () => import('../vdom/types.js').VNode,
 * redo: () => import('../vdom/types.js').VNode,
 * canUndo: () => boolean, canRedo: () => boolean}}
 */
export function createHistory(initial) {
  const clone = (value) =>
    value.type === 'text'
      ? { type: 'text', value: value.value }
      : {
          type: 'element',
          tag: value.tag,
          ...(Object.hasOwn(value, 'key') ? { key: value.key } : {}),
          props: Object.assign(Object.create(null), value.props),
          children: value.children.map(clone),
        };
  const entries = [clone(initial)];
  let cursor = 0;
  return {
    current: () => clone(entries[cursor]),
    entries: () => entries.map(clone),
    index: () => cursor,
    push(next) {
      entries.splice(cursor + 1);
      entries.push(clone(next));
      cursor = entries.length - 1;
    },
    undo() {
      if (cursor > 0) cursor -= 1;
      return clone(entries[cursor]);
    },
    redo() {
      if (cursor < entries.length - 1) cursor += 1;
      return clone(entries[cursor]);
    },
    goTo(index) {
      if (!Number.isInteger(index) || index < 0 || index >= entries.length) {
        throw new RangeError('History 인덱스가 범위를 벗어났습니다.');
      }
      cursor = index;
      return clone(entries[cursor]);
    },
    canUndo: () => cursor > 0,
    canRedo: () => cursor < entries.length - 1,
  };
}
