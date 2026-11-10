/**
 * HTML 요소/텍스트 지원. 공백은 보존하고 주석은 제외한다.
 * @param {Node} node
 * @returns {import('./types.js').VNode}
 */
export function domToVNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return { type: 'text', value: node.nodeValue ?? '' };
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    throw new TypeError('domToVNode는 Element 또는 Text 노드만 지원합니다.');
  }

  const props = Object.create(null);
  for (const attribute of node.attributes) {
    Object.defineProperty(props, attribute.name, {
      value: attribute.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  const children = [];
  for (const child of node.childNodes) {
    if (child.nodeType === Node.COMMENT_NODE) continue;
    children.push(domToVNode(child));
  }
  const vnode = {
    type: 'element',
    tag: node.tagName.toLowerCase(),
    props,
    children,
  };
  if (Object.hasOwn(props, 'data-key')) vnode.key = props['data-key'];
  return vnode;
}
