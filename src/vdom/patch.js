import { render } from './render.js';
import { applyProps } from './dom-properties.js';
const children = (node) =>
  Array.from(node.childNodes).filter(
    (n) => n.nodeType === 1 || n.nodeType === 3,
  );

/** 경로는 변경 전 트리 기준. 대상 참조를 먼저 확보한 뒤 DOM을 수정한다. */
export function patch(root, patches) {
  const childSnapshots = new Map();
  function originalChildren(node) {
    if (!childSnapshots.has(node)) childSnapshots.set(node, children(node));
    return childSnapshots.get(node);
  }
  const targets = patches.map((change) => {
    const target = change.path.reduce(
      (node, index) => node && originalChildren(node)[index],
      root,
    );
    if (!target)
      throw new Error('Patch 대상 경로가 없습니다: ' + change.path.join('.'));
    return { change, target };
  });

  const properties = [];
  for (const { change, target } of targets) {
    switch (change.type) {
      case 'TEXT':
        target.nodeValue = change.value;
        break;
      case 'PROPS':
        properties.push({ target, change });
        break;
      case 'REMOVE':
        target.remove();
        break;
      case 'INSERT':
        // A live HTMLCollection keeps append-heavy element lists O(1) per insert.
        // Mixed text/comment children still use the VDOM child-index contract.
        target.insertBefore(
          render(change.node),
          target.children.length === target.childNodes.length
            ? (target.children[change.index] ?? null)
            : (children(target)[change.index] ?? null),
        );
        break;
      case 'MOVE': {
        const parent = target.parentNode;
        const siblings = children(parent);
        if (siblings[change.index] === target) break;
        const others = siblings.filter((node) => node !== target);
        parent.insertBefore(target, others[change.index] ?? null);
        break;
      }
      case 'REPLACE': {
        const replacement = render(change.node);
        target.replaceWith(replacement);
        if (target === root) root = replacement;
        break;
      }
      default:
        throw new Error('알 수 없는 Patch: ' + change.type);
    }
  }
  // 자식 option 프로퍼티까지 먼저 적용하고 부모 select의 value를 마지막에 설정한다.
  for (const { target, change } of properties.sort(
    (a, b) => b.change.path.length - a.change.path.length,
  ))
    applyProps(target, change.set, change.remove);
  return root;
}
