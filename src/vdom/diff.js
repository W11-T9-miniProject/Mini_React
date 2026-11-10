/**
 * DOM에 접근하지 않고 입력 VDOM도 수정하지 않는다.
 * @param {import('./types.js').VNode} previous
 * @param {import('./types.js').VNode} next
 * @returns {import('./types.js').Patch[]}
 */
export function diff(previous, next) {
  const patches = [];
  const keyOf = (node) => {
    if (
      !Object.hasOwn(node, 'key') ||
      (typeof node.key !== 'string' && typeof node.key !== 'number') ||
      node.key === '' ||
      (typeof node.key === 'number' && !Number.isFinite(node.key))
    ) {
      throw new TypeError(
        'key는 비어 있지 않은 문자열 또는 유한 숫자여야 합니다.',
      );
    }
    return String(node.key);
  };
  const keyedChildren = (children) => {
    if (!children.every((child) => child.type === 'element')) return null;
    if (!children.every((child) => Object.hasOwn(child, 'key'))) return null;
    const byKey = new Map();
    for (const child of children) {
      const key = keyOf(child);
      if (byKey.has(key)) throw new TypeError(`중복된 형제 key입니다: ${key}`);
      byKey.set(key, child);
    }
    return byKey;
  };
  const validateKeys = (node) => {
    if (node.type !== 'element') return;
    keyedChildren(node.children);
    for (const child of node.children) validateKeys(child);
  };
  validateKeys(previous);
  validateKeys(next);
  const equalityCache = new WeakMap();
  const same = (left, right) => {
    let matches = equalityCache.get(left);
    if (matches?.has(right)) return matches.get(right);
    if (!matches) {
      matches = new WeakMap();
      equalityCache.set(left, matches);
    }
    if (left.type !== right.type) return false;
    if (left.key !== right.key) return false;
    if (left.type === 'text') {
      const result = left.value === right.value;
      matches.set(right, result);
      return result;
    }
    if (left.tag !== right.tag) {
      matches.set(right, false);
      return false;
    }
    const keys = Object.keys(left.props);
    if (
      keys.length !== Object.keys(right.props).length ||
      keys.some(
        (key) =>
          !Object.hasOwn(right.props, key) ||
          left.props[key] !== right.props[key],
      )
    ) {
      matches.set(right, false);
      return false;
    }
    const result =
      left.children.length === right.children.length &&
      left.children.every((child, index) => same(child, right.children[index]));
    matches.set(right, result);
    return result;
  };
  const walk = (oldNode, newNode, path) => {
    if (!oldNode) {
      patches.push({
        type: 'INSERT',
        path: path.slice(0, -1),
        index: path.at(-1),
        node: newNode,
      });
      return;
    }
    if (!newNode) {
      patches.push({ type: 'REMOVE', path });
      return;
    }
    if (
      oldNode.type !== newNode.type ||
      (oldNode.type === 'element' && oldNode.tag !== newNode.tag)
    ) {
      patches.push({ type: 'REPLACE', path, node: newNode });
      return;
    }
    if (oldNode.type === 'text') {
      if (oldNode.value !== newNode.value)
        patches.push({ type: 'TEXT', path, value: newNode.value });
      return;
    }

    const set = Object.create(null);
    for (const key of Object.keys(newNode.props)) {
      if (
        !Object.hasOwn(oldNode.props, key) ||
        oldNode.props[key] !== newNode.props[key]
      )
        set[key] = newNode.props[key];
    }
    const remove = Object.keys(oldNode.props).filter(
      (key) => !Object.hasOwn(newNode.props, key),
    );
    if (Object.keys(set).length || remove.length)
      patches.push({ type: 'PROPS', path, set, remove });

    const oldKeyed = keyedChildren(oldNode.children);
    const nextKeyed = keyedChildren(newNode.children);
    if (oldKeyed && nextKeyed) {
      const sameOrder =
        oldNode.children.length === newNode.children.length &&
        oldNode.children.every(
          (child, index) => keyOf(child) === keyOf(newNode.children[index]),
        );
      if (!sameOrder) {
        patches.push({
          type: 'REORDER',
          path,
          children: newNode.children.map((node) => ({
            key: node.key,
            node,
          })),
        });
      }
      for (let index = 0; index < newNode.children.length; index += 1) {
        const newChild = newNode.children[index];
        const oldChild = oldKeyed.get(keyOf(newChild));
        if (oldChild) walk(oldChild, newChild, [...path, index]);
      }
      return;
    }

    let prefix = 0;
    while (
      prefix < Math.min(oldNode.children.length, newNode.children.length) &&
      same(oldNode.children[prefix], newNode.children[prefix])
    )
      prefix += 1;
    if (newNode.children.length === oldNode.children.length + 1) {
      const suffixMatches = oldNode.children
        .slice(prefix)
        .every((child, offset) =>
          same(child, newNode.children[prefix + offset + 1]),
        );
      if (suffixMatches) {
        patches.push({
          type: 'INSERT',
          path,
          index: prefix,
          node: newNode.children[prefix],
        });
        return;
      }
    }
    if (oldNode.children.length === newNode.children.length + 1) {
      const suffixMatches = newNode.children
        .slice(prefix)
        .every((child, offset) =>
          same(oldNode.children[prefix + offset + 1], child),
        );
      if (suffixMatches) {
        patches.push({ type: 'REMOVE', path: [...path, prefix] });
        return;
      }
    }

    const commonLength = Math.min(
      oldNode.children.length,
      newNode.children.length,
    );
    for (let index = 0; index < commonLength; index += 1)
      walk(oldNode.children[index], newNode.children[index], [...path, index]);
    for (
      let index = oldNode.children.length - 1;
      index >= newNode.children.length;
      index -= 1
    ) {
      patches.push({ type: 'REMOVE', path: [...path, index] });
    }
    for (
      let index = commonLength;
      index < newNode.children.length;
      index += 1
    ) {
      patches.push({
        type: 'INSERT',
        path,
        index,
        node: newNode.children[index],
      });
    }
  };
  walk(previous, next, []);
  return patches;
}
