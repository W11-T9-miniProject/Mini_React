const pathKey = (path) => JSON.stringify(path);
const priority = ['REPLACE', 'TEXT', 'PROPS', 'MOVE'];
const descriptions = {
  same: '달라진 명령 없음 · 같은 노드를 유지해요.',
  TEXT: '글자만 달라요 · 실제 Text 객체의 값만 바꿔요.',
  PROPS: '속성이나 이벤트가 달라요 · 실제 DOM 객체를 유지해요.',
  REPLACE: '노드 종류가 달라요 · 하위 트리와 함께 교체해요.',
  INSERT: '새 노드예요 · 하위 트리와 함께 추가해요.',
  REMOVE: '다음 트리에 없어요 · 하위 트리와 함께 제거해요.',
  MOVE: '같은 key의 노드예요 · 기존 DOM 객체를 이동해요.',
};

// Match exactly the engine's sibling policy, including empty child lists.
function keyIndexes(children) {
  const result = new Map();
  for (const [index, child] of children.entries()) {
    const key = child.props?.key;
    if (key == null || result.has(key)) return null;
    result.set(key, index);
  }
  return result;
}

/**
 * Explain an existing Diff result without running Diff, touching DOM, or
 * mutating either snapshot. `patches` on each event contains indexes into the
 * supplied command array; the visible kind is only its highest-priority badge.
 */
export function buildDiffTrace(previous, next, patches = []) {
  const byOldPath = new Map();
  const insertions = new Map();
  patches.forEach((change, index) => {
    const target =
      change.type === 'INSERT'
        ? `${pathKey(change.path)}:${change.index}`
        : pathKey(change.path);
    const map = change.type === 'INSERT' ? insertions : byOldPath;
    if (!map.has(target)) map.set(target, []);
    map.get(target).push(index);
  });
  const trace = [];
  function add(oldPath, newPath, kind, indexes) {
    trace.push({
      oldPath: oldPath === null ? null : [...oldPath],
      newPath: newPath === null ? null : [...newPath],
      kind,
      label: descriptions[kind],
      patches: [...indexes],
    });
  }
  function insert(oldParentPath, newPath) {
    const indexes =
      insertions.get(`${pathKey(oldParentPath)}:${newPath.at(-1)}`) || [];
    add(null, newPath, 'INSERT', indexes);
  }
  function remove(oldPath) {
    const indexes = (byOldPath.get(pathKey(oldPath)) || []).filter(
      (index) => patches[index].type === 'REMOVE',
    );
    add(oldPath, null, 'REMOVE', indexes);
  }
  function visit(a, b, oldPath, newPath) {
    const indexes = (byOldPath.get(pathKey(oldPath)) || []).filter(
      (index) => patches[index].type !== 'REMOVE',
    );
    const kind =
      priority.find((type) =>
        indexes.some((index) => patches[index].type === type),
      ) || 'same';
    add(oldPath, newPath, kind, indexes);
    if (
      kind === 'REPLACE' ||
      a.type !== b.type ||
      a.type === 'text' ||
      a.tag !== b.tag
    )
      return;
    const ac = a.children || [],
      bc = b.children || [],
      oldKeys = keyIndexes(ac),
      newKeys = oldKeys && keyIndexes(bc);
    if (newKeys) {
      for (let index = ac.length - 1; index >= 0; index--)
        if (!newKeys.has(ac[index].props.key)) remove([...oldPath, index]);
      for (const [key, newIndex] of newKeys) {
        const oldIndex = oldKeys.get(key);
        if (oldIndex === undefined) insert(oldPath, [...newPath, newIndex]);
        else
          visit(
            ac[oldIndex],
            bc[newIndex],
            [...oldPath, oldIndex],
            [...newPath, newIndex],
          );
      }
    } else {
      const common = Math.min(ac.length, bc.length);
      for (let index = 0; index < common; index++)
        visit(ac[index], bc[index], [...oldPath, index], [...newPath, index]);
      for (let index = ac.length - 1; index >= common; index--)
        remove([...oldPath, index]);
      for (let index = common; index < bc.length; index++)
        insert(oldPath, [...newPath, index]);
    }
  }
  if (previous && next) visit(previous, next, [], []);
  else if (next) add(null, [], 'INSERT', []);
  else if (previous) add([], null, 'REMOVE', []);
  return trace;
}
