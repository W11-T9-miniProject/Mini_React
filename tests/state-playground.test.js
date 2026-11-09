import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const page = readFileSync('index.html', 'utf8');

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = page.match(/<body>([\s\S]*)<\/body>/)[1];
  await import('../src/main.js');
});

describe('Phase 2 장바구니 실습', () => {
  it('배송 요청만 바꾸면 상품 금액을 재사용하고 수량을 바꾸면 재계산한다', () => {
    const root = document.querySelector('#state-root');
    expect(root.querySelector('[data-cart-field="quantity"]').textContent).toBe(
      '1',
    );
    expect(root.querySelector('[data-cart-field="total"]').textContent).toBe(
      '12,000원',
    );
    root.querySelector('[data-cart-action="note"]').click();
    expect(root.querySelector('[data-cart-field="note"]').textContent).toBe(
      '경비실에 맡겨주세요',
    );
    expect(document.querySelector('#state-plain-count').textContent).toBe('2');
    expect(document.querySelector('#state-memo-count').textContent).toBe('1');
    root.querySelector('[data-cart-action="add"]').click();
    expect(root.querySelector('[data-cart-field="subtotal"]').textContent).toBe(
      '24,000원',
    );
    expect(document.querySelector('#state-memo-count').textContent).toBe('2');
  });
  it('수량을 바꿀 때만 브라우저 탭의 장바구니 수량을 갱신한다', () => {
    const root = document.querySelector('#state-root');
    root.querySelector('[data-cart-action="note"]').click();
    expect(document.querySelector('#state-effect-count').textContent).toBe('1');
    root.querySelector('[data-cart-action="add"]').click();
    expect(document.title).toBe('장바구니 · 상품 2개');
    expect(document.querySelector('#state-effect-count').textContent).toBe('2');
  });
  it('쿠폰은 할인과 안내를 바꾸고 안내는 독립적으로 닫을 수 있다', () => {
    const root = document.querySelector('#state-root');
    root.querySelector('[data-cart-action="coupon"]').click();
    expect(root.querySelector('[data-cart-field="discount"]').textContent).toBe(
      '-3,000원',
    );
    expect(root.querySelector('[data-cart-field="total"]').textContent).toBe(
      '9,000원',
    );
    expect(root.querySelector('[data-cart-field="notice"]').textContent).toBe(
      '3,000원 쿠폰이 적용되었습니다.',
    );
    root.querySelector('[data-cart-action="dismiss"]').click();
    expect(root.querySelector('[data-cart-field="notice"]').textContent).toBe(
      '쿠폰 안내 없음',
    );
    expect(root.querySelector('[data-cart-field="total"]').textContent).toBe(
      '9,000원',
    );
  });
  it('수량은 1개 미만이 되지 않고 같은 상품 DOM과 실습 상태를 유지한다', () => {
    const root = document.querySelector('#state-root article');
    const remove = root.querySelector('[data-cart-action="remove"]');
    expect(remove.disabled).toBe(true);
    root.querySelector('[data-cart-action="add"]').click();
    remove.click();
    remove.click();
    expect(root.querySelector('[data-cart-field="quantity"]').textContent).toBe(
      '1',
    );
    expect(document.querySelector('#state-root article')).toBe(root);
    document.querySelector('#state-comparison-tab').click();
    document.querySelector('#state-tab').click();
    expect(root.querySelector('[data-cart-field="total"]').textContent).toBe(
      '12,000원',
    );
  });
  it('Phase별 실습·실험 순서대로 키보드로 이동한다', () => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    expect(
      tabs.map((tab) => tab.textContent.trim().replace(/\s+/g, ' ')),
    ).toEqual([
      '기본 실습 · Phase 1',
      '비교 실험 · Phase 1',
      '상태 실습 · Phase 2',
      '비교 실험 · Phase 2',
    ]);
    tabs[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.querySelector('#comparison-panel').hidden).toBe(false);
    expect(document.activeElement).toBe(tabs[1]);
    tabs[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.querySelector('#state-panel').hidden).toBe(false);
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs[3].disabled).toBe(false);
    tabs[2].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.activeElement).toBe(tabs[3]);
    expect(document.querySelector('#state-comparison-panel').hidden).toBe(
      false,
    );
    tabs[3].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.activeElement).toBe(tabs[0]);
  });
});
