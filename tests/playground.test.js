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
  it.todo('편집 → Patch → 뒤로 → 앞으로 이동한다');
  it.todo('미적용 편집 후 이력 이동 시 두 영역을 목표 상태로 맞춘다');
});
