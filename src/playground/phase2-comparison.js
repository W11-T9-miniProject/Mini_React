import {
  FunctionComponent,
  useState,
} from '../component/function-component.js';
import { vnodeToDom } from '../vdom/vnode-to-dom.js';
import {
  createCartView,
  initialCart,
  changeCart,
  updateCartDOM,
  cartActions,
  cartFields,
  DEFAULT_NOTE,
} from './cart-view.js';

export function setupPhase2Comparison() {
  const panel = document.querySelector('#phase2-state-experiment');
  const manualRoot = document.querySelector('#phase2-manual-root');
  const hookRoot = document.querySelector('#phase2-hook-root');
  let manual;
  let component;
  let actions;
  function Cart() {
    const [quantity, setQuantity] = useState(1);
    const [note, setNote] = useState(DEFAULT_NOTE);
    const [discount, setDiscount] = useState(0);
    const [notice, setNotice] = useState('');
    const cart = { quantity, note, discount, notice };
    actions = cartActions(cart, {
      quantity: setQuantity,
      note: setNote,
      discount: setDiscount,
      notice: setNotice,
    });
    return createCartView(cart);
  }
  function show(label) {
    const same = Object.keys(cartFields(manual)).every(
      (key) =>
        manualRoot.querySelector(`[data-cart-field="${key}"]`).textContent ===
        hookRoot.querySelector(`[data-cart-field="${key}"]`).textContent,
    );
    document.querySelector('#phase2-comparison-status').textContent =
      `${label} · 장바구니 최종 결과 ${same ? '일치' : '불일치'}`;
  }
  function reset() {
    component?.unmount();
    manual = initialCart();
    manualRoot.replaceChildren(vnodeToDom(createCartView(manual)));
    component = new FunctionComponent(Cart, hookRoot);
    component.mount();
    document.querySelector('#phase2-manual-trace').textContent =
      '일반 변수에 장바구니 상태 보관 → 처음 DOM 생성';
    document.querySelector('#phase2-hook-trace').textContent =
      'useState에 장바구니 상태 보관 → 처음 DOM 생성';
    show('처음 상태');
  }
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-cart-action]');
    if (!button || !panel.contains(button)) return;
    const action = button.dataset.cartAction;
    const label = button.textContent;
    manual = changeCart(manual, action);
    updateCartDOM(manualRoot, manual);
    document.querySelector('#phase2-manual-trace').textContent =
      '일반 변수 변경 → 직접 DOM 갱신 함수 호출 → 수량·금액·배송 요청·안내를 직접 찾아 수정';
    const before = component.commitVersion;
    actions[action]();
    document.querySelector('#phase2-hook-trace').textContent =
      `상태 변경 함수 → 컴포넌트 실행 → Diff·Patch → 이번 입력의 엔진 갱신 ${component.commitVersion - before}회`;
    show(label);
  });
  document
    .querySelector('#phase2-reset-button')
    .addEventListener('click', reset);
  reset();
}
