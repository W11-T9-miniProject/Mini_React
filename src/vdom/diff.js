/**
 * DOM에 접근하지 않고 입력 VDOM도 수정하지 않는다.
 * @param {import('./types.js').VNode} previous
 * @param {import('./types.js').VNode} next
 * @returns {import('./types.js').Patch[]}
 */
export function diff(previous, next) {
  throw new Error('TODO: diff 구현');
}
