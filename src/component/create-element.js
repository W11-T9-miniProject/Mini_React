import { withoutHooks } from './hooks.js';

const isEventProp = (name) => /^on[a-z]+$/i.test(name);
const isValidPropName = (name) =>
  name.length > 0 && !/[\u0000\u0009-\u000D /<>"'=]/.test(name);
const isValidTagName = (name) => /^[A-Za-z][A-Za-z0-9._:-]*$/.test(name);

function isVNode(value, ancestors = new WeakSet()) {
  if (!value || typeof value !== 'object') return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);

  let valid = false;
  if (value.type === 'text') {
    valid = typeof value.value === 'string';
  } else if (
    value.type === 'element' &&
    typeof value.tag === 'string' &&
    isValidTagName(value.tag) &&
    value.props !== null &&
    typeof value.props === 'object' &&
    !Array.isArray(value.props) &&
    Array.isArray(value.children)
  ) {
    valid = Object.keys(value.props).every((name) => {
      const propValue = value.props[name];
      if (!isValidPropName(name)) return false;
      return isEventProp(name)
        ? typeof propValue === 'function'
        : typeof propValue === 'string';
    });
    if (valid) {
      valid = value.children.every((child) => isVNode(child, ancestors));
    }
  }

  ancestors.delete(value);
  return valid;
}

function appendChildren(children, value) {
  if (value === null || value === undefined || typeof value === 'boolean')
    return;
  if (Array.isArray(value)) {
    for (const child of value) appendChildren(children, child);
    return;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    children.push({ type: 'text', value: String(value) });
    return;
  }
  if (isVNode(value)) {
    children.push(value);
    return;
  }
  throw new TypeError('자식은 VNode, 문자열, 숫자 또는 배열이어야 합니다.');
}

export function assertVNode(value) {
  if (!isVNode(value)) {
    throw new TypeError('컴포넌트는 유효한 VNode를 반환해야 합니다.');
  }
  return value;
}

/** 요소 VNode를 만든다. 일반 속성 값은 문자열/숫자, 이벤트 prop은 함수다. */
export function h(tag, props, ...childValues) {
  if (typeof tag !== 'string' || !isValidTagName(tag.trim())) {
    throw new TypeError('요소 tag는 유효한 HTML 태그 이름이어야 합니다.');
  }

  if (
    props !== null &&
    props !== undefined &&
    (typeof props !== 'object' || Array.isArray(props) || isVNode(props))
  ) {
    childValues.unshift(props);
    props = {};
  }
  props ??= {};
  if (typeof props !== 'object' || Array.isArray(props)) {
    throw new TypeError('요소 props는 객체여야 합니다.');
  }

  const copiedProps = {};
  let key;
  for (const name of Object.keys(props)) {
    if (name === 'key') {
      key = props[name];
      if (
        (typeof key !== 'string' && typeof key !== 'number') ||
        key === '' ||
        (typeof key === 'number' && !Number.isFinite(key))
      ) {
        throw new TypeError(
          'key는 비어 있지 않은 문자열 또는 유한 숫자여야 합니다.',
        );
      }
      continue;
    }
    if (!isValidPropName(name)) {
      throw new TypeError(`올바르지 않은 속성 이름입니다: ${name}`);
    }
    const value = props[name];
    if (value === null || value === undefined) continue;
    if (isEventProp(name)) {
      if (typeof value !== 'function') {
        throw new TypeError(`${name} 이벤트 prop 값은 함수여야 합니다.`);
      }
      Object.defineProperty(copiedProps, name, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    } else if (typeof value === 'string' || typeof value === 'number') {
      Object.defineProperty(copiedProps, name, {
        value: String(value),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    } else {
      throw new TypeError(
        `일반 속성 ${name}의 값은 문자열 또는 숫자여야 합니다.`,
      );
    }
  }

  const children = [];
  for (const child of childValues) appendChildren(children, child);
  return {
    type: 'element',
    tag: tag.trim().toLowerCase(),
    ...(key === undefined ? {} : { key }),
    props: copiedProps,
    children,
  };
}

/** Hooks 없는 자식 함수를 props로 실행한다. */
export function renderChild(component, props = {}) {
  if (typeof component !== 'function') {
    throw new TypeError('자식 컴포넌트는 함수여야 합니다.');
  }
  return assertVNode(withoutHooks(() => component(props)));
}
