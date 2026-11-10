import { it, expect } from 'vitest';
import { setupLearning } from '../src/playground/learning.js';

it('초기 학습 화면에서 실제 엔진을 단계별 실행하고 같은 DOM 참조를 유지한다', () => {
  document.body.innerHTML =
    '<nav class="view-nav"><button data-view="phase1"></button></nav><main class="workspace"><section id="phase1"></section></main>';
  const cleanup = setupLearning();
  try {
    expect(document.querySelector('#phase1').hidden).toBe(true);
    const original = document.querySelector('[data-learn-dom] p');
    const next = document.querySelector('[data-learn-next]');
    next.click();
    next.click();
    next.click();
    expect(original.textContent).toBe('안녕');
    expect(document.querySelector('[data-learn-output]').textContent).toContain(
      'TEXT',
    );
    next.click();
    expect(document.querySelector('[data-learn-dom] p')).toBe(original);
    expect(original.textContent).toBe('반가워');
    next.click();
    expect(next.disabled).toBe(true);
    expect(document.querySelector('[data-learn-output]').textContent).toContain(
      'Undo 가능: true',
    );
    document.querySelector('[data-learn-reset]').click();
    expect(document.querySelector('[data-learn-dom]').textContent).toBe('안녕');
    expect(next.disabled).toBe(false);
  } finally {
    cleanup();
  }
  expect(document.querySelector('#learn')).toBeNull();
});

it('함수형 setter 배칭, 같은 값 생략, commit 후 Effect 순서를 실제 런타임으로 보여준다', async () => {
  document.body.innerHTML =
    '<nav class="view-nav"></nav><main class="workspace"></main>';
  const cleanup = setupLearning();
  try {
    document.querySelector('[data-learn-batch]').click();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(
      document.querySelector('[data-learn-batch-result]').textContent,
    ).toContain('0 → 3 / 실제 추가 렌더 1회');
    expect(
      document.querySelector('[data-learn-effects]').textContent,
    ).toContain('cleanup(0)\neffect(3) · commit된 DOM: count = 3');
    document.querySelector('[data-learn-noop]').click();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(
      document.querySelector('[data-learn-batch-result]').textContent,
    ).toContain('실제 추가 렌더 0회');
  } finally {
    cleanup();
  }
});
