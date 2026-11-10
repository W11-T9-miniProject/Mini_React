import { describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../src/component/function-component.js';
import { useEffect, useState } from '../src/component/hooks.js';
import { h } from '../src/component/create-element.js';

const flushMicrotasks = async () => {
  // Effect 실행과 effect 안에서 발생한 상태 갱신이 만든 다음 effect까지 비운다.
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
};

describe('useEffect', () => {
  it('최초 mount 커밋 후 microtask에서 effect를 실행한다', async () => {
    const effect = vi.fn();
    const Component = () => {
      useEffect(effect, []);
      return h('p', null, 'mounted');
    };
    const container = document.createElement('div');
    const instance = new FunctionComponent(Component);

    instance.mount(container);
    expect(container.textContent).toBe('mounted');
    expect(effect).not.toHaveBeenCalled();

    await flushMicrotasks();
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('의존성이 같으면 effect를 건너뛰고 바뀌면 이전 cleanup 뒤 새 effect를 실행한다', async () => {
    const events = [];
    const Component = ({ value }) => {
      useEffect(() => {
        events.push(`effect:${value}`);
        return () => events.push(`cleanup:${value}`);
      }, [value]);
      return h('p', null, value);
    };
    const instance = new FunctionComponent(Component, { value: 'a' });
    instance.mount(document.createElement('div'));

    await flushMicrotasks();
    expect(events).toEqual(['effect:a']);

    instance.update({ value: 'a' });
    await flushMicrotasks();
    expect(events).toEqual(['effect:a']);

    instance.update({ value: 'b' });
    await flushMicrotasks();
    expect(events).toEqual(['effect:a', 'cleanup:a', 'effect:b']);
  });

  it('microtask 전 동기 커밋이 여러 번 있어도 각 effect를 순서대로 실행한다', async () => {
    const events = [];
    const Component = ({ value }) => {
      useEffect(() => {
        events.push(`effect:${value}`);
        return () => events.push(`cleanup:${value}`);
      }, [value]);
      return h('p', null, value);
    };
    const instance = new FunctionComponent(Component, { value: 0 });
    instance.mount(document.createElement('div'));
    await flushMicrotasks();

    instance.update({ value: 1 });
    instance.update({ value: 2 });
    await flushMicrotasks();

    expect(events).toEqual([
      'effect:0',
      'cleanup:0',
      'effect:1',
      'cleanup:1',
      'effect:2',
    ]);
  });

  it('의존성 배열을 생략하면 매 렌더 후 실행하고 cleanup 반환이 없어도 된다', async () => {
    const effect = vi.fn();
    const Component = ({ label }) => {
      useEffect(effect);
      return h('p', null, label);
    };
    const instance = new FunctionComponent(Component, { label: 'same' });
    instance.mount(document.createElement('div'));

    await flushMicrotasks();
    expect(effect).toHaveBeenCalledTimes(1);

    instance.update({ label: 'same' });
    await flushMicrotasks();
    expect(effect).toHaveBeenCalledTimes(2);
  });

  it('빈 의존성 배열 effect는 최초 한 번 실행하고 unmount 때 cleanup한다', async () => {
    const events = [];
    const Component = ({ label }) => {
      useEffect(() => {
        events.push('effect');
        return () => events.push('cleanup');
      }, []);
      return h('p', null, label);
    };
    const instance = new FunctionComponent(Component, { label: 'first' });
    const container = document.createElement('div');
    instance.mount(container);

    await flushMicrotasks();
    instance.update({ label: 'second' });
    await flushMicrotasks();
    expect(events).toEqual(['effect']);

    instance.unmount();
    expect(events).toEqual(['effect', 'cleanup']);
    expect(container.childNodes).toHaveLength(0);
  });

  it('effect가 microtask에서 state setter를 호출해도 다음 렌더와 effect를 완료한다', async () => {
    const events = [];
    const Component = () => {
      const [count, setCount] = useState(0);
      useEffect(() => {
        events.push(`effect:${count}`);
        if (count === 0) setCount(1);
      }, [count]);
      return h('output', null, count);
    };
    const container = document.createElement('div');
    const instance = new FunctionComponent(Component);

    instance.mount(container);
    expect(container.textContent).toBe('0');
    await flushMicrotasks();

    expect(container.textContent).toBe('1');
    expect(events).toEqual(['effect:0', 'effect:1']);
  });

  it('한 effect 오류가 대기 중인 다른 effect를 중단하지 않는다', async () => {
    const events = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Component = () => {
      useEffect(() => {
        events.push('first');
        throw new Error('effect failed');
      }, []);
      useEffect(() => {
        events.push('second');
      }, []);
      return h('p', null, 'ready');
    };
    const instance = new FunctionComponent(Component);
    instance.mount(document.createElement('div'));

    await flushMicrotasks();

    expect(events).toEqual(['first', 'second']);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('cleanup 오류가 있어도 나머지 cleanup과 unmount를 끝낸다', async () => {
    const events = [];
    const Component = () => {
      useEffect(
        () => () => {
          events.push('first');
          throw new Error('cleanup failed');
        },
        [],
      );
      useEffect(() => () => events.push('second'), []);
      return h('p', null, 'ready');
    };
    const container = document.createElement('div');
    const instance = new FunctionComponent(Component);
    instance.mount(container);
    await flushMicrotasks();

    expect(() => instance.unmount()).toThrow(AggregateError);
    expect(events).toEqual(['first', 'second']);
    expect(container.childNodes).toHaveLength(0);
  });

  it('effect가 자기 컴포넌트를 unmount하면 반환한 cleanup을 즉시 실행한다', async () => {
    const events = [];
    let instance;
    const Component = () => {
      useEffect(() => {
        events.push('effect');
        instance.unmount();
        return () => events.push('cleanup');
      }, []);
      return h('p', null, 'ready');
    };
    const container = document.createElement('div');
    instance = new FunctionComponent(Component);
    instance.mount(container);

    await flushMicrotasks();

    expect(events).toEqual(['effect', 'cleanup']);
    expect(container.childNodes).toHaveLength(0);
  });

  it('이전 cleanup이 unmount를 일으키면 다음 effect를 실행하지 않는다', async () => {
    const events = [];
    let instance;
    const Component = ({ value }) => {
      useEffect(() => {
        events.push(`effect:${value}`);
        if (value === 'a') {
          return () => {
            events.push('cleanup:a');
            instance.unmount();
          };
        }
        return undefined;
      }, [value]);
      return h('p', null, value);
    };
    const container = document.createElement('div');
    instance = new FunctionComponent(Component, { value: 'a' });
    instance.mount(container);
    await flushMicrotasks();

    instance.update({ value: 'b' });
    await flushMicrotasks();

    expect(events).toEqual(['effect:a', 'cleanup:a']);
    expect(container.childNodes).toHaveLength(0);
  });
});
