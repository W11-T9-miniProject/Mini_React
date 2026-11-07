import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  h,
  FunctionComponent,
  useState,
  useEffect,
  useMemo,
} from '../src/runtime/index.js';

const instances = [];
function mount(Component) {
  const container = document.createElement('div');
  document.body.append(container);
  const instance = new FunctionComponent(Component).mount(container);
  instances.push(instance);
  return instance;
}
afterEach(() => {
  instances.splice(0).forEach((instance) => instance.unmount());
  vi.useRealTimers();
});

describe('함수형 컴포넌트와 useState', () => {
  it('재실행해도 상태를 유지하고 여러 setter를 한 번에 배칭한다', async () => {
    let set;
    const init = vi.fn(() => 0);
    const app = mount(() => {
      const [value, setter] = useState(init);
      set = setter;
      return h('p', {}, value);
    });
    const node = app.root;
    set((v) => v + 1);
    set((v) => v + 1);
    set((v) => v + 1);
    expect(app.renderCount).toBe(1);
    await app.settled();
    expect(app.root.textContent).toBe('3');
    expect(app.renderCount).toBe(2);
    expect(app.root).toBe(node);
    expect(init).toHaveBeenCalledTimes(1);
    set(3);
    await app.settled();
    expect(app.renderCount).toBe(2);
  });
  it('setter 참조와 루트 인스턴스별 상태를 분리한다', async () => {
    const setters = [];
    const component = () => {
      const [n, set] = useState(0);
      setters.push(set);
      return h('p', {}, n);
    };
    const a = mount(component),
      b = mount(component);
    setters[0](10);
    await a.settled();
    expect(a.root.textContent).toBe('10');
    expect(b.root.textContent).toBe('0');
    expect(setters[2]).toBe(setters[0]);
  });
  it('h는 중첩 배열을 펼치고 null/boolean을 제외하며 순수 자식에 props를 전달한다', () => {
    const Child = ({ name, children }) => h('b', {}, name, children);
    const app = mount(() =>
      h('div', {}, [null, false, [h(Child, { name: '정글' }, '!'), 0]]),
    );
    expect(app.root.textContent).toBe('정글!0');
  });
  it('자식 Hook과 렌더 밖 Hook 호출을 거부한다', () => {
    expect(() => useState(0)).toThrow('루트');
    const Child = () => {
      useState(0);
      return h('p');
    };
    expect(() => mount(() => h(Child))).toThrow('루트');
  });
  it('Hook 종류 또는 개수 변경을 거부한다', async () => {
    let set;
    const app = mount(() => {
      const [show, setter] = useState(true);
      set = setter;
      if (show) useMemo(() => 1, []);
      return h('p');
    });
    set(false);
    await expect(app.settled()).rejects.toThrow('Hook');
  });
  it('렌더 중 setter 호출을 거부하고 렌더 컨텍스트를 복원한다', () => {
    expect(() =>
      mount(() => {
        const [, set] = useState(0);
        set(1);
        return h('p');
      }),
    ).toThrow('렌더링 중');
    const good = mount(() => h('p', {}, 'ok'));
    expect(good.root.textContent).toBe('ok');
  });
  it('Unmount 이후 setter와 예약된 업데이트를 무시한다', async () => {
    let set;
    const app = mount(() => {
      const [n, setter] = useState(0);
      set = setter;
      return h('p', {}, n);
    });
    set(1);
    app.unmount();
    await app.settled();
    set(2);
    expect(app.container.childNodes).toHaveLength(0);
    expect(app.renderCount).toBe(1);
  });
});

describe('useMemo', () => {
  it('의존성이 같으면 캐시를 사용하고 바뀌면 다시 계산한다', async () => {
    let setA, setB;
    const compute = vi.fn((value) => value * 2);
    const app = mount(() => {
      const [a, sa] = useState(1),
        [b, sb] = useState(0);
      setA = sa;
      setB = sb;
      const value = useMemo(() => compute(a), [a]);
      return h('p', {}, value, '/', b);
    });
    setB(1);
    await app.settled();
    expect(compute).toHaveBeenCalledTimes(1);
    setA(2);
    await app.settled();
    expect(compute).toHaveBeenCalledTimes(2);
    expect(app.root.textContent).toBe('4/1');
  });
  it('의존성 생략 시 매번, 빈 배열은 mount에서만 계산한다', async () => {
    let set;
    const always = vi.fn(),
      once = vi.fn();
    const app = mount(() => {
      const [n, s] = useState(0);
      set = s;
      useMemo(always);
      useMemo(once, []);
      return h('p', {}, n);
    });
    set(1);
    await app.settled();
    expect(always).toHaveBeenCalledTimes(2);
    expect(once).toHaveBeenCalledTimes(1);
  });
});

describe('useEffect', () => {
  it('DOM commit 후 실행하고 의존성 변경 전 cleanup, Unmount에 마지막 cleanup을 실행한다', async () => {
    let set;
    const calls = [];
    const app = mount(() => {
      const [n, s] = useState(0);
      set = s;
      useEffect(() => {
        calls.push('effect:' + n + ':' + document.body.textContent);
        return () => calls.push('cleanup:' + n);
      }, [n]);
      return h('p', {}, n);
    });
    expect(calls[0]).toBe('effect:0:0');
    set(1);
    await app.settled();
    expect(calls).toEqual(['effect:0:0', 'cleanup:0', 'effect:1:1']);
    app.unmount();
    app.unmount();
    expect(calls.at(-1)).toBe('cleanup:1');
    expect(calls).toHaveLength(4);
  });
  it('[]는 mount/unmount만, 생략한 의존성은 매 commit 실행한다', async () => {
    let set;
    const once = vi.fn(),
      every = vi.fn();
    const app = mount(() => {
      const [n, s] = useState(0);
      set = s;
      useEffect(once, []);
      useEffect(every);
      return h('p', {}, n);
    });
    set(1);
    await app.settled();
    expect(once).toHaveBeenCalledTimes(1);
    expect(every).toHaveBeenCalledTimes(2);
  });
  it('타이머 Effect를 해제하면 더 이상 상태가 바뀌지 않는다', async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn();
    const app = mount(() => {
      const [ticks, set] = useState(0);
      useEffect(() => {
        const id = setInterval(() => set((v) => v + 1), 1000);
        return () => {
          clearInterval(id);
          cleanup();
        };
      }, []);
      return h('p', {}, ticks);
    });
    await vi.advanceTimersByTimeAsync(2000);
    await app.settled();
    expect(app.root.textContent).toBe('2');
    app.unmount();
    await vi.advanceTimersByTimeAsync(2000);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
