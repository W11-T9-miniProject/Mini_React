export const UNIT_PRICE = 12000;
export const COUPON = 3000;
export const DEFAULT_NOTE = '문 앞에 놓아주세요';
export const OTHER_NOTE = '경비실에 맡겨주세요';
export const APPLIED_NOTICE = '3,000원 쿠폰이 적용되었습니다.';
export const REMOVED_NOTICE = '쿠폰을 취소했습니다.';
export const money = (value) => `${value.toLocaleString('ko-KR')}원`;
export const initialCart = () => ({
  quantity: 1,
  note: DEFAULT_NOTE,
  discount: 0,
  notice: '',
});

export function cartFields({
  quantity,
  note,
  discount = 0,
  notice = '',
  subtotal = quantity * UNIT_PRICE,
}) {
  return {
    quantity: String(quantity),
    subtotal: money(subtotal),
    discount: discount ? `-${money(discount)}` : '0원',
    total: money(Math.max(0, subtotal - discount)),
    note,
    notice: notice || '쿠폰 안내 없음',
  };
}

function element(tag, props, children) {
  return {
    type: 'element',
    tag,
    props,
    children: children.map((child) =>
      typeof child === 'object'
        ? child
        : { type: 'text', value: String(child) },
    ),
  };
}
export function createCartView(cart) {
  const values = cartFields(cart);
  const field = (name) =>
    element('span', { 'data-cart-field': name }, [values[name]]);
  const row = (label, name) =>
    element('div', {}, [
      element('dt', {}, [label]),
      element('dd', {}, [field(name)]),
    ]);
  const props = (action, disabled = false) => ({
    type: 'button',
    'data-cart-action': action,
    ...(disabled ? { disabled: '' } : {}),
  });
  const controls = cart.controls !== false;
  return element('article', { class: 'cart-view' }, [
    element('h3', {}, [
      cart.productCount > 1
        ? `장바구니 · 상품 ${cart.productCount.toLocaleString('ko-KR')}종`
        : '무선 마우스',
    ]),
    element('p', { class: 'comparison-note' }, [
      cart.productCount > 1
        ? '상품별 가격의 합계를 계산합니다.'
        : `개당 ${money(cart.unitPrice ?? UNIT_PRICE)}`,
    ]),
    element('p', {}, [
      '수량: ',
      field('quantity'),
      cart.productCount > 1 ? '개씩' : '개',
    ]),
    element('dl', { class: 'cart-prices' }, [
      row('상품 금액', 'subtotal'),
      row('쿠폰 할인', 'discount'),
      row('결제 예정 금액', 'total'),
    ]),
    element('p', {}, ['배송 요청: ', field('note')]),
    element('p', { class: 'cart-notice' }, ['쿠폰 안내: ', field('notice')]),
    ...(controls
      ? [
          element('div', { class: 'state-actions cart-actions' }, [
            element('button', props('remove', cart.quantity <= 1), ['수량 -1']),
            element('button', props('add'), ['수량 +1']),
            element('button', props('note'), ['배송 요청 바꾸기']),
            element('button', props('coupon'), [
              cart.discount ? '쿠폰 취소' : '3,000원 쿠폰 적용',
            ]),
            element('button', props('dismiss', !cart.notice), ['안내 닫기']),
          ]),
        ]
      : []),
  ]);
}

export function changeCart(cart, action) {
  switch (action) {
    case 'add':
      return { ...cart, quantity: cart.quantity + 1 };
    case 'remove':
      return { ...cart, quantity: Math.max(1, cart.quantity - 1) };
    case 'note':
      return {
        ...cart,
        note: cart.note === DEFAULT_NOTE ? OTHER_NOTE : DEFAULT_NOTE,
      };
    case 'coupon': {
      const discount = cart.discount ? 0 : COUPON;
      return {
        ...cart,
        discount,
        notice: discount ? APPLIED_NOTICE : REMOVED_NOTICE,
      };
    }
    case 'dismiss':
      return { ...cart, notice: '' };
    default:
      throw new Error('지원하지 않는 장바구니 동작입니다.');
  }
}

export function cartActions(cart, setters) {
  return {
    add: () => setters.quantity((value) => value + 1),
    remove: () => setters.quantity((value) => Math.max(1, value - 1)),
    note: () =>
      setters.note((value) =>
        value === DEFAULT_NOTE ? OTHER_NOTE : DEFAULT_NOTE,
      ),
    coupon: () => {
      const next = changeCart(cart, 'coupon');
      setters.discount(next.discount);
      setters.notice(next.notice);
    },
    dismiss: () => setters.notice(''),
  };
}

// 직접 DOM을 관리하는 비교군: 어떤 표시와 버튼을 갱신할지 이 함수에 명시한다.
export function updateCartDOM(host, cart) {
  const fields = cartFields(cart);
  for (const [name, value] of Object.entries(fields)) {
    const node = host.querySelector(`[data-cart-field="${name}"]`);
    if (node.textContent !== value) node.textContent = value;
  }
  const remove = host.querySelector('[data-cart-action="remove"]');
  if (remove) remove.disabled = cart.quantity <= 1;
  const dismiss = host.querySelector('[data-cart-action="dismiss"]');
  if (dismiss) dismiss.disabled = !cart.notice;
  const coupon = host.querySelector('[data-cart-action="coupon"]');
  if (coupon)
    coupon.textContent = cart.discount ? '쿠폰 취소' : '3,000원 쿠폰 적용';
}
