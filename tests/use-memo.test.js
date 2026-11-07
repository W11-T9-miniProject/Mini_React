import { describe, expect, it, vi } from 'vitest';
import {
  FunctionComponent,
  useState,
  useMemo,
} from '../src/component/function-component.js';

const view = (value) => ({ type: 'text', value: String(value) });
function host() {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return element;
}

describe('useMemo', () => {
  it('관련 상태가 같으면 계산을 건너뛰고 바뀌면 새 결과를 반환한다', () => {
    let setCount;
    let setName;
    const calculate = vi.fn((count) => count * 2);
    const container = host();
    const component = new FunctionComponent(() => {
      const [count, countSetter] = useState(0);
      const [name, nameSetter] = useState('정글');
      setCount = countSetter;
      setName = nameSetter;
      const doubled = useMemo(() => calculate(count), [count]);
      return view(`${name}/${doubled}`);
    }, container);
    component.mount();
    setName('학습자');
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('학습자/0');
    setCount(2);
    expect(calculate).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('학습자/4');
  });

  it('undefined 결과도 저장하고 빈 배열은 한 번만 계산한다', () => {
    const calculate = vi.fn(() => undefined);
    const component = new FunctionComponent(
      () => view(useMemo(calculate, [])),
      host(),
    );
    component.mount();
    component.update();
    expect(calculate).toHaveBeenCalledTimes(1);
  });

  it('의존값 생략 시 매번 계산한다', () => {
    const calculate = vi.fn(() => 3);
    const component = new FunctionComponent(
      () => view(useMemo(calculate)),
      host(),
    );
    component.mount();
    component.update();
    expect(calculate).toHaveBeenCalledTimes(2);
  });

  it('Object.is로 비교하고 의존 배열을 복사해 보관한다', () => {
    const calculate = vi.fn(() => 7);
    const deps = [NaN];
    const component = new FunctionComponent(
      () => view(useMemo(calculate, deps)),
      host(),
    );
    component.mount();
    component.update();
    expect(calculate).toHaveBeenCalledTimes(1);
    deps[0] = 0;
    component.update();
    deps[0] = -0;
    component.update();
    expect(calculate).toHaveBeenCalledTimes(3);
  });

  it('계산이 실패해도 이전 의존값과 캐시를 덮어쓰지 않는다', () => {
    let dependency = 0;
    const calculate = vi.fn(() => {
      if (dependency === 1) throw new Error('계산 실패');
      return dependency;
    });
    const container = host();
    const component = new FunctionComponent(
      () => view(useMemo(calculate, [dependency])),
      container,
    );
    component.mount();
    dependency = 1;
    expect(() => component.update()).toThrow('계산 실패');
    expect(container.textContent).toBe('0');
    dependency = 0;
    component.update();
    expect(calculate).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('0');
  });

  it('의존값이 같으면 새 계산 함수 대신 기존 객체 결과를 그대로 반환한다', () => {
    const first = { label: '처음' };
    let result;
    let next = first;
    const component = new FunctionComponent(() => {
      result = useMemo(() => next, []);
      return view(result.label);
    }, host());
    component.mount();
    next = { label: '다음' };
    component.update();
    expect(result).toBe(first);
  });

  it('컴포넌트 밖 호출·잘못된 인자·Hook 종류 변경을 거절한다', () => {
    expect(() => useMemo(() => 1, [])).toThrow(/컴포넌트/);
    const invalid = new FunctionComponent(() => view(useMemo(1, [])), host());
    expect(() => invalid.mount()).toThrow(/함수/);
    const invalidDeps = new FunctionComponent(
      () => view(useMemo(() => 1, '잘못된 의존값')),
      host(),
    );
    expect(() => invalidDeps.mount()).toThrow(/배열/);
    let memo = false;
    const component = new FunctionComponent(() => {
      if (memo) useMemo(() => 1, []);
      else useState(1);
      return view('샘플');
    }, host());
    component.mount();
    memo = true;
    expect(() => component.update()).toThrow(/Hook/);
  });
});
