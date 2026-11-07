import { describe, it, expect } from 'vitest';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';

describe('domToVNode', () => {
  it('태그, 속성, 중첩 텍스트와 공백을 읽고 주석은 제외한다', () => {
    const node = document.createElement('div');
    node.innerHTML =
      '<P class="note">안녕 <strong title="강조">정글</strong><!-- comment --></P>';
    expect(domToVNode(node.firstChild)).toEqual({
      type: 'element',
      tag: 'p',
      props: { class: 'note' },
      children: [
        { type: 'text', value: '안녕 ' },
        {
          type: 'element',
          tag: 'strong',
          props: { title: '강조' },
          children: [{ type: 'text', value: '정글' }],
        },
      ],
    });
  });
  it('HTML 속성이 아닌 현재 input 값과 checked를 읽는다', () => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('value', 'old');
    input.value = 'new';
    input.checked = true;
    expect(domToVNode(input).props).toMatchObject({
      value: 'new',
      checked: true,
    });
  });
  it('textarea와 select의 현재 선택값을 읽는다', () => {
    const node = document.createElement('div');
    node.innerHTML =
      '<textarea>old</textarea><select><option>a</option><option>b</option></select>';
    node.firstChild.value = 'new';
    node.lastChild.value = 'b';
    expect(domToVNode(node.firstChild).props.value).toBe('new');
    expect(domToVNode(node.lastChild).props.value).toBe('b');
  });
  it('지원하지 않는 노드에는 명확한 오류를 준다', () => {
    expect(() => domToVNode(document.createComment('comment'))).toThrow();
  });
});
