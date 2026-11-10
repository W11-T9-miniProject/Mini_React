import { describe, expect, it } from 'vitest';
import { setupPlayground } from '../src/playground/controller.js';

describe('playground', () => {
  it('초기 샘플을 독립된 두 영역에 배치한다', () => {
    document.body.innerHTML =
      '<div id="actual-root"></div><div id="test-root"></div>';
    setupPlayground();
    const actual = document.querySelector('#actual-root > article');
    const test = document.querySelector('#test-root > article');
    expect(actual).not.toBeNull();
    expect(test).not.toBeNull();
    expect(actual.isEqualNode(test)).toBe(true);
    test.querySelector('p').textContent = '수정';
    expect(actual.querySelector('p').textContent).not.toBe('수정');
  });
  it('편집 후 Patch와 뒤로/앞으로 이동을 동기화한다', () => {
    document.body.innerHTML =
      '<button id="patch-button"></button><button id="undo-button"></button><button id="redo-button"></button><pre id="patch-output"></pre><div id="actual-root"></div><div id="test-root"></div>';
    setupPlayground();
    const test = document.querySelector('#test-root p');
    test.textContent = '수정';
    document.querySelector('#patch-button').click();
    expect(document.querySelector('#actual-root p').textContent).toBe('수정');
    document.querySelector('#test-root p').textContent = '미적용';
    document.querySelector('#undo-button').click();
    expect(document.querySelector('#actual-root p').textContent).toContain(
      '테스트 영역',
    );
    expect(document.querySelector('#test-root p').textContent).toContain(
      '테스트 영역',
    );
    document.querySelector('#redo-button').click();
    expect(document.querySelector('#actual-root p').textContent).toBe('수정');
    expect(document.querySelector('#test-root p').textContent).toBe('수정');
  });
});
