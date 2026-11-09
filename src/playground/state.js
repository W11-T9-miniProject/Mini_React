import {
  FunctionComponent,
  useState,
  useEffect,
  useMemo,
} from '../component/function-component.js';
import {
  createCartView,
  cartActions,
  UNIT_PRICE,
  DEFAULT_NOTE,
  money,
} from './cart-view.js';

export function setupStatePlayground() {
  const container = document.querySelector('#state-root');
  let actions;
  let effectRuns = 0;
  let plainRuns = 0;
  let memoRuns = 0;
  let plainResult;
  let memoResult;
  let calculated;
  function Cart() {
    const [quantity, setQuantity] = useState(1);
    const [note, setNote] = useState(DEFAULT_NOTE);
    const [discount, setDiscount] = useState(0);
    const [notice, setNotice] = useState('');
    useEffect(() => {
      const previous = document.title;
      document.title = `장바구니 · 상품 ${quantity}개`;
      effectRuns += 1;
      document.querySelector('#state-effect-count').textContent =
        String(effectRuns);
      document.querySelector('#state-effect-deps').textContent = JSON.stringify(
        [quantity],
      );
      document.querySelector('#state-title-preview').textContent =
        document.title;
      return () => {
        document.title = previous;
      };
    }, [quantity]);
    plainRuns += 1;
    plainResult = quantity * UNIT_PRICE;
    calculated = false;
    const subtotal = useMemo(() => {
      memoRuns += 1;
      calculated = true;
      return quantity * UNIT_PRICE;
    }, [quantity]);
    memoResult = subtotal;
    const cart = { quantity, note, discount, notice, subtotal };
    actions = cartActions(cart, {
      quantity: setQuantity,
      note: setNote,
      discount: setDiscount,
      notice: setNotice,
    });
    return createCartView(cart);
  }
  const component = new FunctionComponent(Cart, container);
  function show() {
    for (const [id, value] of Object.entries({
      'plain-count': plainRuns,
      'memo-count': memoRuns,
      'plain-result': money(plainResult),
      'memo-result': money(memoResult),
    }))
      document.querySelector(`#state-${id}`).textContent = String(value);
    document.querySelector('#state-memo-last').textContent = calculated
      ? '수량이 달라 상품 금액을 계산했습니다.'
      : '수량이 같아 상품 금액을 재사용했습니다.';
    document.querySelector('#state-hooks').textContent = JSON.stringify(
      component.hooks.filter((h) => h.kind === 'state').map((h) => h.value),
      null,
      2,
    );
    document.querySelector('#state-patches').textContent = JSON.stringify(
      component.patches,
      null,
      2,
    );
    document.querySelector('#state-status').textContent =
      `수량·배송 요청·할인·안내를 상태로 보관합니다. 마지막 갱신 Patch ${component.patches.length}개.`;
  }
  component.mount();
  show();
  container.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-cart-action]');
    if (!button || !container.contains(button)) return;
    actions[button.dataset.cartAction]();
    show();
  });
  document
    .querySelector('#state-open-comparison')
    .addEventListener('click', () => {
      document.querySelector('#state-comparison-tab').click();
      const comparison = document.querySelector('#phase2-state-experiment');
      comparison.open = true;
      comparison.scrollIntoView?.({ block: 'start' });
    });
}
