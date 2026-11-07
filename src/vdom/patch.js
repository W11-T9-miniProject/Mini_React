import { render } from './render.js';
import { applyProps } from './dom-properties.js';
const children = (node) =>
  Array.from(node.childNodes).filter(
    (n) => n.nodeType === 1 || n.nodeType === 3,
  );

/** 경로는 변경 전 트리 기준. 대상 참조를 먼저 확보한 뒤 DOM을 수정한다. */
export function patch(root, patches) {
  const targets = patches.map((change) => {
    const target = change.path.reduce(
      (node, index) => node && children(node)[index],
      root,
    );
    if (!target)
      throw new Error('Patch 대상 경로가 없습니다: ' + change.path.join('.'));
    return { change, target };
  });
  // select.value は option 子の更新後に適用する。
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
        target.insertBefore(
          render(change.node),
          children(target)[change.index] ?? null,
        );
        break;
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
