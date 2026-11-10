import { describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../src/component/function-component.js';
import { useEffect, useMemo, useState } from '../src/component/hooks.js';
import { h } from '../src/component/create-element.js';

describe('useMemo', () => {
  it('exports useMemo as a function', () => {
    expect(useMemo).toBeTypeOf('function');
  });

  it('루트 렌더 중에만 호출할 수 있고 factory/deps 계약을 검사한다', () => {
    expect(useMemo).toBeTypeOf('function');
    expect(() => useMemo(() => 1, [])).toThrow();

    const invalidFactory = new FunctionComponent(() => useMemo(1, []));
    expect(() => invalidFactory.mount(document.createElement('div'))).toThrow(
      TypeError,
    );

    const invalidDependencies = new FunctionComponent(() =>
      useMemo(() => 1, 'not-an-array'),
    );
    expect(() =>
      invalidDependencies.mount(document.createElement('div')),
    ).toThrow(TypeError);
  });

  it('계산 함수 안에서 다른 Hook을 호출할 수 없다', () => {
    const Component = () => {
      const value = useMemo(() => useState(1)[0], []);
      return h('p', null, value);
    };
    const instance = new FunctionComponent(Component);

    expect(() => instance.mount(document.createElement('div'))).toThrow();
  });

  it('최초 mount에서 계산하고 같은 deps에서는 계산을 건너뛰며 같은 참조를 돌려준다', () => {
    const factory = vi.fn(() => ({ token: Symbol('memoized') }));
    const returned = [];
    const Component = ({ label }) => {
      const value = useMemo(factory, [label]);
      returned.push(value);
      return h('p', null, label);
    };
    const instance = new FunctionComponent(Component, { label: 'same' });
    instance.mount(document.createElement('div'));
    instance.update({ label: 'same' });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(returned[1]).toBe(returned[0]);
  });

  it('deps가 바뀌면 다시 계산하고 새 값을 반환한다', () => {
    const factory = vi.fn((value) => ({ value }));
    const returned = [];
    const Component = ({ input }) => {
      const memoized = useMemo(() => factory(input), [input]);
      returned.push(memoized);
      return h('p', null, memoized.value);
    };
    const instance = new FunctionComponent(Component, { input: 'a' });
    instance.mount(document.createElement('div'));
    instance.update({ input: 'b' });

    expect(factory).toHaveBeenCalledTimes(2);
    expect(returned[0]).toEqual({ value: 'a' });
    expect(returned[1]).toEqual({ value: 'b' });
    expect(returned[1]).not.toBe(returned[0]);
  });

  it('deps를 생략하면 매 렌더마다 다시 계산한다', () => {
    const factory = vi.fn(() => ({}));
    const returned = [];
    const Component = ({ label }) => {
      const value = useMemo(factory);
      returned.push(value);
      return h('p', null, label);
    };
    const instance = new FunctionComponent(Component, { label: 'first' });
    instance.mount(document.createElement('div'));
    instance.update({ label: 'second' });

    expect(factory).toHaveBeenCalledTimes(2);
    expect(returned[1]).not.toBe(returned[0]);
  });

  it('의존성을 Object.is로 비교한다: 같은 0은 재사용하고 -0과 0은 다르다', () => {
    const factory = vi.fn(() => ({}));
    const returned = [];
    const Component = ({ dependency }) => {
      const value = useMemo(factory, [dependency]);
      returned.push(value);
      return h('p', null, 'memo');
    };
    const instance = new FunctionComponent(Component, { dependency: 0 });
    instance.mount(document.createElement('div'));
    instance.update({ dependency: 0 });
    instance.update({ dependency: -0 });
    instance.update({ dependency: -0 });

    expect(factory).toHaveBeenCalledTimes(2);
    expect(returned[1]).toBe(returned[0]);
    expect(returned[2]).not.toBe(returned[1]);
    expect(returned[3]).toBe(returned[2]);
  });

  it('props update는 같은 deps의 값을 유지하고 변경 deps의 값은 갱신한다', () => {
    const returned = [];
    const Component = ({ label, color }) => {
      const value = useMemo(() => ({ label }), [label]);
      returned.push(value);
      return h('p', { title: color }, value.label);
    };
    const instance = new FunctionComponent(Component, {
      label: 'Ada',
      color: 'blue',
    });
    const container = document.createElement('div');
    instance.mount(container);
    instance.update({ label: 'Ada', color: 'red' });
    expect(returned[1]).toBe(returned[0]);
    expect(container.querySelector('p').getAttribute('title')).toBe('red');

    instance.update({ label: 'Grace', color: 'red' });
    expect(returned[2]).not.toBe(returned[1]);
    expect(container.textContent).toBe('Grace');
  });

  it('Hook 개수가 렌더 사이에 달라지면 오류를 낸다', () => {
    const Component = ({ includeMemo }) => {
      useState(0);
      if (includeMemo) useMemo(() => 1, []);
      return h('p', null, 'hooks');
    };
    const instance = new FunctionComponent(Component, { includeMemo: true });
    instance.mount(document.createElement('div'));

    expect(() => instance.update({ includeMemo: false })).toThrow();
  });

  it.each([
    ['state', 'memo'],
    ['memo', 'effect'],
    ['effect', 'state'],
  ])(
    '같은 슬롯의 %s Hook을 %s Hook으로 바꾸면 오류를 낸다',
    (before, after) => {
      const callHook = (kind) => {
        if (kind === 'state') return useState(0);
        if (kind === 'memo') return useMemo(() => 0, []);
        useEffect(() => {}, []);
        return null;
      };
      const Component = ({ kind }) => {
        callHook(kind);
        return h('p', null, kind);
      };
      const instance = new FunctionComponent(Component, { kind: before });
      instance.mount(document.createElement('div'));

      expect(() => instance.update({ kind: after })).toThrow();
      instance.unmount();
    },
  );
});
