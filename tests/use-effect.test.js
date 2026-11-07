import { describe, expect, it, vi } from 'vitest';
import {
  FunctionComponent,
  useState,
  useEffect,
} from '../src/component/function-component.js';

function host() {
  const node = document.createElement('div');
  document.body.appendChild(node);
  return node;
}
const view = (value) => ({
  type: 'element',
  tag: 'p',
  props: {},
  children: [{ type: 'text', value: String(value) }],
});

describe('useEffect', () => {
  it('DOM 반영 후 실행하며 의존값 변경 시 이전 정리 후 최신 작업을 실행한다', () => {
    const container = host();
    const events = [];
    let countSetter;
    let nameSetter;
    const component = new FunctionComponent(() => {
      const [count, setCount] = useState(0);
      const [name, setName] = useState('정글');
      countSetter = setCount;
      nameSetter = setName;
      useEffect(() => {
        events.push(`setup:${count}/${name}:DOM=${container.textContent}`);
        return () => events.push(`cleanup:${count}`);
      }, [count]);
      return view(count);
    }, container);
    component.mount();
    nameSetter('학습자');
    expect(events).toEqual(['setup:0/정글:DOM=0']);
    countSetter(1);
    countSetter(1);
    expect(events).toEqual([
      'setup:0/정글:DOM=0',
      'cleanup:0',
      'setup:1/학습자:DOM=1',
    ]);
  });

  it('빈 의존 배열은 처음만, 의존 배열 생략은 매 갱신마다 실행한다', () => {
    const once = vi.fn();
    const always = vi.fn();
    const component = new FunctionComponent(() => {
      useEffect(once, []);
      useEffect(always);
      return view('같은 화면');
    }, host());
    component.mount();
    component.update();
    component.update();
    expect(once).toHaveBeenCalledTimes(1);
    expect(always).toHaveBeenCalledTimes(3);
  });

  it('의존값은 Object.is로 비교하고 전달한 배열을 복사해 보관한다', () => {
    const effect = vi.fn();
    const deps = [NaN];
    const component = new FunctionComponent(() => {
      useEffect(effect, deps);
      return view('샘플');
    }, host());
    component.mount();
    component.update();
    expect(effect).toHaveBeenCalledTimes(1);
    deps[0] = 0;
    component.update();
    deps[0] = -0;
    component.update();
    expect(effect).toHaveBeenCalledTimes(3);
  });

  it('렌더 실패 시 등록한 작업은 실행하지 않고 다음 정상 갱신에서 회복한다', () => {
    const effect = vi.fn();
    let setter;
    const container = host();
    const component = new FunctionComponent(() => {
      const [value, setValue] = useState(0);
      setter = setValue;
      useEffect(() => {
        effect(value);
      }, [value]);
      if (value === 1) throw new Error('실험용 렌더 실패');
      return view(value);
    }, container);
    component.mount();
    expect(() => setter(1)).toThrow('실험용 렌더 실패');
    expect(effect.mock.calls).toEqual([[0]]);
    expect(container.textContent).toBe('0');
    setter(2);
    expect(effect.mock.calls).toEqual([[0], [2]]);
  });

  it('언마운트는 작업을 한 번 정리하고 이전 setter는 새 마운트를 수정하지 못한다', () => {
    const cleanup = vi.fn();
    let setter;
    const container = host();
    const component = new FunctionComponent(() => {
      const [value, setValue] = useState(0);
      setter = setValue;
      useEffect(() => cleanup, []);
      return view(value);
    }, container);
    component.mount();
    const oldSetter = setter;
    component.unmount();
    component.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(container.children).toHaveLength(0);
    component.mount();
    expect(() => oldSetter(9)).toThrow(/상태/);
    expect(container.textContent).toBe('0');
    component.unmount();
  });

  it('Effect 안의 상태 변경은 같은 갱신의 다른 작업이 끝난 뒤 화면에 반영한다', () => {
    const events = [];
    const container = host();
    const component = new FunctionComponent(() => {
      const [value, setValue] = useState(0);
      useEffect(() => {
        events.push(`첫째:${value}`);
        if (value === 0) setValue(1);
      }, [value]);
      useEffect(() => {
        events.push(`둘째:${value}`);
      }, [value]);
      return view(value);
    }, container);
    component.mount();
    expect(events).toEqual(['첫째:0', '둘째:0', '첫째:1', '둘째:1']);
    expect(container.textContent).toBe('1');
  });

  it('Effect에서 예외가 나도 이미 화면에 반영된 상태를 되돌리지 않는다', () => {
    let setter;
    const container = host();
    const component = new FunctionComponent(() => {
      const [value, setValue] = useState(0);
      setter = setValue;
      useEffect(() => {
        if (value === 1) throw new Error('작업 실패');
      }, [value]);
      return view(value);
    }, container);
    component.mount();
    expect(() => setter(1)).toThrow('작업 실패');
    expect(container.textContent).toBe('1');
    expect(component.hooks[0].value).toBe(1);
    setter(2);
    expect(container.textContent).toBe('2');
  });

  it('컴포넌트 밖 호출과 잘못된 인자 및 Hook 종류 변경을 거절한다', () => {
    expect(() => useEffect(() => {}, [])).toThrow(/컴포넌트/);
    const invalid = new FunctionComponent(() => {
      useEffect('문자열', []);
      return view('잘못된 작업');
    }, host());
    expect(() => invalid.mount()).toThrow(/함수/);
    const invalidDeps = new FunctionComponent(() => {
      useEffect(() => {}, '배열이 아님');
      return view('샘플');
    }, host());
    expect(() => invalidDeps.mount()).toThrow(/배열/);
    let useEffectNow = false;
    const component = new FunctionComponent(() => {
      if (useEffectNow) useEffect(() => {}, []);
      else useState(0);
      return view('샘플');
    }, host());
    component.mount();
    useEffectNow = true;
    expect(() => component.update()).toThrow(/Hook/);
  });

  it('이벤트 구독은 갱신 시 중복되지 않고 제거 후에는 실행되지 않는다', () => {
    const events = [];
    let setter;
    const component = new FunctionComponent(() => {
      const [value, setValue] = useState(0);
      setter = setValue;
      useEffect(() => {
        const listener = () => events.push(value);
        window.addEventListener('mini-react-effect-test', listener);
        return () =>
          window.removeEventListener('mini-react-effect-test', listener);
      }, [value]);
      return view(value);
    }, host());
    component.mount();
    try {
      window.dispatchEvent(new Event('mini-react-effect-test'));
      setter(1);
      window.dispatchEvent(new Event('mini-react-effect-test'));
      expect(events).toEqual([0, 1]);
    } finally {
      component.unmount();
    }
    window.dispatchEvent(new Event('mini-react-effect-test'));
    expect(events).toEqual([0, 1]);
  });
});
