/**
 * vnodeToDom과 Patch의 공통 HTML 속성 처리.
 * @param {Element} element
 * @param {Record<string, string>} set
 * @param {string[]} remove
 */
export function applyProps(element, set, remove = []) {
  for (const name of remove) {
    element.removeAttribute(name);
  }

  for (const [name, value] of Object.entries(set)) {
    element.setAttribute(name, value);
  }
}
