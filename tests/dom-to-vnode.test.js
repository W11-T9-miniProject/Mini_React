import { describe, it, expect } from 'vitest';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';

describe('dom-to-vnode', () => {
  it('중첩 요소와 문자열 속성을 변환한다', () => {
    const element = document.createElement('div');
    element.setAttribute('id', 'one');
    element.innerHTML = '<span>안녕</span>';
    expect(domToVNode(element)).toEqual({
      type: 'element',
      tag: 'div',
      props: { id: 'one' },
      children: [
        {
          type: 'element',
          tag: 'span',
          props: {},
          children: [{ type: 'text', value: '안녕' }],
        },
      ],
    });
  });
  it('공백 텍스트를 보존하고 주석을 제외하며 __proto__ 속성을 보존한다', () => {
    const element = document.createElement('div');
    element.append(document.createTextNode(' '), document.createComment('x'));
    element.setAttribute('__proto__', 'safe');
    const vnode = domToVNode(element);
    expect(vnode.children).toEqual([{ type: 'text', value: ' ' }]);
    expect(Object.hasOwn(vnode.props, '__proto__')).toBe(true);
    expect(vnode.props.__proto__).toBe('safe');
  });

  it('data-key를 key로 읽되 일반 data-key 속성도 보존한다', () => {
    const element = document.createElement('li');
    element.setAttribute('data-key', 'item-1');
    element.textContent = 'first';

    expect(domToVNode(element)).toEqual({
      type: 'element',
      tag: 'li',
      key: 'item-1',
      props: { 'data-key': 'item-1' },
      children: [{ type: 'text', value: 'first' }],
    });
  });

  it('빈 data-key를 가진 요소도 빈 문자열 key로 보존한다', () => {
    const element = document.createElement('li');
    element.setAttribute('data-key', '');

    expect(domToVNode(element)).toHaveProperty('key', '');
  });
});
