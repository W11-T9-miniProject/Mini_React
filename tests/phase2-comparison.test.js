import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
const page = readFileSync('index.html', 'utf8');
const field = (id, name) =>
  document.querySelector(`#${id} [data-cart-field="${name}"]`).textContent;
beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = page.match(/<body>([\s\S]*)<\/body>/)[1];
  await import('../src/main.js');
});
it('직접 DOM과 상태 기반 장바구니에 같은 수량·배송 요청을 적용한다', () => {
  document
    .querySelector('#phase2-manual-root [data-cart-action="add"]')
    .click();
  for (const id of ['phase2-manual-root', 'phase2-hook-root']) {
    expect(field(id, 'quantity')).toBe('2');
    expect(field(id, 'total')).toBe('24,000원');
  }
  document.querySelector('#phase2-hook-root [data-cart-action="note"]').click();
  for (const id of ['phase2-manual-root', 'phase2-hook-root']) {
    expect(field(id, 'note')).toBe('경비실에 맡겨주세요');
    expect(field(id, 'total')).toBe('24,000원');
  }
  expect(
    document.querySelector('#phase2-comparison-status').textContent,
  ).toContain('일치');
  expect(field('state-root', 'quantity')).toBe('1');
});
it('쿠폰 적용·안내 닫기·취소와 최소 수량을 양쪽에서 동일하게 처리한다', () => {
  const left = document.querySelector('#phase2-manual-root');
  left.querySelector('[data-cart-action="coupon"]').click();
  expect(
    document.querySelector('#phase2-comparison-status').textContent,
  ).toContain('쿠폰 적용');
  for (const id of ['phase2-manual-root', 'phase2-hook-root']) {
    expect(field(id, 'total')).toBe('9,000원');
    expect(field(id, 'notice')).toContain('적용');
  }
  left.querySelector('[data-cart-action="dismiss"]').click();
  expect(field('phase2-hook-root', 'notice')).toBe('쿠폰 안내 없음');
  left.querySelector('[data-cart-action="coupon"]').click();
  expect(field('phase2-hook-root', 'total')).toBe('12,000원');
  expect(left.querySelector('[data-cart-action="remove"]').disabled).toBe(true);
});
it('초기화 후에도 이벤트가 중복되지 않고 각 방식의 처리 기록을 표시한다', () => {
  const reset = document.querySelector('#phase2-reset-button');
  reset.click();
  reset.click();
  document.querySelector('#phase2-hook-root [data-cart-action="add"]').click();
  expect(field('phase2-hook-root', 'quantity')).toBe('2');
  expect(document.querySelector('#phase2-manual-trace').textContent).toContain(
    '직접 DOM',
  );
  expect(document.querySelector('#phase2-hook-trace').textContent).toContain(
    'Diff',
  );
});
it('수량 변경에도 기존 장바구니 요소를 유지하고 모든 상태 값이 일치한다', () => {
  const roots = ['phase2-manual-root', 'phase2-hook-root'].map((id) =>
    document.querySelector(`#${id} article`),
  );
  roots[0].querySelector('[data-cart-action="add"]').click();
  ['phase2-manual-root', 'phase2-hook-root'].forEach((id, i) =>
    expect(document.querySelector(`#${id} article`)).toBe(roots[i]),
  );
  for (const name of [
    'quantity',
    'subtotal',
    'discount',
    'total',
    'note',
    'notice',
  ])
    expect(field('phase2-manual-root', name)).toBe(
      field('phase2-hook-root', name),
    );
});
