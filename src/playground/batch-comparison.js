import {
  FunctionComponent,
  useState,
  useEffect,
  batch,
} from '../component/function-component.js';
import {
  createCartView,
  cartActions,
  cartFields,
  DEFAULT_NOTE,
} from './cart-view.js';
const labels = {
  quantity: '수량',
  subtotal: '상품 금액',
  discount: '쿠폰 할인',
  total: '결제 예정 금액',
  note: '배송 요청',
  notice: '쿠폰 안내',
};

export function setupBatchComparison() {
  const panel = document.querySelector('#batch-comparison');
  let sides = [];
  function createSide(id) {
    const host = document.querySelector(`#batch-${id}-root`);
    const side = {
      id,
      host,
      records: [],
      recording: false,
      writes: 0,
      previous: null,
      actions: {},
    };
    const component = new FunctionComponent(() => {
      const [quantity, setQuantity] = useState(1);
      const [note, setNote] = useState(DEFAULT_NOTE);
      const [discount, setDiscount] = useState(0);
      const [notice, setNotice] = useState('');
      const cart = { quantity, note, discount, notice };
      useEffect(() => {
        const snapshot = Object.fromEntries(
          Object.keys(cartFields(cart)).map((key) => [
            key,
            host.querySelector(`[data-cart-field="${key}"]`).textContent,
          ]),
        );
        if (side.recording)
          side.records.push({
            ...snapshot,
            before: side.previous,
            changed: Object.keys(snapshot).filter(
              (key) => snapshot[key] !== side.previous[key],
            ),
            patches: component.patches.length,
          });
        side.previous = snapshot;
      });
      const track = (setter) => (value) => {
        side.writes += 1;
        setter(value);
      };
      side.actions = cartActions(cart, {
        quantity: track(setQuantity),
        note: track(setNote),
        discount: track(setDiscount),
        notice: track(setNotice),
      });
      return createCartView({ ...cart, controls: false });
    }, host);
    side.component = component;
    component.mount();
    return side;
  }
  function show(label) {
    for (const side of sides) {
      const changed = new Set(side.records.flatMap((record) => record.changed));
      for (const field of side.host.querySelectorAll('[data-cart-field]'))
        field.classList.toggle(
          'batch-changed',
          changed.has(field.dataset.cartField),
        );
      for (const [key, value] of Object.entries({
        writes: side.writes,
        updates: side.records.length,
        patches: side.records.reduce((sum, r) => sum + r.patches, 0),
      }))
        document.querySelector(`#batch-${side.id}-${key}`).textContent =
          String(value);
      document.querySelector(`#batch-${side.id}-trace`).replaceChildren(
        ...side.records.map((record, index) => {
          const item = document.createElement('li');
          const final = index === side.records.length - 1;
          item.className = final
            ? 'batch-stage-final'
            : 'batch-stage-intermediate';
          const heading = document.createElement('strong');
          heading.textContent = `${index + 1}번째 갱신 · ${final ? '최종 장바구니' : '중간 장바구니'}`;
          const screen = document.createElement('div');
          screen.className = 'batch-snapshot';
          const title = document.createElement('strong');
          title.textContent = '무선 마우스 · 개당 12,000원';
          screen.append(title);
          for (const [key, label] of Object.entries(labels)) {
            const line = document.createElement('p');
            line.append(`${label}: `);
            if (
              record.changed.includes(key) &&
              key !== 'notice' &&
              key !== 'note'
            ) {
              const before = document.createElement('span');
              before.className = 'batch-before';
              before.textContent = `${record.before[key]} → `;
              line.append(before);
            }
            const value = document.createElement('span');
            value.dataset.snapshotField = key;
            value.textContent = record[key];
            value.classList.toggle(
              'batch-changed',
              record.changed.includes(key),
            );
            line.append(value);
            screen.append(line);
          }
          item.append(heading, screen);
          return item;
        }),
      );
    }
    panel.querySelector(
      '#batch-controls [data-cart-action="remove"]',
    ).disabled = sides[0].previous.quantity === '1';
    panel.querySelector(
      '#batch-controls [data-cart-action="dismiss"]',
    ).disabled = !sides[0].component.hooks[3].value;
    const same = Object.keys(labels).every(
      (key) => sides[0].previous[key] === sides[1].previous[key],
    );
    document.querySelector('#batch-status').textContent =
      `${label} · 양쪽 최종 장바구니 ${same ? '일치' : '불일치'}`;
    const [a, b] = sides.map((s) => s.records.length);
    document.querySelector('#batch-takeaway').textContent = !a
      ? '쿠폰 버튼은 할인 금액과 안내 메시지를 함께 바꿉니다.'
      : a > b
        ? `왼쪽은 ${a}번, 오른쪽은 ${b}번 갱신했습니다. 쿠폰 적용 때 왼쪽은 할인 금액부터 바꾸고 안내를 다음 갱신에 표시합니다. 오른쪽은 최종 장바구니를 한 번에 만듭니다.`
        : '이번에는 상태 하나만 바꿔 양쪽 모두 갱신 1회입니다.';
  }
  function apply(action) {
    for (const side of sides) {
      side.records = [];
      side.writes = 0;
      side.recording = true;
      const perform = () => side.actions[action]();
      try {
        if (side.id === 'batched') batch(perform);
        else perform();
      } finally {
        side.recording = false;
      }
    }
    show(action === 'coupon' ? '쿠폰 할인·안내 변경' : '장바구니 변경');
  }
  function reset() {
    for (const side of sides) side.component.unmount();
    sides = ['immediate', 'batched'].map(createSide);
    show('처음 상태');
  }
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-cart-action]');
    if (button && panel.contains(button)) apply(button.dataset.cartAction);
  });
  document
    .querySelector('#batch-apply')
    .addEventListener('click', () => apply('coupon'));
  document.querySelector('#batch-reset').addEventListener('click', reset);
  reset();
}
