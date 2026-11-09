import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import * as price from '../src/playground/phase2-performance.js';
const modes = ['plain', 'manual-cache', 'memo'];
const data = Float64Array.from([1000, 2000, 3000]);
const create = (mode) => {
  const host = document.createElement('div');
  const runner = price.createCartRunner(mode, data, host);
  return { runner, host };
};
const value = (host, key) =>
  host.querySelector(`[data-cart-field="${key}"]`).textContent;
describe('실제 장바구니 금액 계산 비교', () => {
  it('배송 요청은 금액을 유지하며 캐시는 상품 재검사와 버퍼 생성을 생략한다', () => {
    expect(typeof price.createCartRunner).toBe('function');
    const items = modes.map(create);
    for (const { runner, host } of items) {
      runner.change('note');
      runner.change('note');
      expect(value(host, 'total')).toBe('6,000원');
      expect(value(host, 'note')).toBe('문 앞에 놓아주세요');
    }
    expect(items.map(({ runner: r }) => r.metrics().calculations)).toEqual([
      2, 0, 0,
    ]);
    expect(items.map(({ runner: r }) => r.metrics().visits)).toEqual([6, 0, 0]);
    expect(items.map(({ runner: r }) => r.metrics().allocatedBytes)).toEqual([
      48, 0, 0,
    ]);
    expect(items.map(({ runner: r }) => r.metrics().retainedBytes)).toEqual([
      0, 24, 24,
    ]);
    for (const { runner } of items) runner.dispose();
  });
  it('전체 상품 수량을 늘리면 세 방식 모두 같은 금액을 새로 계산한다', () => {
    const items = modes.map(create);
    for (const { runner, host } of items) {
      runner.change('quantity');
      expect(value(host, 'quantity')).toBe('2');
      expect(value(host, 'total')).toBe('12,000원');
      expect(runner.metrics()).toMatchObject({
        calculations: 1,
        visits: 3,
        allocatedBytes: 24,
      });
      expect(runner.metrics().totalMs).toBeGreaterThanOrEqual(0);
      runner.dispose();
      expect(runner.metrics().retainedBytes).toBe(0);
    }
  });
  it('여러 변경 뒤에도 결과가 같고 계측 초기화는 캐시를 유지한다', () => {
    const items = modes.map(create);
    for (const { runner } of items) {
      runner.change('note');
      runner.change('quantity');
      runner.resetMetrics();
      runner.change('note');
    }
    expect(new Set(items.map(({ runner }) => runner.result())).size).toBe(1);
    expect(items.map(({ runner }) => runner.metrics().visits)).toEqual([
      3, 0, 0,
    ]);
    for (const { runner } of items) runner.dispose();
  });
  it('화면에서도 배송 요청과 수량 조건에 따라 실제 검사량을 달리 표시한다', async () => {
    vi.resetModules();
    document.body.innerHTML = readFileSync('index.html', 'utf8').match(
      /<body>([\s\S]*)<\/body>/,
    )[1];
    await import('../src/main.js');
    document.querySelector('#phase2-perf-size').value = '1000';
    const button = document.querySelector('#phase2-perf-run');
    button.click();
    await vi.waitFor(() =>
      expect(
        document.querySelector('#phase2-perf-status').textContent,
      ).toContain('측정 완료'),
    );
    expect(document.querySelector('#perf-plain-visits').textContent).toBe(
      '20,000개',
    );
    expect(document.querySelector('#perf-memo-visits').textContent).toBe('0개');
    document.querySelector('#phase2-perf-action').value = 'quantity';
    button.click();
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    for (const mode of modes)
      expect(document.querySelector(`#perf-${mode}-visits`).textContent).toBe(
        '20,000개',
      );
  });
});
