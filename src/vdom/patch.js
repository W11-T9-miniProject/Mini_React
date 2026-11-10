import { applyProps } from './dom-properties.js';
import { vnodeToDom } from './vnode-to-dom.js';

/**
 * 수정 전 기존 대상 참조 확보. 자식 삭제·수정 후 다음 index 순서로 삽입·이동한다.
 * 부모 교체/삭제의 하위 Patch는 Diff에서 생성하지 않는다.
 * 호출자는 반환값으로 루트 참조를 갱신한다.
 * @param {Node} root
 * @param {import('./types.js').Patch[]} patches
 * @returns {Node}
 */
export function patch(root, patches) {
  const targets = patches.map((change) => findNode(root, change.path));
  const parents = targets.map((target) => target.parentNode);
  const insertions = [];
  const replacements = new Map();

  for (let index = 0; index < patches.length; index += 1) {
    if (patches[index].type === 'REMOVE') {
      const target = targets[index];
      target.parentNode.removeChild(target);
    }
  }

  for (let index = 0; index < patches.length; index += 1) {
    const change = patches[index];
    const target = targets[index];

    if (change.type === 'REMOVE') {
      continue;
    }

    if (change.type === 'INSERT') {
      insertions.push({ change, parent: target });
      continue;
    }

    if (change.type === 'MOVE') {
      insertions.push({ change, parent: parents[index], target });
      continue;
    }

    if (change.type === 'TEXT') {
      target.textContent = change.value;
      continue;
    }

    if (change.type === 'PROPS') {
      applyProps(target, change.set, change.remove);
      continue;
    }

    if (change.type === 'REPLACE') {
      const replacement = vnodeToDom(change.node);
      replacements.set(target, replacement);

      if (target.parentNode) {
        target.parentNode.replaceChild(replacement, target);
      }

      if (target === root) {
        root = replacement;
      }

      continue;
    }

    throw new Error(`지원하지 않는 변경 명령: ${change.type}`);
  }

  insertions.sort((a, b) => a.change.index - b.change.index);
  for (const { change, parent, target } of insertions) {
    const children = Array.from(parent.childNodes).filter(
      (child) => child.nodeType !== Node.COMMENT_NODE,
    );
    const node =
      change.type === 'MOVE'
        ? (replacements.get(target) ?? target)
        : vnodeToDom(change.node);
    if (change.type === 'MOVE' && children[change.index] === node) continue;
    const reference =
      children.filter((child) => child !== node)[change.index] ?? null;
    parent.insertBefore(node, reference);
  }

  return root;
}

function findNode(root, path) {
  let node = root;

  for (const index of path) {
    const children = Array.from(node.childNodes).filter(
      (child) => child.nodeType !== Node.COMMENT_NODE,
    );
    node = children[index];

    if (!node) {
      throw new Error(`DOM 경로를 찾을 수 없습니다: ${path.join(',')}`);
    }
  }

  return node;
}
