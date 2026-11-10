import { describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../src/component/function-component.js';
import { useState } from '../src/component/hooks.js';
import { h } from '../src/component/create-element.js';

describe('FunctionComponent + useState 통합', () => {
  it('실제 버튼 이벤트가 state setter를 호출해 DOM을 갱신하고 기존 참조를 유지한다', async () => {
    const onRender = vi.fn();
    const Counter = ({ label }) => {
      const [count, setCount] = useState(0);
      onRender(count);
      return h(
        'section',
        { title: label },
        h('button', { onClick: () => setCount((value) => value + 1) }, 'add'),
        h('output', { id: 'count' }, count),
        h('p', { id: 'stable' }, 'static'),
      );
    };
    const instance = new FunctionComponent(Counter, { label: 'counter' });
    const container = document.createElement('div');
    const root = instance.mount(container);
    const stableParagraph = root.querySelector('#stable');
    const button = root.querySelector('button');

    button.click();
    await Promise.resolve();

    expect(container.firstChild).toBe(root);
    expect(root.querySelector('#count').textContent).toBe('1');
    expect(root.querySelector('#stable')).toBe(stableParagraph);
    expect(onRender).toHaveBeenCalledTimes(2);
  });
});
