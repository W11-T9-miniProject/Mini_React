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
  throw new Error('TODO: createHistory 구현');
}
