import { it, expect } from 'vitest';
import { setupProof } from '../src/playground/proof.js';

it('실제 엔진의 참조, 명령, 이력 분기와 Hook 오류를 화면에 표시한다', async () => {
  document.body.innerHTML =
    '<nav class="view-nav"></nav><main class="workspace"></main>';
  const cleanup = setupProof();
  const click = (action) =>
    document.querySelector(`[data-proof-action="${action}"]`).click();
  const output = (id) =>
    document.querySelector(`[data-proof="${id}"] [data-evidence]`).textContent;
  try {
    click('patch');
    expect(output('dom')).toContain('최초 Text === 현재: true');
    click('replace');
    expect(output('dom')).toContain('최초 element === 현재: false');
    click('commands');
    expect(output('commands')).toContain('PASS · 명령 전체 일치');
    expect(output('commands')).toContain('PASS · 적용 결과 일치');
    click('push');
    click('push');
    click('undo');
    expect(output('history')).toContain('커서 2 / 3');
    click('redo');
    expect(output('history')).toContain('커서 3 / 3');
    click('undo');
    click('push');
    expect(output('history')).toContain('PASS');
    expect(document.querySelector('[data-proof-action="redo"]').disabled).toBe(
      true,
    );
    click('hooks');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(output('hooks')).toContain('PASS · 최초 슬롯 참조 유지');
    expect(
      document.querySelector('[data-proof="hooks"] [data-stage]').textContent,
    ).toContain('count 1 / memo 2');
    click('invalid');
    expect(output('hooks')).toContain('예상 오류 관찰: Hook');
  } finally {
    cleanup();
  }
  expect(document.querySelector('#proof')).toBeNull();
});
