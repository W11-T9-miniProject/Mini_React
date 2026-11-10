import { render, getRenderedKey } from './render.js';
import { applyProps } from './dom-properties.js';

/**
 * Patch를 적용하고 최신 루트를 반환한다. `onPatched`는 모든 DOM 변경 뒤 호출된다.
 * @param {Node} root
 * @param {import('./types.js').Patch[]} patches
 * @param {{ onPatched?: (entry: {patch: object, node: Node}) => void }} [options]
 * @returns {Node}
 */
export function patch(root, patches, options = {}) {
  if (patches.length === 0) return root;
  const appliedTargets = [];
  const locate = (path) => {
    let node = root;
    for (const index of path) {
      const children = [...node.childNodes].filter(
        (child) => child.nodeType !== Node.COMMENT_NODE,
      );
      node = children[index];
      if (!node)
        throw new RangeError(
          `Patch 경로를 찾을 수 없습니다: ${path.join('.')}`,
        );
    }
    return node;
  };

  // 상위 목록을 먼저 재정렬하면 이후 하위 경로는 next 트리 인덱스와 맞는다.
  const reorders = patches
    .filter((item) => item.type === 'REORDER')
    .sort((left, right) => left.path.length - right.path.length);
  for (const item of reorders) {
    const parent = locate(item.path);
    const current = [...parent.childNodes].filter(
      (child) => child.nodeType !== Node.COMMENT_NODE,
    );
    const existing = new Map();
    for (const child of current) {
      const key = getRenderedKey(child);
      if (key === undefined)
        throw new TypeError('REORDER 대상 DOM 자식에 key가 없습니다.');
      const normalized = String(key);
      if (existing.has(normalized))
        throw new TypeError(`중복된 DOM key입니다: ${normalized}`);
      existing.set(normalized, child);
    }

    const nextKeys = new Set(item.children.map(({ key }) => String(key)));
    for (const [key, child] of existing) {
      if (!nextKeys.has(key)) parent.removeChild(child);
    }
    const nextNodes = item.children.map(({ key, node }) => {
      const normalized = String(key);
      let child = existing.get(normalized);
      if (!child) {
        child = render(node);
        existing.set(normalized, child);
      }
      return child;
    });
    const nextVNodeSibling = (node) => {
      let sibling = node.nextSibling;
      while (sibling?.nodeType === Node.COMMENT_NODE)
        sibling = sibling.nextSibling;
      return sibling;
    };
    let reference = null;
    for (let index = nextNodes.length - 1; index >= 0; index -= 1) {
      const node = nextNodes[index];
      if (nextVNodeSibling(node) !== reference) {
        parent.insertBefore(node, reference);
      }
      reference = node;
    }
    appliedTargets.push({ patch: item, node: parent });
  }

  const replacements = new Map();
  const removals = new Map();
  const insertions = new Map();
  const direct = [];
  for (const item of patches) {
    if (item.type === 'REORDER') continue;
    if (item.type === 'REPLACE' && item.path.length === 0) {
      const nextRoot = render(item.node);
      if (root.parentNode) root.parentNode.replaceChild(nextRoot, root);
      root = nextRoot;
      appliedTargets.push({ patch: item, node: root });
      continue;
    }
    if (item.type === 'REMOVE' && item.path.length === 0)
      throw new TypeError('루트 노드는 제거할 수 없습니다.');
    if (item.type === 'REPLACE') {
      replacements.set(item.path.join('/'), {
        item,
        node: locate(item.path),
        vnode: item.node,
      });
    } else if (item.type === 'REMOVE') {
      const parent = locate(item.path.slice(0, -1));
      const parentKey = item.path.slice(0, -1).join('/');
      if (!removals.has(parentKey))
        removals.set(parentKey, { parent, items: [] });
      removals.get(parentKey).items.push(item);
    } else if (item.type === 'INSERT') {
      const parentKey = item.path.join('/');
      if (!insertions.has(parentKey))
        insertions.set(parentKey, { parent: locate(item.path), items: [] });
      insertions.get(parentKey).items.push(item);
    } else direct.push(item);
  }

  // 기존 노드 참조는 구조 변경 전에 모두 확보한다.
  const directTargets = direct.map((item) => ({
    item,
    node: locate(item.path),
  }));
  for (const { item, node } of directTargets) {
    if (item.type === 'TEXT') node.nodeValue = item.value;
    if (item.type === 'PROPS') applyProps(node, item.set, item.remove);
    appliedTargets.push({ patch: item, node });
  }
  for (const { item, node, vnode } of replacements.values()) {
    const replacement = render(vnode);
    node.parentNode.replaceChild(replacement, node);
    appliedTargets.push({ patch: item, node: replacement });
  }
  for (const { parent, items } of removals.values()) {
    const children = [...parent.childNodes].filter(
      (child) => child.nodeType !== Node.COMMENT_NODE,
    );
    for (const item of items.sort(
      (left, right) => right.path.at(-1) - left.path.at(-1),
    )) {
      parent.removeChild(children[item.path.at(-1)]);
      appliedTargets.push({ patch: item, node: parent });
    }
  }
  for (const { parent, items } of insertions.values()) {
    for (const item of items.sort((left, right) => left.index - right.index)) {
      const children = [...parent.childNodes].filter(
        (child) => child.nodeType !== Node.COMMENT_NODE,
      );
      const inserted = render(item.node);
      parent.insertBefore(inserted, children[item.index] ?? null);
      appliedTargets.push({ patch: item, node: inserted });
    }
  }

  if (typeof options.onPatched === 'function') {
    const errors = [];
    for (const entry of appliedTargets) {
      try {
        options.onPatched(entry);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, 'Patch 후처리 중 오류가 발생했습니다.');
  }
  return root;
}
