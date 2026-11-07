import { describe, expect, it } from 'vitest';
import { applyProps } from '../src/vdom/dom-properties.js';

describe('applyProps', () => {
  it('문자열 속성을 추가하고 기존 값을 변경한다', () => {
    const element = document.createElement('p');
    element.setAttribute('class', 'old');

    applyProps(element, { class: 'greeting', title: '인사' });

    expect(element.getAttribute('class')).toBe('greeting');
    expect(element.getAttribute('title')).toBe('인사');
  });

  it('지정한 속성만 제거하고 나머지는 유지한다', () => {
    const element = document.createElement('p');
    element.setAttribute('class', 'greeting');
    element.setAttribute('title', '인사');

    applyProps(element, {}, ['class']);

    expect(element.hasAttribute('class')).toBe(false);
    expect(element.getAttribute('title')).toBe('인사');
  });
});
