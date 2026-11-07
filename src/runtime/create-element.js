import { context } from './context.js';
export function h(tag, props = {}, ...children) {
  props ??= {};
  const normalized = children
    .flat(Infinity)
    .filter((v) => v != null && typeof v !== 'boolean')
    .map((v) =>
      typeof v === 'object' ? v : { type: 'text', value: String(v) },
    );
  if (typeof tag === 'function') {
    context.childDepth++;
    try {
      return tag({ ...props, children: normalized });
    } finally {
      context.childDepth--;
    }
  }
  if (typeof tag !== 'string')
    throw new TypeError('태그 또는 함수형 컴포넌트가 필요합니다.');
  return { type: 'element', tag, props, children: normalized };
}
