import { describe, expect, it, vi } from 'vitest';
import {
  FunctionComponent,
  useState,
} from '../src/component/function-component.js';

const text = (value) => ({ type: 'text', value: String(value) });
const paragraph = (value) => ({
  type: 'element',
  tag: 'p',
  props: {},
  children: [text(value)],
});
function container() {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return element;
}

describe('FunctionComponent와 useState', () => {
  it('첫 실행에만 초기값을 저장하고 이전 setter도 같은 칸을 갱신한다', () => {
    let increment;
    let rename;
    const host = container();
    const component = new FunctionComponent(() => {
      const [count, setCount] = useState(0);
      const [name, setName] = useState('정글');
      increment = setCount;
      rename = setName;
      return paragraph(`${count}/${name}`);
    }, host);
    component.mount();
    const oldSetter = increment;
    const root = host.firstChild;
    oldSetter((previous) => previous + 1);
    rename('학습자');
    oldSetter((previous) => previous + 1);
    expect(host.textContent).toBe('2/학습자');
    expect(component.hooks.map((hook) => hook.value)).toEqual([2, '학습자']);
    expect(increment).toBe(oldSetter);
    expect(host.firstChild).toBe(root);
    expect(component.patches).toEqual([
      { type: 'TEXT', path: [0], value: '2/학습자' },
    ]);
  });

  it('동일한 상태 값이면 컴포넌트를 다시 실행하지 않는다', () => {
    let setValue;
    const render = vi.fn(() => {
      const [value, setter] = useState(undefined);
      setValue = setter;
      return paragraph(value);
    });
    const component = new FunctionComponent(render, container());
    component.mount();
    setValue(undefined);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('상태는 서로 다른 루트 객체 사이에서 섞이지 않는다', () => {
    const setters = [];
    const hosts = [container(), container()];
    const roots = hosts.map(
      (host, index) =>
        new FunctionComponent(() => {
          const [value, setValue] = useState(index);
          setters[index] = setValue;
          return paragraph(value);
        }, host),
    );
    roots.forEach((root) => root.mount());
    setters[0](10);
    expect(hosts.map((host) => host.textContent)).toEqual(['10', '1']);
  });

  it('Hook 호출 수가 바뀌면 오류를 내고 다른 렌더에 영향을 주지 않는다', () => {
    let extra = true;
    const host = container();
    const component = new FunctionComponent(() => {
      const [count] = useState(0);
      if (extra) useState('정글');
      return paragraph(count);
    }, host);
    component.mount();
    extra = false;
    expect(() => component.update()).toThrow(/Hook/);
    expect(host.textContent).toBe('0');
    expect(() => useState(1)).toThrow(/컴포넌트/);
    extra = true;
    component.update();
    expect(component.hooks).toHaveLength(2);
  });

  it('렌더 중 상태 변경을 거절하고 오류 시 상태 값을 되돌린다', () => {
    let setter;
    const host = container();
    const component = new FunctionComponent(() => {
      const [value, setValue] = useState(0);
      setter = setValue;
      if (value === 1) setValue(2);
      return paragraph(value);
    }, host);
    component.mount();
    expect(() => setter(1)).toThrow(/렌더/);
    expect(component.hooks[0].value).toBe(0);
    expect(host.textContent).toBe('0');
    setter(3);
    expect(host.textContent).toBe('3');
  });

  it('마운트 전 갱신·중복 마운트는 거절하고 루트 교체를 반영한다', () => {
    let setter;
    const host = container();
    const component = new FunctionComponent(
      (props) => {
        const [value, setValue] = useState(0);
        setter = setValue;
        return { ...paragraph(props.label), tag: value ? 'strong' : 'p' };
      },
      host,
      { label: '샘플' },
    );
    expect(() => component.update()).toThrow(/mount/);
    component.mount();
    expect(() => component.mount()).toThrow(/mount/);
    setter(1);
    expect(host.firstChild.localName).toBe('strong');
    expect(host.textContent).toBe('샘플');
    setter(2);
    expect(host.children).toHaveLength(1);
  });
});
