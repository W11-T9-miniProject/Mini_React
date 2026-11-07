/**
 * DOM에 접근하지 않고 입력 VDOM도 수정하지 않는다.
 * @param {import('./types.js').VNode} previous
 * @param {import('./types.js').VNode} next
 * @returns {import('./types.js').Patch[]}
 */
export function diff(previous, next) {
  return compare(previous, next, []);
}

function compare(previous, next, path) {
  if (
    previous.type !== next.type ||
    (previous.type === 'element' && previous.tag !== next.tag)
  ) {
    return [{ type: 'REPLACE', path, node: next }];
  }

  if (previous.type === 'text' && next.type === 'text') {
    if (previous.value === next.value) {
      return [];
    }

    return [{ type: 'TEXT', path, value: next.value }];
  }

  if (
    previous.type === 'element' &&
    next.type === 'element' &&
    previous.tag === next.tag
  ) {
    const patches = [];
    const set = Object.fromEntries(
      Object.entries(next.props).filter(
        ([name, value]) => previous.props[name] !== value,
      ),
    );
    const remove = Object.keys(previous.props).filter(
      (name) => !Object.hasOwn(next.props, name),
    );

    if (Object.keys(set).length > 0 || remove.length > 0) {
      patches.push({ type: 'PROPS', path, set, remove });
    }

    // shortcut: 자식은 위치로 대응한다. 재정렬 시 노드 재사용이 필요하면 key 비교로 확장한다.
    const childCount = Math.max(previous.children.length, next.children.length);
    for (let index = 0; index < childCount; index += 1) {
      const childPath = [...path, index];
      const previousChild = previous.children[index];
      const nextChild = next.children[index];

      if (!previousChild) {
        patches.push({ type: 'INSERT', path, index, node: nextChild });
        continue;
      }

      if (!nextChild) {
        patches.push({ type: 'REMOVE', path: childPath });
        continue;
      }

      const childPatches = compare(previousChild, nextChild, childPath);
      patches.push(...childPatches);
    }

    return patches;
  }

  throw new Error('TODO: diff 구현');
}
