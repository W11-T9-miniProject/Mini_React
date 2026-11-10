import { describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../src/component/function-component.js';
import { h } from '../src/component/create-element.js';

describe('FunctionComponent mount/update/unmount', () => {
  it('mount는 컴포넌트를 실행하고 DOM을 설치한 뒤 실제 루트를 반환한다', () => {
    const Component = vi.fn(({ label }) =>
      h('main', { 'data-label': label }, h('p', null, label)),
    );
    const instance = new FunctionComponent(Component, { label: '처음' });
    const container = document.createElement('div');

    const root = instance.mount(container);

    expect(Component).toHaveBeenCalledTimes(1);
    expect(Component).toHaveBeenCalledWith({ label: '처음' });
    expect(root).toBe(container.firstChild);
    expect(root.tagName).toBe('MAIN');
    expect(root.getAttribute('data-label')).toBe('처음');
    expect(root.querySelector('p').textContent).toBe('처음');
  });

  it('update(nextProps)는 다시 실행하고 변경된 text/속성을 갱신하며 루트와 불변 자식 참조를 유지한다', () => {
    const Component = vi.fn(({ label, title }) =>
      h(
        'main',
        { title },
        h('p', null, label),
        h('aside', { id: 'stable' }, '변하지 않음'),
      ),
    );
    const instance = new FunctionComponent(Component, {
      label: '처음',
      title: 'old',
    });
    const container = document.createElement('div');
    const root = instance.mount(container);
    const stableAside = root.querySelector('#stable');
    const updatedRoot = instance.update({ label: '다음', title: 'new' });

    expect(Component).toHaveBeenCalledTimes(2);
    expect(Component).toHaveBeenLastCalledWith({ label: '다음', title: 'new' });
    expect(updatedRoot).toBe(root);
    expect(container.firstChild).toBe(root);
    expect(root.getAttribute('title')).toBe('new');
    expect(root.querySelector('p').textContent).toBe('다음');
    expect(root.querySelector('#stable')).toBe(stableAside);
  });

  it('변경 없는 update는 컴포넌트를 실행해도 기존 DOM 노드 참조를 유지한다', () => {
    const Component = ({ label }) =>
      h('section', null, h('strong', null, label));
    const instance = new FunctionComponent(Component, { label: '같음' });
    const container = document.createElement('div');
    const root = instance.mount(container);
    const strong = root.querySelector('strong');

    expect(instance.update({ label: '같음' })).toBe(root);
    expect(root.querySelector('strong')).toBe(strong);
  });

  it('루트 태그가 바뀌면 새 루트 참조를 반환하고 컨테이너도 교체한다', () => {
    const Component = ({ tag }) => h(tag, null, 'root');
    const instance = new FunctionComponent(Component, { tag: 'main' });
    const container = document.createElement('div');
    const oldRoot = instance.mount(container);

    const newRoot = instance.update({ tag: 'article' });

    expect(newRoot).not.toBe(oldRoot);
    expect(newRoot.tagName).toBe('ARTICLE');
    expect(container.firstChild).toBe(newRoot);
    instance.unmount();
    expect(container.childNodes).toHaveLength(0);
  });

  it('mount 전 update는 설명 가능한 오류를 낸다', () => {
    const instance = new FunctionComponent(() => h('div', null), {});

    expect(() => instance.update({})).toThrow();
  });

  it('컴포넌트 실행이 실패하면 DOM과 기존 props를 보존한다', () => {
    const Component = ({ label }) => {
      if (label === '오류') throw new Error('render failed');
      return h('p', null, label);
    };
    const instance = new FunctionComponent(Component, { label: '기존값' });
    const container = document.createElement('div');
    const root = instance.mount(container);

    expect(() => instance.update({ label: '오류' })).toThrow('render failed');
    expect(container.firstChild).toBe(root);
    expect(root.textContent).toBe('기존값');
    expect(instance.update()).toBe(root);
  });

  it('잘못된 VNode 반환은 Patch 전에 거부하고 기존 DOM을 보존한다', () => {
    const Component = ({ invalid }) =>
      invalid
        ? {
            type: 'element',
            tag: 'p',
            props: { onclick: 'unsafe' },
            children: [],
          }
        : h('p', null, '기존 화면');
    const instance = new FunctionComponent(Component, { invalid: false });
    const container = document.createElement('div');
    const root = instance.mount(container);

    expect(() => instance.update({ invalid: true })).toThrow(TypeError);
    expect(container.firstChild).toBe(root);
    expect(root.textContent).toBe('기존 화면');
    expect(instance.update()).toBe(root);
  });

  it('잘못된 속성 이름은 자식 Patch를 시작하기 전에 거부한다', () => {
    const Component = ({ invalid }) =>
      h(
        'div',
        null,
        h('span', null, invalid ? 'new' : 'old'),
        invalid
          ? {
              type: 'element',
              tag: 'button',
              props: { 'bad name': 'x' },
              children: [],
            }
          : h('button', null, 'ok'),
      );
    const instance = new FunctionComponent(Component, { invalid: false });
    const container = document.createElement('div');
    const root = instance.mount(container);

    expect(() => instance.update({ invalid: true })).toThrow(TypeError);
    expect(root.querySelector('span').textContent).toBe('old');
    expect(instance.update()).toBe(root);
  });

  it('같은 인스턴스를 중복 mount하면 오류를 내고 기존 루트를 유지한다', () => {
    const instance = new FunctionComponent(() => h('div', null, 'root'), {});
    const firstContainer = document.createElement('div');
    const secondContainer = document.createElement('div');
    const root = instance.mount(firstContainer);

    expect(() => instance.mount(secondContainer)).toThrow();
    expect(firstContainer.firstChild).toBe(root);
    expect(secondContainer.childNodes).toHaveLength(0);
  });

  it('unmount는 루트를 제거하고 반복 호출해도 안전하다', () => {
    const instance = new FunctionComponent(() => h('div', null, 'root'), {});
    const container = document.createElement('div');
    instance.mount(container);

    instance.unmount();
    expect(container.childNodes).toHaveLength(0);
    expect(() => instance.unmount()).not.toThrow();
    expect(container.childNodes).toHaveLength(0);
  });

  it('외부에서 다른 컨테이너로 옮긴 루트도 unmount하면 제거한다', () => {
    const instance = new FunctionComponent(() => h('div', null, 'root'), {});
    const first = document.createElement('div');
    const second = document.createElement('div');
    const root = instance.mount(first);
    second.appendChild(root);

    instance.unmount();

    expect(first.childNodes).toHaveLength(0);
    expect(second.childNodes).toHaveLength(0);
  });
});
