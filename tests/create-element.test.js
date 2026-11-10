import { describe, expect, it, vi } from 'vitest';
import { h, renderChild } from '../src/component/create-element.js';
import { render } from '../src/vdom/render.js';
import { diff } from '../src/vdom/diff.js';
import { patch } from '../src/vdom/patch.js';

describe('h', () => {
  it('평탄화된 배열 자식과 문자열·숫자를 Text VNode로 바꾼다', () => {
    expect(
      h('div', { id: 'sample' }, 'hello', [
        1,
        ['world', h('em', null, 'nested')],
      ]),
    ).toEqual({
      type: 'element',
      tag: 'div',
      props: { id: 'sample' },
      children: [
        { type: 'text', value: 'hello' },
        { type: 'text', value: '1' },
        { type: 'text', value: 'world' },
        {
          type: 'element',
          tag: 'em',
          props: {},
          children: [{ type: 'text', value: 'nested' }],
        },
      ],
    });
  });

  it('null, undefined, boolean 자식은 생략한다', () => {
    expect(
      h('div', null, null, undefined, true, false, ['visible', null]),
    ).toEqual({
      type: 'element',
      tag: 'div',
      props: {},
      children: [{ type: 'text', value: 'visible' }],
    });
  });

  it('VNode나 배열이 아닌 객체 자식은 TypeError로 거부한다', () => {
    expect(() => h('div', null, { text: 'invalid' })).toThrow(TypeError);
  });

  it('tag 양끝 공백을 정규화하고 잘못된 자식 VNode를 거부한다', () => {
    expect(h(' div ', null, 'text').tag).toBe('div');
    const invalidChildTree = {
      type: 'element',
      tag: 'span',
      props: {},
      children: [null],
    };
    expect(() => renderChild(() => invalidChildTree)).toThrow(TypeError);
  });

  it('잘못된 HTML 속성 이름을 VNode 생성 시 거부한다', () => {
    expect(() => h('div', { 'bad name': 'x' })).toThrow(TypeError);
  });

  it('잘못된 HTML 태그 이름을 VNode 생성 시 거부한다', () => {
    expect(() => h('bad tag', null)).toThrow(TypeError);
  });

  it('입력 props를 수정하지 않고 특수한 속성 이름도 보존한다', () => {
    const props = { title: 'sample' };
    Object.defineProperty(props, '__proto__', {
      value: 'safe',
      enumerable: true,
    });
    const vnode = h('div', props);

    expect(Object.hasOwn(vnode.props, '__proto__')).toBe(true);
    expect(vnode.props.__proto__).toBe('safe');
    expect(props.title).toBe('sample');
    expect(Object.hasOwn(props, '__proto__')).toBe(true);
  });

  it('key는 VNode 식별자로 추출하고 DOM 일반 속성에서는 제외한다', () => {
    const props = { key: 'row-1', title: 'row' };
    const vnode = h('li', props, 'row');

    expect(vnode).toEqual({
      type: 'element',
      tag: 'li',
      key: 'row-1',
      props: { title: 'row' },
      children: [{ type: 'text', value: 'row' }],
    });
    expect(props).toEqual({ key: 'row-1', title: 'row' });
  });

  it('key는 문자열과 숫자만 받고 빈 값은 거부한다', () => {
    expect(() => h('li', { key: '' })).toThrow(TypeError);
    expect(() => h('li', { key: {} })).toThrow(TypeError);
    expect(h('li', { key: 7 }).key).toBe(7);
  });

  it('renderChild는 함수의 VNode 결과만 반환한다', () => {
    expect(
      renderChild(({ label }) => h('b', null, label), { label: 'child' }),
    ).toEqual(h('b', null, 'child'));
    expect(() => renderChild(() => 'not a vnode')).toThrow(TypeError);
    expect(() => renderChild(null)).toThrow(TypeError);
  });
});

describe('이벤트 prop', () => {
  it('render가 onClick 핸들러와 일반 속성을 함께 설정한다', () => {
    const onClick = vi.fn();
    const button = render(h('button', { onClick, title: 'sample' }, 'click'));

    expect(button.getAttribute('title')).toBe('sample');
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Patch로 핸들러를 교체하면 새 핸들러만 실행하고 일반 속성도 갱신한다', () => {
    const oldHandler = vi.fn();
    const nextHandler = vi.fn();
    const previous = h(
      'button',
      { onClick: oldHandler, title: 'before' },
      'click',
    );
    const next = h('button', { onClick: nextHandler, title: 'after' }, 'click');
    const button = patch(render(previous), diff(previous, next));

    expect(button.getAttribute('title')).toBe('after');
    button.click();
    expect(oldHandler).not.toHaveBeenCalled();
    expect(nextHandler).toHaveBeenCalledTimes(1);
  });

  it('Patch로 핸들러를 추가하고 제거한다', () => {
    const onClick = vi.fn();
    const withoutHandler = h('button', { title: 'plain' }, 'click');
    const withHandler = h('button', { onClick, title: 'interactive' }, 'click');
    const button = patch(
      render(withoutHandler),
      diff(withoutHandler, withHandler),
    );

    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    const withoutHandlerAgain = h('button', { title: 'plain' }, 'click');
    const updatedButton = patch(button, diff(withHandler, withoutHandlerAgain));
    updatedButton.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(updatedButton.getAttribute('title')).toBe('plain');
  });

  it('문자열 인라인 이벤트 속성은 실행 가능한 HTML로 설치하지 않는다', () => {
    expect(() =>
      render({
        type: 'element',
        tag: 'button',
        props: { onclick: 'alert(1)' },
        children: [],
      }),
    ).toThrow(TypeError);
  });
});
