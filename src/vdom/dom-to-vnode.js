/** 브라우저의 현재 DOM을 데이터로 읽는다. 공백은 보존하고 주석은 제외한다. */
export function domToVNode(node) {
  if (node.nodeType === 3) return { type: 'text', value: node.nodeValue ?? '' };
  if (node.nodeType !== 1)
    throw new TypeError('요소 또는 텍스트 노드만 변환할 수 있습니다.');
  const props = Object.fromEntries(
    Array.from(node.attributes, (a) => [a.name, a.value]),
  );
  if (node.tagName === 'INPUT') {
    props.value = node.value;
    if (['checkbox', 'radio'].includes(node.type)) props.checked = node.checked;
  }
  if (node.tagName === 'TEXTAREA') props.value = node.value;
  if (node.tagName === 'SELECT') props.value = node.value;
  return {
    type: 'element',
    tag: node.localName,
    props,
    children: Array.from(node.childNodes)
      .filter((n) => n.nodeType === 1 || n.nodeType === 3)
      .map(domToVNode),
  };
}
