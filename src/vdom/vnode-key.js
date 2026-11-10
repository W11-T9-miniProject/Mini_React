/** data-key는 부모 안에서 항목을 식별한다. 키 없는 노드는 null을 반환한다. */
export function vnodeKey(vnode) {
  if (vnode.type !== 'element' || !Object.hasOwn(vnode.props, 'data-key'))
    return null;
  const key = vnode.props['data-key'];
  if (typeof key !== 'string' || key.trim() === '')
    throw new Error('data-key는 비어 있지 않은 문자열이어야 합니다.');
  return key;
}

/** 생성·변경 전에 트리 전체를 검사해 잘못된 키로 DOM을 일부만 바꾸지 않는다. */
export function validateVNodeKeys(vnode) {
  vnodeKey(vnode);
  if (vnode.type !== 'element') return;
  const keys = new Set();
  for (const child of vnode.children) {
    const key = vnodeKey(child);
    if (key !== null && keys.has(key))
      throw new Error(`같은 부모 안에서 data-key가 중복됐습니다: ${key}`);
    if (key !== null) keys.add(key);
    validateVNodeKeys(child);
  }
}
