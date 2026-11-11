function snapshot(value) {
  const copy = structuredClone(value);
  function freeze(node) {
    Object.freeze(node);
    if (node.type === 'element') {
      Object.freeze(node.props);
      node.children.forEach(freeze);
      Object.freeze(node.children);
    }
    return node;
  }
  return freeze(copy);
}

/** Phase 1의 직렬화 가능한 VDOM만 저장한다. 이벤트 함수가 있는 Phase 2와는 별개다. */
export function createHistory(initial) {
  let states = [snapshot(initial)];
  let cursor = 0;
  return {
    current: () => states[cursor],
    push(next) {
      states = [...states.slice(0, cursor + 1), snapshot(next)];
      cursor++;
    },
    undo() {
      cursor = Math.max(0, cursor - 1);
      return states[cursor];
    },
    redo() {
      cursor = Math.min(states.length - 1, cursor + 1);
      return states[cursor];
    },
    canUndo: () => cursor > 0,
    canRedo: () => cursor < states.length - 1,
    get index() {
      return cursor;
    },
    get length() {
      return states.length;
    },
  };
}
