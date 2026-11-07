export function showPatches(patches) {
  document.querySelector('#patch-output').textContent = JSON.stringify(
    patches,
    null,
    2,
  );
}
