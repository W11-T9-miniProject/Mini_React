import {
  FunctionComponent,
  useState,
  useMemo,
} from '../component/function-component.js';
import { render } from '../vdom/render.js';
import {
  createCartView,
  updateCartDOM,
  DEFAULT_NOTE,
  OTHER_NOTE,
} from './cart-view.js';
const modes = ['plain', 'manual-cache', 'memo'];
const labels = ['매번 재계산', '직접 캐시', 'Mini React · useMemo'];

export function createCartRunner(mode, data, container) {
  let quantity = 1;
  let note = DEFAULT_NOTE;
  let cache;
  let lastQuantity;
  let component;
  let setters;
  let measurements;
  const resetMetrics = () => {
    measurements = {
      calculations: 0,
      visits: 0,
      allocatedBytes: 0,
      computeMs: 0,
      totalMs: 0,
    };
  };
  resetMetrics();
  function calculate(currentQuantity) {
    const started = performance.now();
    const values = new Float64Array(data.length);
    let total = 0;
    for (let i = 0; i < data.length; i += 1) {
      values[i] = data[i] * currentQuantity;
      total += values[i];
    }
    measurements.calculations += 1;
    measurements.visits += data.length;
    measurements.allocatedBytes += values.byteLength;
    measurements.computeMs += performance.now() - started;
    return { values, total };
  }
  const view = (currentQuantity, currentNote, result) => ({
    quantity: currentQuantity,
    note: currentNote,
    subtotal: result.total,
    productCount: data.length,
    unitPrice: data[0],
    controls: false,
  });
  function Cart() {
    const [q, setQuantity] = useState(1);
    const [n, setNote] = useState(DEFAULT_NOTE);
    const result = useMemo(() => calculate(q), [q]);
    setters = {
      quantity: () => setQuantity((v) => v + 1),
      note: () =>
        setNote((v) => (v === DEFAULT_NOTE ? OTHER_NOTE : DEFAULT_NOTE)),
    };
    return createCartView(view(q, n, result));
  }
  function updateDirect(initial = false) {
    let result;
    if (mode === 'plain') result = calculate(quantity);
    else {
      if (lastQuantity !== quantity) {
        cache = calculate(quantity);
        lastQuantity = quantity;
      }
      result = cache;
    }
    const cart = view(quantity, note, result);
    if (initial) container.replaceChildren(render(createCartView(cart)));
    else updateCartDOM(container, cart);
  }
  if (mode === 'memo') {
    component = new FunctionComponent(Cart, container);
    component.mount();
  } else updateDirect(true);
  resetMetrics();
  return {
    change(action) {
      const started = performance.now();
      if (mode === 'memo') setters[action]();
      else {
        if (action === 'quantity') quantity += 1;
        else note = note === DEFAULT_NOTE ? OTHER_NOTE : DEFAULT_NOTE;
        updateDirect();
      }
      measurements.totalMs += performance.now() - started;
    },
    result: () => container.textContent,
    metrics: () => ({
      ...measurements,
      retainedBytes:
        mode === 'memo'
          ? (component.hooks[2]?.value.values.buffer.byteLength ?? 0)
          : (cache?.values.buffer.byteLength ?? 0),
    }),
    resetMetrics,
    dispose() {
      component?.unmount();
      cache = undefined;
      container.replaceChildren();
    },
  };
}

export function setupPhase2Performance() {
  const runButton = document.querySelector('#phase2-perf-run');
  const sizeInput = document.querySelector('#phase2-perf-size');
  const actionInput = document.querySelector('#phase2-perf-action');
  const status = document.querySelector('#phase2-perf-status');
  const roots = modes.map((mode) =>
    document.querySelector(`#perf-${mode}-result`),
  );
  let retainedRunners = [];
  const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
  const median = (values) => [...values].sort((a, b) => a - b)[1];
  const ms = (value) => (value < 0.01 ? '< 0.01 ms' : `${value.toFixed(2)} ms`);
  const number = (value) => value.toLocaleString('ko-KR');
  const bytes = (value) => `${number(value)} B`;
  runButton.addEventListener('click', async () => {
    const size = Number(sizeInput.value);
    const action = actionInput.value;
    const actionCount = 20;
    const snapshots = modes.map(() => []);
    for (const runner of retainedRunners) runner.dispose();
    retainedRunners = [];
    runButton.disabled = sizeInput.disabled = actionInput.disabled = true;
    document.querySelector('#phase2-perf-results').hidden = true;
    try {
      // 데이터 생성은 측정 밖에서 한 번만 하고, 세 방식에 같은 배열을 전달한다.
      const data = Float64Array.from(
        { length: size },
        (_, i) => ((i % 20) + 1) * 1000,
      );
      for (let round = 0; round < 3; round += 1) {
        for (let offset = 0; offset < modes.length; offset += 1) {
          const index = (round + offset) % modes.length;
          status.textContent = `${round + 1}/3회 · ${labels[index]} 측정 중…`;
          await pause();
          const runner = createCartRunner(modes[index], data, roots[index]);
          try {
            for (let step = 0; step < actionCount; step += 1) {
              runner.change(action);
              // 연속 작업을 작게 나눠 제어권을 돌려준다. 대기 시간은 측정에 포함하지 않는다.
              if (step % 5 === 4) await pause();
            }
            snapshots[index].push({
              ...runner.metrics(),
              result: runner.result(),
            });
          } finally {
            if (round === 2) retainedRunners.push(runner);
            else runner.dispose();
          }
        }
      }
      const results = snapshots.map((samples) => ({
        ...samples[2],
        totalMs: median(samples.map((s) => s.totalMs)),
        computeMs: median(samples.map((s) => s.computeMs)),
      }));
      if (new Set(results.map((r) => r.result)).size !== 1)
        throw new Error('세 방식의 결과가 일치하지 않습니다.');
      const maximum = Math.max(...results.map((r) => r.totalMs), 0.001);
      for (let i = 0; i < modes.length; i += 1) {
        const result = results[i];
        const set = (field, text) => {
          document.querySelector(`#perf-${modes[i]}-${field}`).textContent =
            text;
        };
        set('time', ms(result.totalMs));
        set('chart-time', ms(result.totalMs));
        set(
          'compute',
          result.calculations ? ms(result.computeMs) : '실행 없음',
        );
        set('calls', `${number(result.calculations)}회`);
        set('visits', `${number(result.visits)}개`);
        set('allocated', bytes(result.allocatedBytes));
        set('retained', bytes(result.retainedBytes));
        const bar = document.querySelector(`#perf-${modes[i]}-bar`);
        bar.style.width = `${(result.totalMs / maximum) * 100}%`;
        bar.setAttribute('aria-label', `${labels[i]}: ${ms(result.totalMs)}`);
      }
      document.querySelector('#phase2-perf-context').textContent =
        `상품 ${number(size)}종 · ${action === 'note' ? '배송 요청만' : '전체 상품 수량'} 20번 변경 · 각 방식 3회 중앙값 · 공통 초기 계산 1회 제외 · 결과 일치`;
      document.querySelector('#phase2-perf-data').textContent =
        `공유 입력 버퍼: ${bytes(data.byteLength)} (결과 캐시 용량과 별도)`;
      document.querySelector('#phase2-perf-takeaway').textContent =
        action === 'note'
          ? `배송 요청은 가격에 영향을 주지 않습니다. 매번 계산은 상품 금액 ${number(size * actionCount)}건을 다시 처리했고, 두 캐시 방식은 재사용해 추가 계산이 0건입니다. 대신 각각 ${bytes(size * 8)}의 결과 목록을 보관합니다.`
          : `수량이 매번 바뀌어 세 방식 모두 상품 금액 ${number(size * actionCount)}건을 다시 계산합니다. 캐시로 생략한 계산은 없습니다. 갱신 처리 비용도 있으므로 Mini React가 항상 빠른 것은 아닙니다.`;
      document.querySelector('#phase2-perf-results').hidden = false;
      status.textContent =
        '측정 완료 · 아래 그래프와 표에서 시간·계산량·보관 비용을 함께 확인하세요.';
    } catch (error) {
      for (const runner of retainedRunners) runner.dispose();
      retainedRunners = [];
      status.textContent = `측정 중단: ${error.message}`;
    } finally {
      runButton.disabled = sizeInput.disabled = actionInput.disabled = false;
    }
  });
}
