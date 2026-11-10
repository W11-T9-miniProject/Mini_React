import { vnodeKey, validateVNodeKeys } from './vnode-key.js';

/**
 * DOM에 접근하지 않고 입력 VDOM도 수정하지 않는다.
 * @param {import('./types.js').VNode} previous
 * @param {import('./types.js').VNode} next
 * @returns {import('./types.js').Patch[]}
 */
export function diff(previous, next) {
  validateVNodeKeys(previous);
  validateVNodeKeys(next);
  return compare(previous, next, []);
}

function compare(previous, next, path) {
  if (
    previous.type !== next.type ||
    vnodeKey(previous) !== vnodeKey(next) ||
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

    if (
      [...previous.children, ...next.children].some(
        (child) => vnodeKey(child) !== null,
      )
    ) {
      patches.push(
        ...compareKeyedChildren(previous.children, next.children, path),
      );
      return patches;
    }

    // 키 없는 자식 목록은 기존 위치 비교를 사용한다.
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

function compareKeyedChildren(previous, next, path) {
  const byKey = new Map();
  const unkeyed = [];
  previous.forEach((child, index) => {
    const key = vnodeKey(child);
    if (key === null) unkeyed.push(index);
    else byKey.set(key, index);
  });
  let unkeyedCursor = 0;
  const matches = next.map((child) => {
    const key = vnodeKey(child);
    return key === null ? unkeyed[unkeyedCursor++] : byKey.get(key);
  });
  const used = new Set(matches.filter((index) => index !== undefined));
  const patches = [];
  // 남아 있는 기존 자식의 순서를 연결해, 매번 목록 전체를 검색하지 않는다.
  const remaining = new Map();
  let head = null;
  let tail = null;
  previous.forEach((_, index) => {
    if (!used.has(index)) {
      patches.push({ type: 'REMOVE', path: [...path, index] });
      return;
    }
    remaining.set(index, { previous: tail, next: null });
    if (tail === null) head = index;
    else remaining.get(tail).next = index;
    tail = index;
  });

  next.forEach((child, index) => {
    const oldIndex = matches[index];
    if (oldIndex === undefined) {
      patches.push({ type: 'INSERT', path, index, node: child });
      return;
    }
    const childPath = [...path, oldIndex];
    patches.push(...compare(previous[oldIndex], child, childPath));
    if (head !== oldIndex)
      patches.push({ type: 'MOVE', path: childPath, index });
    const link = remaining.get(oldIndex);
    if (link.previous === null) head = link.next;
    else remaining.get(link.previous).next = link.next;
    if (link.next !== null) remaining.get(link.next).previous = link.previous;
    remaining.delete(oldIndex);
  });
  return patches;
}
