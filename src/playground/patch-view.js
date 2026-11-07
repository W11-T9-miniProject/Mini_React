export function describePatches(patches) {
  return JSON.stringify(
    patches,
    (key, value) => (typeof value === 'function' ? '[event handler]' : value),
    2,
  );
}
export function showPatches(element, patches) {
  element.textContent = patches.length
    ? describePatches(patches)
    : '변경 없음 — 기존 DOM을 유지합니다.';
}
