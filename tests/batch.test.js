import { describe, expect, it } from 'vitest';
import * as runtime from '../src/component/function-component.js';

function counter(extra = () => {}) {
  const host = document.createElement('div');
  const renders = [];
  let countSetter;
  let nameSetter;
  const component = new runtime.FunctionComponent(() => {
    const [count, setCount] = runtime.useState(0);
    const [name, setName] = runtime.useState('정글');
    countSetter = setCount;
    nameSetter = setName;
    extra(count, name);
    runtime.useEffect(() => {
      renders.push(host.textContent);
    }, [count, name]);
    return {
      type: 'element',
      tag: 'p',
      props: {},
      children: [{ type: 'text', value: `${count}/${name}` }],
    };
  }, host);
  component.mount();
  renders.length = 0;
  return {
    host,
    component,
    renders,
    count: (value) => countSetter(value),
    name: (value) => nameSetter(value),
  };
}

describe('명시적 batch', () => {
  it('콜백 안에서는 이전 DOM을 유지하고 두 상태를 한 번에 커밋한다', () => {
    const c = counter();
    expect(typeof runtime.batch).toBe('function');
    const result = runtime.batch(() => {
      c.count(1);
      expect(c.host.textContent).toBe('0/정글');
      c.name('학습자');
      expect(c.host.textContent).toBe('0/정글');
      return '완료';
    });
    expect(result).toBe('완료');
    expect(c.renders).toEqual(['1/학습자']);
    c.count(2);
    expect(c.renders).toEqual(['1/학습자', '2/학습자']);
  });
  it('중첩 블록은 바깥 끝에서 한 번 갱신하며 함수형 변경을 순서대로 누적한다', () => {
    const c = counter();
    runtime.batch(() => {
      c.count((n) => n + 1);
      runtime.batch(() => {
        c.count((n) => n + 1);
        c.name('학습자');
      });
      expect(c.renders).toEqual([]);
      c.count((n) => n + 1);
    });
    expect(c.renders).toEqual(['3/학습자']);
  });
  it('변경 없는 setter와 빈 배칭은 불필요한 갱신을 만들지 않는다', () => {
    const c = counter();
    runtime.batch(() => {
      c.count(0);
      c.name('정글');
    });
    runtime.batch(() => {});
    expect(c.renders).toEqual([]);
    expect(c.component.commitVersion).toBe(1);
  });
  it('여러 루트를 각각 한 번 갱신하고 언마운트된 루트는 제외한다', () => {
    const a = counter();
    const b = counter();
    runtime.batch(() => {
      a.count(1);
      b.count(2);
      a.name('학습자');
      b.component.unmount();
    });
    expect(a.renders).toEqual(['1/학습자']);
    expect(b.host.childNodes).toHaveLength(0);
    expect(b.renders).toEqual([]);
  });
  it('콜백 예외에도 완료된 상태 변경을 반영하며 다음 즉시 갱신에 영향이 없다', () => {
    const c = counter();
    expect(() =>
      runtime.batch(() => {
        c.count(1);
        throw new Error('콜백 실패');
      }),
    ).toThrow('콜백 실패');
    expect(c.host.textContent).toBe('1/정글');
    c.count(2);
    expect(c.renders).toEqual(['1/정글', '2/정글']);
    expect(() => runtime.batch(null)).toThrow(/함수/);
  });
  it('지연된 렌더 실패는 이전 상태로 복구하고 다른 루트 갱신을 막지 않는다', () => {
    const a = counter((count) => {
      if (count === 1) throw new Error('렌더 실패');
    });
    const b = counter();
    expect(() =>
      runtime.batch(() => {
        a.count(1);
        a.name('실패');
        b.count(2);
      }),
    ).toThrow('렌더 실패');
    expect(a.component.hooks.slice(0, 2).map((hook) => hook.value)).toEqual([
      0,
      '정글',
    ]);
    expect(a.host.textContent).toBe('0/정글');
    expect(b.host.textContent).toBe('2/정글');
    a.count(3);
    expect(a.host.textContent).toBe('3/정글');
  });
  it('배칭 안에서 언마운트 후 다시 마운트해도 오래된 갱신이 새 인스턴스에 섞이지 않는다', () => {
    const c = counter();
    runtime.batch(() => {
      c.count(1);
      c.component.unmount();
      c.component.mount();
      c.name('새 상태');
    });
    expect(c.host.textContent).toBe('0/새 상태');
    expect(c.renders).toEqual(['0/정글', '0/새 상태']);
  });
  it('Effect의 후속 상태 변경은 기존 규칙대로 끝난 뒤 처리한다', () => {
    let setter;
    const c = counter((count) => {
      const [effectValue, setEffect] = runtime.useState(0);
      setter = setEffect;
      runtime.useEffect(() => {
        if (count === 1 && effectValue === 0) setEffect(1);
      }, [count, effectValue]);
    });
    runtime.batch(() => {
      c.count(1);
      c.name('학습자');
    });
    expect(c.host.textContent).toBe('1/학습자');
    expect(c.component.hooks[2].value).toBe(1);
    setter(2);
    expect(c.component.hooks[2].value).toBe(2);
  });
  it('콜백과 지연 렌더가 모두 실패해도 두 오류를 보존하고 대기 상태를 비운다', () => {
    const c = counter((count) => {
      if (count === 1) throw new Error('렌더 실패');
    });
    let failure;
    try {
      runtime.batch(() => {
        c.count(1);
        throw new Error('콜백 실패');
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.errors.map((error) => error.message)).toEqual([
      '콜백 실패',
      '렌더 실패',
    ]);
    expect(c.host.textContent).toBe('0/정글');
    c.count(2);
    expect(c.host.textContent).toBe('2/정글');
  });

  it('Effect가 실패해도 이미 커밋한 배칭 결과는 되돌리지 않는다', () => {
    const c = counter((count) => {
      runtime.useEffect(() => {
        if (count === 1) throw new Error('Effect 실패');
      }, [count]);
    });
    expect(() =>
      runtime.batch(() => {
        c.count(1);
        c.name('학습자');
      }),
    ).toThrow('Effect 실패');
    expect(c.host.textContent).toBe('1/학습자');
    expect(c.component.hooks.slice(0, 2).map((hook) => hook.value)).toEqual([
      1,
      '학습자',
    ]);
    c.count(2);
    expect(c.host.textContent).toBe('2/학습자');
  });

  it('먼저 갱신한 루트의 Effect가 대기 중인 다른 루트를 바꿔도 중복 갱신하지 않는다', () => {
    const b = counter();
    const a = counter((count) => {
      runtime.useEffect(() => {
        if (count === 1) b.count(3);
      }, [count]);
    });
    runtime.batch(() => {
      a.count(1);
      b.count(2);
    });
    expect(a.renders).toEqual(['1/정글']);
    expect(b.renders).toEqual(['3/정글']);
  });

  it('비동기 콜백은 await 이전의 동기 부분까지만 묶는다', async () => {
    const c = counter();
    const pending = runtime.batch(async () => {
      c.count(1);
      c.name('학습자');
      await Promise.resolve();
      c.count(2);
      c.name('정글');
    });
    expect(c.renders).toEqual(['1/학습자']);
    await pending;
    expect(c.renders).toEqual(['1/학습자', '2/학습자', '2/정글']);
  });
});
