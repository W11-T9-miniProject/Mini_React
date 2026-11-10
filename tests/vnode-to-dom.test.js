import { describe, expect, it } from 'vitest';
import { vnodeToDom } from '../src/vdom/vnode-to-dom.js';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';

describe('vnodeToDom', () => {
  it('텍스트 VDOM으로 페이지에 붙지 않은 텍스트 노드를 만든다', () => {
    const vnode = { type: 'text', value: '안녕하세요' };

    const node = vnodeToDom(vnode);

    expect(node.nodeType).toBe(Node.TEXT_NODE);
    expect(node.textContent).toBe('안녕하세요');
    expect(node.parentNode).toBeNull();
  });

  it('VDOM을 DOM으로 변환한 뒤 다시 읽으면 원래 VDOM과 같다', () => {
    const vnode = {
      type: 'element',
      tag: 'p',
      props: { class: 'greeting' },
      children: [
        { type: 'text', value: ' ' },
        {
          type: 'element',
          tag: 'span',
          props: { title: '인사' },
          children: [{ type: 'text', value: '안녕하세요' }],
        },
      ],
    };

    const node = vnodeToDom(vnode);

    expect(node.localName).toBe('p');
    expect(node.getAttribute('class')).toBe('greeting');
    expect(node.querySelector('span').textContent).toBe('안녕하세요');
    expect(node.parentNode).toBeNull();
    expect(domToVNode(node)).toEqual(vnode);
  });

  it('속성과 자식이 없는 요소도 만든다', () => {
    const node = vnodeToDom({
      type: 'element',
      tag: 'div',
      props: {},
      children: [],
    });

    expect(node.localName).toBe('div');
    expect(node.attributes.length).toBe(0);
    expect(node.childNodes.length).toBe(0);
  });
});
