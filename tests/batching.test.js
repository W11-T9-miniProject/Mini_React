import { afterEach, describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../src/component/function-component.js';
import { h } from '../src/component/create-element.js';
import { useEffect, useState } from '../src/component/hooks.js';

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('useState batching', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('한 동기 작업의 여러 setter를 한 번 렌더로 합친다', async () => {
    let setCount;
    const renders = vi.fn();
    const Counter = () => {
      const [count, set] = useState(0);
      setCount = set;
      renders(count);
      return h('output', { id: 'count' }, count);
    };
    const container = document.createElement('div');
    const instance = new FunctionComponent(Counter);
    instance.mount(container);

    setCount((value) => value + 1);
    setCount((value) => value + 1);
    setCount(5);
    expect(renders).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('0');

    await nextTask();
    expect(renders).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('5');
  });

  it('함수형 updater는 setter 호출 순서대로 최신 슬롯 값을 사용한다', async () => {
    let setCount;
    const Counter = () => {
      const [count, set] = useState(1);
      setCount = set;
      return h('output', null, count);
    };
    const container = document.createElement('div');
    new FunctionComponent(Counter).mount(container);

    setCount((value) => value + 2);
    setCount((value) => value * 3);
    await nextTask();

    expect(container.textContent).toBe('9');
  });

  it('원래 값으로 돌아오는 batch는 재렌더링하지 않는다', async () => {
    let setCount;
    const renders = vi.fn();
    const Counter = () => {
      const [count, set] = useState(4);
      setCount = set;
      renders(count);
      return h('output', null, count);
    };
    const container = document.createElement('div');
    new FunctionComponent(Counter).mount(container);

    setCount(7);
    setCount(4);
    await nextTask();

    expect(renders).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('4');
  });

  it('다른 JavaScript 작업의 setter는 서로 다른 렌더로 처리한다', async () => {
    let setCount;
    const renders = vi.fn();
    const Counter = () => {
      const [count, set] = useState(0);
      setCount = set;
      renders(count);
      return h('output', null, count);
    };
    const container = document.createElement('div');
    new FunctionComponent(Counter).mount(container);

    setCount(1);
    await nextTask();
    setCount(2);
    await nextTask();

    expect(renders.mock.calls.map(([count]) => count)).toEqual([0, 1, 2]);
  });

  it('예약한 재렌더 전에 unmount하면 대기 update를 취소한다', async () => {
    let setCount;
    const renders = vi.fn();
    const Counter = () => {
      const [count, set] = useState(0);
      setCount = set;
      renders(count);
      return h('output', null, count);
    };
    const container = document.createElement('div');
    const instance = new FunctionComponent(Counter);
    instance.mount(container);

    setCount(1);
    instance.unmount();
    await nextTask();

    expect(renders).toHaveBeenCalledTimes(1);
    expect(container.childNodes).toHaveLength(0);
  });

  it('한 번의 batch는 effect도 최종 상태 기준으로 한 차례 커밋한다', async () => {
    let setCount;
    const effects = vi.fn();
    const Counter = () => {
      const [count, set] = useState(0);
      setCount = set;
      useEffect(() => {
        effects(count);
      }, [count]);
      return h('output', null, count);
    };
    const container = document.createElement('div');
    const instance = new FunctionComponent(Counter);
    instance.mount(container);
    await nextTask();
    effects.mockClear();

    setCount(1);
    setCount(2);
    setCount(3);
    await nextTask();

    expect(effects.mock.calls).toEqual([[3]]);
    expect(container.textContent).toBe('3');
    instance.unmount();
  });

  it('batch가 flush되기 전 직접 update하면 추가 렌더를 예약하지 않는다', async () => {
    let setCount;
    const renders = vi.fn();
    const Counter = () => {
      const [count, set] = useState(0);
      setCount = set;
      renders(count);
      return h('output', null, count);
    };
    const container = document.createElement('div');
    const instance = new FunctionComponent(Counter);
    instance.mount(container);

    setCount(2);
    instance.update();
    await nextTask();

    expect(renders.mock.calls.map(([count]) => count)).toEqual([0, 2]);
  });

  it('updater가 던지면 동기 전달하고 해당 값은 예약하지 않는다', async () => {
    let setCount;
    const renders = vi.fn();
    const Counter = () => {
      const [count, set] = useState(1);
      setCount = set;
      renders(count);
      return h('output', null, count);
    };
    const container = document.createElement('div');
    new FunctionComponent(Counter).mount(container);

    expect(() =>
      setCount(() => {
        throw new Error('updater failed');
      }),
    ).toThrow('updater failed');
    await nextTask();

    expect(renders).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('1');
  });
});
