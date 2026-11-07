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
  const snapshots = [structuredClone(initial)];
  let cursor = 0;
  const current = () => structuredClone(snapshots[cursor]);
  const canUndo = () => cursor > 0;
  const canRedo = () => cursor < snapshots.length - 1;

  return {
    current,
    canUndo,
    canRedo,
    push(next) {
      const snapshot = structuredClone(next);
      snapshots.splice(cursor + 1);
      snapshots.push(snapshot);
      cursor += 1;
    },
    undo() {
      if (canUndo()) cursor -= 1;
      return current();
    },
    redo() {
      if (canRedo()) cursor += 1;
      return current();
    },
  };
}
