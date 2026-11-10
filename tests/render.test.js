import { describe, it, expect } from 'vitest';
import { render } from '../src/vdom/render.js';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';

describe('render', () => {
  it('VDOM을 렌더 후 재변환하면 같은 트리가 된다', () => {
    const vnode = {
      type: 'element',
      tag: 'div',
      props: { title: 'x' },
      children: [{ type: 'text', value: ' hi ' }],
    };
    expect(domToVNode(render(vnode))).toEqual(vnode);
  });
});
