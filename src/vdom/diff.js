function keyIndexes(children) {
  const indexes = new Map();
  for (const [index, child] of children.entries()) {
    const key = child.props?.key;
    if (key == null || indexes.has(key)) return null;
    indexes.set(key, index);
  }
  return indexes;
}

/** 순수 함수: DOM을 읽거나 VDOM을 변경하지 않는다. */
export function diff(previous, next) {
  const patches = [];
  function visit(a, b, path) {
    if (a.type !== b.type || (a.type === 'element' && a.tag !== b.tag)) {
      patches.push({ type: 'REPLACE', path, node: b });
      return;
    }
    if (a.type === 'text') {
      if (a.value !== b.value)
        patches.push({ type: 'TEXT', path, value: b.value });
      return;
    }
    const set = Object.create(null);
    const remove = Object.keys(a.props).filter((key) => !(key in b.props));
    for (const [key, value] of Object.entries(b.props)) {
      if (!Object.is(a.props[key], value)) set[key] = value;
    }
    let propsPatch;
    if (Object.keys(set).length || remove.length) {
      propsPatch = { type: 'PROPS', path, set, remove };
      patches.push(propsPatch);
    }
    const childStart = patches.length;
    const previousByKey = keyIndexes(a.children);
    const nextByKey = previousByKey && keyIndexes(b.children);
    if (nextByKey) {
      const reordered =
        a.children.length !== b.children.length ||
        b.children.some(
          (child, index) => previousByKey.get(child.props.key) !== index,
        );
      for (let i = a.children.length - 1; i >= 0; i--)
        if (!nextByKey.has(a.children[i].props.key))
          patches.push({ type: 'REMOVE', path: [...path, i] });
      // 삭제 후 다음 목록의 앞에서부터 삽입/이동한다.
      for (const [key, index] of nextByKey) {
        const previousIndex = previousByKey.get(key);
        if (previousIndex === undefined)
          patches.push({
            type: 'INSERT',
            path,
            index,
            node: b.children[index],
          });
        else if (reordered)
          patches.push({ type: 'MOVE', path: [...path, previousIndex], index });
      }
      // 교체가 필요해도 먼저 이동하고, 자식 변경은 이전 경로의 참조에 적용한다.
      for (const [key, index] of nextByKey) {
        const previousIndex = previousByKey.get(key);
        if (previousIndex !== undefined)
          visit(a.children[previousIndex], b.children[index], [
            ...path,
            previousIndex,
          ]);
      }
    } else {
      const common = Math.min(a.children.length, b.children.length);
      for (let i = 0; i < common; i++)
        visit(a.children[i], b.children[i], [...path, i]);
      for (let i = a.children.length - 1; i >= common; i--)
        patches.push({ type: 'REMOVE', path: [...path, i] });
      for (let i = common; i < b.children.length; i++)
        patches.push({ type: 'INSERT', path, index: i, node: b.children[i] });
    }
    // option 구조가 바뀌면 value가 같아도 현재 선택을 다시 동기화한다.
    if (
      b.tag === 'select' &&
      'value' in b.props &&
      patches.length > childStart
    ) {
      if (!propsPatch) {
        propsPatch = { type: 'PROPS', path, set, remove };
        patches.push(propsPatch);
      }
      propsPatch.set.value = b.props.value;
    }
  }
  visit(previous, next, []);
  return patches;
}
