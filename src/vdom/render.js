import { applyProps } from './dom-properties.js';

/** @param {import('./types.js').VNode} vnode @returns {Node} */
export function render(vnode) {
  if (vnode.type === 'text') {
    return document.createTextNode(vnode.value);
  }

  if (vnode.type === 'element') {
    const element = document.createElement(vnode.tag);
    applyProps(element, vnode.props);

    for (const child of vnode.children) {
      element.appendChild(render(child));
    }

    return element;
  }

  throw new Error(`지원하지 않는 VNode 종류: ${vnode.type}`);
}
