import { applyProps } from './dom-properties.js';

const renderedKeys = new WeakMap();

export function getRenderedKey(node) {
  return renderedKeys.get(node) ?? node.getAttribute?.('data-key') ?? undefined;
}

/** @param {import('./types.js').VNode} vnode @returns {Node} */
export function render(vnode) {
  if (vnode?.type === 'text') return document.createTextNode(vnode.value);
  if (vnode?.type !== 'element') throw new TypeError('알 수 없는 VNode입니다.');
  const element = document.createElement(vnode.tag);
  if (Object.hasOwn(vnode, 'key')) renderedKeys.set(element, vnode.key);
  applyProps(element, vnode.props);
  for (const child of vnode.children) element.appendChild(render(child));
  return element;
}
