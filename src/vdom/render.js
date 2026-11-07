import { applyProps } from './dom-properties.js';
export function render(vnode) {
  if (vnode.type === 'text') return document.createTextNode(vnode.value);
  const element = document.createElement(vnode.tag);
  vnode.children.forEach((child) => element.appendChild(render(child)));
  // select.value 등 자식 option이 필요한 속성은 자식 생성 후 적용한다.
  applyProps(element, vnode.props);
  return element;
}
