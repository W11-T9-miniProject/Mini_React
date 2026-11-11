const events = new WeakMap();
const booleanProps = new Set([
  'checked',
  'disabled',
  'selected',
  'multiple',
  'required',
  'readOnly',
  'autofocus',
]);
function eventName(key) {
  return /^on[A-Z]/.test(key) ? key.slice(2).toLowerCase() : null;
}

/** 이벤트는 동일 노드에서 교체한다. input 값이 같으면 재대입하지 않아 커서를 보존한다. */
export function applyProps(element, set, remove = []) {
  const listeners = events.get(element) ?? new Map();
  events.set(element, listeners);
  function apply(key, value) {
    const event = eventName(key);
    if (event) {
      if (listeners.has(key))
        element.removeEventListener(event, listeners.get(key));
      listeners.delete(key);
      if (typeof value === 'function') {
        element.addEventListener(event, value);
        listeners.set(key, value);
      }
      return;
    }
    if (key === 'key') return;
    const attribute = key === 'className' ? 'class' : key;
    if (key === 'value' && 'value' in element) {
      const next = value == null ? '' : String(value);
      if (element.value !== next) element.value = next;
      if (
        element.localName === 'input' &&
        element.type !== 'file' &&
        value != null &&
        element.getAttribute('value') !== next
      )
        element.setAttribute('value', next);
      if (value == null) element.removeAttribute('value');
      return;
    }
    if (booleanProps.has(key)) {
      const enabled = value != null && value !== false;
      element[key] = enabled;
      if (enabled) element.setAttribute(attribute, '');
      else element.removeAttribute(attribute);
      return;
    }
    if (value == null || value === false) element.removeAttribute(attribute);
    else element.setAttribute(attribute, String(value));
  }
  remove.forEach((key) => apply(key, null));
  Object.entries(set).forEach(([key, value]) => apply(key, value));
}
