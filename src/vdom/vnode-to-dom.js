import { applyProps } from './dom-properties.js';

/**
 * VDOM으로 새 DOM 노드를 만든다. 페이지에 붙이는 일은 호출자가 담당한다.
 * @param {import('./types.js').VNode} vnode @returns {Node}
 */
export function vnodeToDom(vnode) {
  if (vnode.type === 'text') {
    return document.createTextNode(vnode.value);
  }

  if (vnode.type === 'element') {
    const element = document.createElement(vnode.tag);
    applyProps(element, vnode.props);

    for (const child of vnode.children) {
      element.appendChild(vnodeToDom(child));
    }

    return element;
  }

  throw new Error(`지원하지 않는 VNode 종류: ${vnode.type}`);
}
