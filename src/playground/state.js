import {
  FunctionComponent,
  useState,
  useEffect,
  useMemo,
} from '../component/function-component.js';
import { createCounterView } from './counter-view.js';

export function setupStatePlayground() {
  const container = document.querySelector('#state-root');
  let actions = {};
  let effectRuns = 0;
  let plainRuns = 0;
  let memoRuns = 0;
  let plainResult = 0;
  let memoResult = 0;
  let memoCalculated = false;
  function StateDemo() {
    const [count, setCount] = useState(0);
    const [name, setName] = useState('정글');
    useEffect(() => {
      const previousTitle = document.title;
      document.title = `Mini React · 현재 숫자: ${count}`;
      effectRuns += 1;
      document.querySelector('#state-effect-count').textContent =
        String(effectRuns);
      document.querySelector('#state-effect-deps').textContent = JSON.stringify(
        [count],
      );
      document.querySelector('#state-title-preview').textContent =
        document.title;
      document.querySelector('#state-effect-last').textContent =
        `화면 숫자 ${container.querySelector('[data-count]').textContent} 반영 후 제목을 갱신했습니다.`;
      return () => {
        document.title = previousTitle;
      };
    }, [count]);
    // 횟수는 재계산 여부를 관찰하는 진단용 집계다. 실제 계산은 가볍게 유지한다.
    plainRuns += 1;
    plainResult = count * 2;
    memoCalculated = false;
    const doubled = useMemo(() => {
      memoRuns += 1;
      memoCalculated = true;
      return count * 2;
    }, [count]);
    memoResult = doubled;
    // 문자열 속성만 다루는 Phase 1 엔진은 유지하고 클릭은 컨테이너에서 연결한다.
    actions = {
      increment: () => setCount((previous) => previous + 1),
      rename: () =>
        setName((previous) => (previous === '정글' ? '학습자' : '정글')),
    };
    return createCounterView({ count, name, doubled });
  }
  const component = new FunctionComponent(StateDemo, container);
  function showState() {
    document.querySelector('#state-plain-count').textContent =
      String(plainRuns);
    document.querySelector('#state-memo-count').textContent = String(memoRuns);
    document.querySelector('#state-plain-result').textContent =
      String(plainResult);
    document.querySelector('#state-memo-result').textContent =
      String(memoResult);
    document.querySelector('#state-memo-last').textContent = memoCalculated
      ? '이번 실행: 숫자가 처음이거나 달라져 새로 계산했습니다.'
      : '이번 실행: 숫자가 같아서 저장된 계산 결과를 재사용했습니다.';
    document.querySelector('#state-hooks').textContent = JSON.stringify(
      component.hooks
        .filter((slot) => slot.kind === 'state')
        .map((slot) => slot.value),
      null,
      2,
    );
    document.querySelector('#state-patches').textContent = JSON.stringify(
      component.patches,
      null,
      2,
    );
    document.querySelector('#state-status').textContent =
      `hooks[0] 숫자 = ${component.hooks[0].value} · hooks[1] 이름 = ${component.hooks[1].value} · 마지막 Patch 명령 ${component.patches.length}개`;
  }
  component.mount();
  showState();
  document
    .querySelector('#state-open-comparison')
    .addEventListener('click', () => {
      document.querySelector('#state-comparison-tab').click();
      const comparison = document.querySelector('.phase2-management');
      comparison.open = true;
      comparison.scrollIntoView?.({ block: 'start' });
    });
  container.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-state-action]');
    if (!button || !container.contains(button)) return;
    actions[button.dataset.stateAction]();
    showState();
  });
}
