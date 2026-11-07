/**
 * HTML 요소/텍스트 지원. 공백은 보존하고 주석은 제외한다.
 * @param {Node} node
 * @returns {import('./types.js').VNode}
 */
export function domToVNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return {
      type: 'text',
      value: node.textContent,
    };
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const props = Object.fromEntries(
      Array.from(node.attributes, (attribute) => [
        attribute.name,
        attribute.value,
      ]),
    );
    const children = Array.from(node.childNodes)
      .filter((child) => child.nodeType !== Node.COMMENT_NODE)
      .map((child) => domToVNode(child));

    return {
      type: 'element',
      tag: node.localName,
      props,
      children,
    };
  }

  throw new Error('TODO: 텍스트와 요소 이외의 노드 처리');
}
