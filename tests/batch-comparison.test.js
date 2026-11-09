import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
const page = readFileSync('index.html', 'utf8');
const field = (id, name) =>
  document.querySelector(`#${id} [data-cart-field="${name}"]`).textContent;
const text = (id) => document.getElementById(id).textContent;
beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = page.match(/<body>([\s\S]*)<\/body>/)[1];
  await import('../src/main.js');
});
it('쿠폰 버튼은 할인과 안내를 바꾸며 즉시 2회와 배칭 1회의 최종 금액은 같다', () => {
  document.querySelector('#batch-apply').click();
  for (const id of ['batch-immediate-root', 'batch-batched-root']) {
    expect(field(id, 'discount')).toBe('-3,000원');
    expect(field(id, 'total')).toBe('9,000원');
    expect(field(id, 'notice')).toContain('적용');
  }
  expect(text('batch-immediate-updates')).toBe('2');
  expect(text('batch-batched-updates')).toBe('1');
  expect(
    document.querySelector('#batch-immediate-trace').children,
  ).toHaveLength(2);
  expect(document.querySelector('#batch-batched-trace').children).toHaveLength(
    1,
  );
  expect(text('batch-status')).toContain('일치');
});
it('작은 갱신 화면에 할인·결제 금액 변경 후 안내 변경 순서를 표시한다', () => {
  document.querySelector('#batch-apply').click();
  const rows = [...document.querySelector('#batch-immediate-trace').children];
  const changed = (row) =>
    [...row.querySelectorAll('[data-snapshot-field].batch-changed')].map(
      (e) => e.dataset.snapshotField,
    );
  expect(changed(rows[0])).toEqual(['discount', 'total']);
  expect(changed(rows[1])).toEqual(['notice']);
  expect(
    rows[0].querySelector('[data-snapshot-field="notice"]').textContent,
  ).toBe('쿠폰 안내 없음');
  expect(
    rows[1].querySelector('[data-snapshot-field="notice"]').textContent,
  ).toContain('적용');
  expect(
    changed(document.querySelector('#batch-batched-trace').firstChild),
  ).toEqual(['discount', 'total', 'notice']);
});
it('단일 배송 요청 변경은 양쪽 갱신 1회이고 다른 실습 상태는 유지한다', () => {
  document.querySelector('#batch-controls [data-cart-action="note"]').click();
  expect(text('batch-immediate-updates')).toBe('1');
  expect(text('batch-batched-updates')).toBe('1');
  expect(field('state-root', 'note')).toBe('문 앞에 놓아주세요');
  expect(field('batch-immediate-root', 'total')).toBe('12,000원');
});
it('공통 조작 바로 아래에 현재 장바구니를 두고 변경 위치만 강조한다', () => {
  for (const id of ['batch-immediate-root', 'batch-batched-root']) {
    expect(document.getElementById(id).closest('details').id).toBe(
      'phase2-batch-experiment',
    );
  }
  expect(document.querySelector('#batch-history').open).toBe(false);
  document.querySelector('#batch-apply').click();
  document.querySelector('#batch-controls [data-cart-action="add"]').click();
  for (const id of ['batch-immediate-root', 'batch-batched-root']) {
    expect(field(id, 'quantity')).toBe('2');
    expect(field(id, 'total')).toBe('21,000원');
    expect(
      [...document.querySelectorAll(`#${id} .batch-changed`)].map(
        (e) => e.dataset.cartField,
      ),
    ).toEqual(['quantity', 'subtotal', 'total']);
  }
  document.querySelector('#batch-controls [data-cart-action="note"]').click();
  expect(
    [...document.querySelectorAll('#batch-batched-root .batch-changed')].map(
      (e) => e.dataset.cartField,
    ),
  ).toEqual(['note']);
  document.querySelector('#batch-reset').click();
  expect(
    document.querySelectorAll(
      '#batch-comparison [data-cart-field].batch-changed',
    ),
  ).toHaveLength(0);
  expect(
    document.querySelector('#batch-controls [data-cart-action="remove"]')
      .disabled,
  ).toBe(true);
  expect(
    document.querySelector('#batch-controls [data-cart-action="dismiss"]')
      .disabled,
  ).toBe(true);
});
it('쿠폰 재클릭은 취소가 되고 반복 초기화는 상태와 이벤트를 복원한다', () => {
  document.querySelector('#batch-apply').click();
  document.querySelector('#batch-apply').click();
  expect(field('batch-batched-root', 'total')).toBe('12,000원');
  expect(field('batch-batched-root', 'notice')).toContain('취소');
  document.querySelector('#batch-reset').click();
  document.querySelector('#batch-reset').click();
  document.querySelector('#batch-apply').click();
  expect(field('batch-batched-root', 'total')).toBe('9,000원');
  expect(text('batch-batched-updates')).toBe('1');
});
it('세 실험은 같은 접기 방식으로 상태·계산·선택 배칭 순서다', () => {
  const details = [
    ...document.querySelectorAll('.phase2-experiments > details'),
  ];
  expect(details.map((e) => e.id)).toEqual([
    'phase2-state-experiment',
    'phase2-memo-experiment',
    'phase2-batch-experiment',
  ]);
  expect(details.every((e) => !e.open)).toBe(true);
  document.querySelector('#state-open-comparison').click();
  expect(details[0].open).toBe(true);
});
