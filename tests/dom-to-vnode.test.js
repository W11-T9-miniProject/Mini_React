import { describe, expect, it } from 'vitest';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';

describe('dom-to-vnode', () => {
  it('텍스트 노드를 글자 내용을 담은 VNode로 변환한다', () => {
    const node = document.createTextNode('안녕하세요');

    expect(domToVNode(node)).toEqual({
      type: 'text',
      value: '안녕하세요',
    });
  });

  it('중첩 요소와 속성을 변환한다', () => {
    const element = document.createElement('p');
    element.setAttribute('class', 'greeting');
    element.innerHTML = '<span>안녕하세요</span>';

    expect(domToVNode(element)).toEqual({
      type: 'element',
      tag: 'p',
      props: { class: 'greeting' },
      children: [
        {
          type: 'element',
          tag: 'span',
          props: {},
          children: [{ type: 'text', value: '안녕하세요' }],
        },
      ],
    });
  });
  it('글자 주변 공백과 공백만 있는 텍스트 노드를 보존한다', () => {
    const element = document.createElement('p');
    element.innerHTML = ' \n<span> 안녕 </span>\t';

    expect(domToVNode(element).children).toEqual([
      { type: 'text', value: ' \n' },
      {
        type: 'element',
        tag: 'span',
        props: {},
        children: [{ type: 'text', value: ' 안녕 ' }],
      },
      { type: 'text', value: '\t' },
    ]);
  });

  it('각 요소의 자식에서 주석만 제외한다', () => {
    const element = document.createElement('p');
    element.innerHTML =
      '<!-- 앞 --><span> 안녕<!-- 메모 --> </span><!-- 뒤 -->';

    expect(domToVNode(element).children).toEqual([
      {
        type: 'element',
        tag: 'span',
        props: {},
        children: [
          { type: 'text', value: ' 안녕' },
          { type: 'text', value: ' ' },
        ],
      },
    ]);
  });
});
