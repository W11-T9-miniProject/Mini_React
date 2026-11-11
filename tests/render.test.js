import { describe, it, expect } from 'vitest';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';
import { render } from '../src/vdom/render.js';
import { h } from '../src/runtime/index.js';

describe('render', () => {
  it('중첩 DOM을 변환 → 렌더 → 재변환하면 같은 트리다', () => {
    const root = document.createElement('article');
    root.innerHTML = '앞 <strong class="x">강조</strong><br><span></span> 뒤';
    const vnode = domToVNode(root);
    expect(domToVNode(render(vnode))).toEqual(vnode);
  });
  it('텍스트를 HTML로 해석하지 않는다', () => {
    const root = render(h('p', {}, '<img src=x onerror=alert(1)>'));
    expect(root.children).toHaveLength(0);
    expect(root.textContent).toContain('<img');
  });
  it('이벤트, boolean 속성, 자식 생성 후 select 값을 적용한다', () => {
    let count = 0;
    const button = render(
      h('button', { onClick: () => count++, disabled: false }, 'click'),
    );
    button.click();
    expect(count).toBe(1);
    expect(button.disabled).toBe(false);
    const select = render(
      h(
        'select',
        { value: 'b' },
        h('option', { value: 'a' }, 'A'),
        h('option', { value: 'b' }, 'B'),
      ),
    );
    expect(select.value).toBe('b');
  });
});
