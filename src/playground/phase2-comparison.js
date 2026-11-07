import {
  FunctionComponent,
  useState,
  useMemo,
  useEffect,
} from '../component/function-component.js';
import { render } from '../vdom/render.js';
import { createCounterView, summaryText } from './counter-view.js';

export function setupPhase2Comparison() {
  const panel = document.querySelector('#state-comparison-panel');
  const manualRoot = document.querySelector('#phase2-manual-root');
  const hookRoot = document.querySelector('#phase2-hook-root');
  const omit = document.querySelector('#phase2-omit-summary');
  const toggle = document.querySelector('#phase2-toggle-button');
  const bus = new EventTarget();
  let component;
  let manual;
  let direct;
  let hooked;
  let actions;
  let unsubscribeManual;
  let closed = true;

  function side(prefix) {
    return {
      prefix,
      trace: [],
      calculations: 0,
      titleRuns: 0,
      active: 0,
      received: 0,
      preview: '미연결',
    };
  }
  function subscribe(target, method) {
    const listener = () => {
      target.received += 1;
      target.trace.push('외부 알림 1회 수신');
    };
    bus.addEventListener('notice', listener);
    target.active += 1;
    target.trace.push(`${method}: 외부 알림 구독 등록`);
    let active = true;
    return () => {
      if (!active) return;
      bus.removeEventListener('notice', listener);
      target.active -= 1;
      target.trace.push(`${method}: 정리 함수로 외부 구독 해제`);
      active = false;
    };
  }
  function syncManualTitle() {
    if (manual.lastTitle === manual.count) {
      direct.trace.push('숫자 비교: 같으므로 외부 제목 갱신 생략');
      return;
    }
    direct.preview = `현재 숫자: ${manual.count}`;
    direct.titleRuns += 1;
    manual.lastTitle = manual.count;
    direct.trace.push('직접 조건 검사 후 외부 제목 갱신');
  }
  function renderManual() {
    direct.calculations += 1;
    const doubled = manual.count * 2;
    direct.trace.push('일반 계산: 숫자 × 2 실행');
    const write = (selector, value, label) => {
      manualRoot.querySelector(selector).textContent = String(value);
      direct.trace.push(`직접 DOM 갱신: ${label}`);
    };
    write('[data-count]', manual.count, '현재 숫자');
    write('[data-double]', doubled, '두 배');
    if (omit.checked)
      direct.trace.push('요약 갱신 생략: 사용자가 선택한 실수 재현');
    else
      write(
        '[data-summary]',
        summaryText(manual.count, manual.name),
        '요약 문장',
      );
    syncManualTitle();
  }
  function Counter() {
    const [count, setCount] = useState(0);
    const [name, setName] = useState('정글');
    hooked.trace.push('컴포넌트 실행: 현재 상태로 새 화면 구조 계산');
    let calculated = false;
    const doubled = useMemo(() => {
      hooked.calculations += 1;
      calculated = true;
      return count * 2;
    }, [count]);
    hooked.trace.push(
      calculated
        ? 'useMemo: 첫 실행이거나 숫자가 달라 계산 실행'
        : 'useMemo: 같은 숫자의 계산 결과 재사용',
    );
    useEffect(() => {
      hooked.preview = `현재 숫자: ${count}`;
      hooked.titleRuns += 1;
      hooked.trace.push(
        'DOM 반영 후 useEffect: [count] 변경에 맞춰 외부 제목 갱신',
      );
      return () => {
        hooked.preview = '미연결';
        hooked.trace.push('useEffect 정리: 외부 제목 원복');
      };
    }, [count]);
    useEffect(() => subscribe(hooked, 'useEffect'), []);
    actions = {
      increment: () => setCount((value) => value + 1),
      rename: () => setName((value) => (value === '정글' ? '학습자' : '정글')),
    };
    return createCounterView({
      count,
      name,
      doubled,
      buttonPrefix: 'phase2-hook',
    });
  }
  function showResults(action) {
    for (const target of [direct, hooked]) {
      const p = target.prefix;
      document.getElementById(`phase2-${p}-title`).textContent = target.preview;
      document.getElementById(`phase2-${p}-title-runs`).textContent = String(
        target.titleRuns,
      );
      document.getElementById(`phase2-${p}-active`).textContent = String(
        target.active,
      );
      document.getElementById(`phase2-${p}-received`).textContent = String(
        target.received,
      );
      document.getElementById(`phase2-${p}-trace`).textContent = target.trace
        .slice(-10)
        .join('\n');
    }
    document.querySelector('#phase2-plain-count').textContent = String(
      direct.calculations,
    );
    document.querySelector('#phase2-memo-count').textContent = String(
      hooked.calculations,
    );
    const selectors = ['[data-count]', '[data-double]', '[data-summary]'];
    const same =
      closed ||
      selectors.every(
        (selector) =>
          manualRoot.querySelector(selector).textContent ===
          hookRoot.querySelector(selector).textContent,
      );
    document.querySelector('#phase2-comparison-status').textContent = closed
      ? `${action} · 두 화면 닫힘 · 구독 해제 후에는 알림을 보내도 수신 횟수가 늘지 않습니다.`
      : `${action} · 두 화면 ${same ? '일치' : '불일치: 직접 관리 쪽 요약 갱신을 의도적으로 생략한 상태입니다.'}`;
    document
      .querySelector('#phase2-manual-panel')
      .classList.toggle('has-mismatch', !same);
    toggle.textContent = closed ? '두 화면 다시 열기' : '두 화면 닫기';
    omit.disabled = closed;
  }
  function dispose() {
    if (closed) return;
    unsubscribeManual();
    direct.preview = '미연결';
    direct.trace.push('직접 정리: DOM 제거와 외부 제목 원복');
    manualRoot.replaceChildren();
    component.unmount();
    closed = true;
  }
  function reset() {
    dispose();
    direct = side('manual');
    hooked = side('hook');
    manual = { count: 0, name: '정글', lastTitle: undefined };
    omit.checked = false;
    direct.calculations = 1;
    const doubled = manual.count * 2;
    direct.trace.push('일반 변수에 숫자·이름 보관, 공통 초기 화면 생성');
    // 초기 화면만 Phase 1의 생성 함수를 공유한다. 이후 왼쪽 갱신은 직접 DOM으로 처리한다.
    manualRoot.replaceChildren(
      render(
        createCounterView({
          count: 0,
          name: '정글',
          doubled,
          buttonPrefix: 'phase2',
        }),
      ),
    );
    syncManualTitle();
    unsubscribeManual = subscribe(direct, '직접 등록');
    component = new FunctionComponent(Counter, hookRoot);
    component.mount();
    closed = false;
    showResults('처음 상태');
  }
  function apply(action) {
    if (closed) return;
    direct.trace = [];
    hooked.trace = [];
    if (action === 'increment') manual.count += 1;
    if (action === 'rename')
      manual.name = manual.name === '정글' ? '학습자' : '정글';
    direct.trace.push('일반 변수 변경 → 필요한 화면 갱신 함수를 직접 호출');
    renderManual();
    hooked.trace.push(
      action === 'refresh'
        ? '같은 상태로 update() 호출'
        : 'useState 변경 함수 호출',
    );
    if (action === 'refresh') component.update();
    else actions[action]();
    hooked.trace.push(
      `결과 보고: 기존 Diff·Patch가 변경 명령 ${component.patches.length}개 적용`,
    );
    showResults(
      action === 'increment'
        ? '숫자 +1'
        : action === 'rename'
          ? '이름 바꾸기'
          : '갱신 연결 복원',
    );
  }
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-state-action]');
    if (button && panel.contains(button)) apply(button.dataset.stateAction);
  });
  document
    .querySelector('#phase2-reset-button')
    .addEventListener('click', reset);
  document
    .querySelector('#phase2-notify-button')
    .addEventListener('click', () => {
      bus.dispatchEvent(new Event('notice'));
      showResults('외부 알림 전송');
    });
  toggle.addEventListener('click', () => {
    if (closed) reset();
    else {
      direct.trace = [];
      hooked.trace = [];
      dispose();
      showResults('정리 동작 확인');
    }
  });
  omit.addEventListener('change', () => {
    if (!omit.checked) apply('refresh');
    else
      document.querySelector('#phase2-comparison-status').textContent =
        '실수 재현 켜짐: 다음 클릭부터 직접 관리 쪽 요약 갱신을 일부러 생략합니다. JavaScript의 필연적인 한계가 아닙니다.';
  });
  reset();
}
