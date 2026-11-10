import { describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../src/component/function-component.js';
import { useState } from '../src/component/hooks.js';
import { h, renderChild } from '../src/component/create-element.js';

describe('useState', () => {
  it('활성 루트 컴포넌트 렌더 바깥에서는 사용할 수 없다', () => {
    expect(() => useState(0)).toThrow();
  });

  it('두 상태 슬롯은 독립적으로 유지되고 값 및 함수형 updater를 적용한다', async () => {
    const Component = () => {
      const [name, setName] = useState('Ada');
      const [count, setCount] = useState(1);
      return h(
        'div',
        null,
        h('span', { id: 'name' }, name),
        h('span', { id: 'count' }, count),
        h(
          'button',
          { id: 'set-name', onClick: () => setName('Grace') },
          'name',
        ),
        h(
          'button',
          {
            id: 'increment',
            onClick: () => setCount((current) => current + 1),
          },
          'count',
        ),
      );
    };
    const instance = new FunctionComponent(Component);
    const container = document.createElement('div');
    const root = instance.mount(container);
    const nameNode = root.querySelector('#name');
    const countNode = root.querySelector('#count');

    root.querySelector('#increment').click();
    await Promise.resolve();
    expect(root.querySelector('#count').textContent).toBe('2');
    expect(root.querySelector('#name')).toBe(nameNode);
    expect(root.querySelector('#name').textContent).toBe('Ada');

    root.querySelector('#set-name').click();
    await Promise.resolve();
    expect(root.querySelector('#name').textContent).toBe('Grace');
    expect(root.querySelector('#count')).toBe(countNode);
    expect(root.querySelector('#count').textContent).toBe('2');
  });

  it('setter는 값과 함수형 갱신을 반영한다', async () => {
    let setValue;
    const Component = () => {
      const [value, update] = useState(3);
      setValue = update;
      return h('p', null, value);
    };
    const instance = new FunctionComponent(Component);
    const container = document.createElement('div');
    instance.mount(container);

    setValue(10);
    await Promise.resolve();
    expect(container.textContent).toBe('10');
    setValue((current) => current + 4);
    await Promise.resolve();
    expect(container.textContent).toBe('14');
  });

  it('Object.is가 같은 상태 값이면 컴포넌트 재실행을 건너뛴다', () => {
    let setValue;
    const Component = vi.fn(() => {
      const [value, update] = useState(Number.NaN);
      setValue = update;
      return h('p', null, String(value));
    });
    const instance = new FunctionComponent(Component);
    const container = document.createElement('div');
    instance.mount(container);

    setValue(Number.NaN);
    expect(Component).toHaveBeenCalledTimes(1);
  });

  it('props update 후에도 기존 state 슬롯 값을 유지한다', () => {
    let setCount;
    const Component = ({ label }) => {
      const [count, update] = useState(0);
      setCount = update;
      return h('p', { title: label }, `${label}:${count}`);
    };
    const instance = new FunctionComponent(Component, { label: 'first' });
    const container = document.createElement('div');
    instance.mount(container);
    setCount(7);

    instance.update({ label: 'next' });
    expect(container.querySelector('p').getAttribute('title')).toBe('next');
    expect(container.textContent).toBe('next:7');
  });

  it('렌더 중 setter를 호출하면 오류를 낸다', () => {
    const Component = () => {
      const [, setValue] = useState(0);
      setValue(1);
      return h('p', null, 'unreachable');
    };
    const instance = new FunctionComponent(Component);

    expect(() => instance.mount(document.createElement('div'))).toThrow();
  });

  it('재렌더에서 Hook 호출 개수가 달라지면 오류를 낸다', () => {
    const Component = ({ includeSecond }) => {
      useState('first');
      if (includeSecond) useState('second');
      return h('p', null, 'hooks');
    };
    const instance = new FunctionComponent(Component, { includeSecond: true });
    instance.mount(document.createElement('div'));

    expect(() => instance.update({ includeSecond: false })).toThrow();
  });

  it('renderChild 내부 함수는 Hook을 호출할 수 없다', () => {
    const Component = () =>
      renderChild(() => {
        useState(0);
        return h('span', null, 'child');
      });
    const instance = new FunctionComponent(Component);

    expect(() => instance.mount(document.createElement('div'))).toThrow();
  });

  it('unmount 이후 setter는 무시한다', () => {
    let setValue;
    const Component = vi.fn(() => {
      const [value, update] = useState(0);
      setValue = update;
      return h('p', null, value);
    });
    const instance = new FunctionComponent(Component);
    const container = document.createElement('div');
    instance.mount(container);
    instance.unmount();
    const renderCountAfterUnmount = Component.mock.calls.length;

    expect(() => setValue(1)).not.toThrow();
    expect(Component).toHaveBeenCalledTimes(renderCountAfterUnmount);
    expect(container.childNodes).toHaveLength(0);
  });

  it('unmount 후 같은 인스턴스를 다시 mount해도 이전 setter는 무시한다', () => {
    let setValue;
    const Component = () => {
      const [value, update] = useState(0);
      setValue = update;
      return h('p', null, value);
    };
    const instance = new FunctionComponent(Component);
    const container = document.createElement('div');
    instance.mount(container);
    const oldSetter = setValue;
    instance.unmount();
    instance.mount(container);

    oldSetter(10);

    expect(container.textContent).toBe('0');
  });

  it('실패한 최초 mount의 Hook 슬롯을 비우고 재시도한다', () => {
    let invalid = true;
    const Component = () => {
      const [value] = useState(invalid ? 5 : 0);
      if (invalid) {
        return {
          type: 'element',
          tag: 'bad tag',
          props: {},
          children: [],
        };
      }
      return h('p', null, value);
    };
    const instance = new FunctionComponent(Component);
    const container = document.createElement('div');

    expect(() => instance.mount(container)).toThrow(TypeError);
    expect(container.childNodes).toHaveLength(0);
    invalid = false;
    instance.mount(container);

    expect(container.textContent).toBe('0');
  });

  it('예약 렌더에서 잘못된 트리는 state를 되돌리고 이전 DOM을 보존한다', async () => {
    let setChanged;
    const Component = () => {
      const [changed, update] = useState(false);
      setChanged = update;
      return h(
        'div',
        null,
        h('span', null, changed ? 'new' : 'old'),
        changed
          ? {
              type: 'element',
              tag: 'bad tag',
              props: {},
              children: [],
            }
          : h('b', null, 'ok'),
      );
    };
    const instance = new FunctionComponent(Component);
    const container = document.createElement('div');
    const root = instance.mount(container);

    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setChanged(true);
    await Promise.resolve();
    expect(logError).toHaveBeenCalled();
    logError.mockRestore();
    expect(root.textContent).toBe('oldok');
    expect(instance.update()).toBe(root);
  });
});
