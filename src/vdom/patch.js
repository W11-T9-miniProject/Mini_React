/**
 * 수정 전 기존 대상 참조 확보. 자식 삭제 후 다음 index 순서로 삽입한다.
 * 부모 교체/삭제의 하위 Patch는 Diff에서 생성하지 않는다.
 * 호출자는 반환값으로 루트 참조를 갱신한다.
 * @param {Node} root
 * @param {import('./types.js').Patch[]} patches
 * @returns {Node}
 */
export function patch(root, patches) {
  throw new Error('TODO: patch 구현');
}
