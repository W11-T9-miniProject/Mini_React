/**
 * Render와 Patch가 공유하는 HTML 속성 및 이벤트 처리.
 * @param {Element} element
 * @param {Record<string, string | Function>} set
 * @param {string[]} remove
 */
const listenersByElement = new WeakMap();
const isEventProp = (name) => /^on[a-z]+$/i.test(name);

function eventNameFromProp(name) {
  return name.slice(2).toLowerCase();
}

function removeEventListenerForProp(element, name) {
  const listeners = listenersByElement.get(element);
  const listener = listeners?.get(name);
  if (!listener) return false;
  element.removeEventListener(eventNameFromProp(name), listener);
  listeners.delete(name);
  return true;
}

export function applyProps(element, set, remove = []) {
  for (const name of remove) {
    if (!isEventProp(name) || !removeEventListenerForProp(element, name)) {
      element.removeAttribute(name);
    }
  }
  for (const name of Object.keys(set)) {
    if (isEventProp(name)) {
      const handler = set[name];
      if (typeof handler !== 'function') {
        throw new TypeError(`${name} 이벤트 prop 값은 함수여야 합니다.`);
      }
      removeEventListenerForProp(element, name);
      element.addEventListener(eventNameFromProp(name), handler);
      let listeners = listenersByElement.get(element);
      if (!listeners) {
        listeners = new Map();
        listenersByElement.set(element, listeners);
      }
      listeners.set(name, handler);
    } else {
      element.setAttribute(name, set[name]);
    }
  }
}
