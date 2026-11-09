import { describe, expect, it } from 'vitest';
import {
  cartFields,
  changeCart,
  initialCart,
  createCartView,
  updateCartDOM,
} from '../src/playground/cart-view.js';
import { render } from '../src/vdom/render.js';
describe('장바구니 금액과 직접 갱신', () => {
  it('수량·쿠폰·안내는 금액 및 별도 안내 상태로 일관되게 처리한다', () => {
    let cart = initialCart();
    cart = changeCart(cart, 'add');
    cart = changeCart(cart, 'coupon');
    expect(cartFields(cart)).toMatchObject({
      quantity: '2',
      subtotal: '24,000원',
      discount: '-3,000원',
      total: '21,000원',
    });
    cart = changeCart(cart, 'dismiss');
    expect(cartFields(cart).total).toBe('21,000원');
    expect(cartFields(cart).notice).toBe('쿠폰 안내 없음');
    expect(changeCart(initialCart(), 'remove').quantity).toBe(1);
  });
  it('직접 DOM 수정 결과가 같은 상태를 새로 렌더한 결과와 필드·버튼까지 일치한다', () => {
    let cart = initialCart();
    const host = document.createElement('div');
    host.append(render(createCartView(cart)));
    for (const action of [
      'add',
      'note',
      'coupon',
      'dismiss',
      'coupon',
      'remove',
    ]) {
      cart = changeCart(cart, action);
      updateCartDOM(host, cart);
      const expected = render(createCartView(cart));
      for (const key of Object.keys(cartFields(cart)))
        expect(
          host.querySelector(`[data-cart-field="${key}"]`).textContent,
        ).toBe(
          expected.querySelector(`[data-cart-field="${key}"]`).textContent,
        );
      for (const name of ['remove', 'coupon', 'dismiss']) {
        const button = host.querySelector(`[data-cart-action="${name}"]`);
        const other = expected.querySelector(`[data-cart-action="${name}"]`);
        expect(button.textContent).toBe(other.textContent);
        expect(button.disabled).toBe(other.disabled);
      }
    }
  });
});
