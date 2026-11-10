import {
  h,
  FunctionComponent,
  useState,
  useMemo,
  useEffect,
} from '../runtime/index.js';
import { render } from '../vdom/render.js';
import { domToVNode } from '../vdom/dom-to-vnode.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import { createHistory } from '../history/history.js';
import './learning.css';

const pretty = (value) => JSON.stringify(value, null, 2);
export function setupLearning(scope = document) {
  const nav = scope.querySelector('.view-nav');
  if (!nav) return () => {};
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.view = 'learn';
  button.setAttribute('aria-pressed', 'true');
  button.innerHTML =
    '<span class="nav-number">00</span><span>처음부터 이해하기<small>구조 → 실행 과정 → 검증</small></span>';
  nav.prepend(button);
  const section = document.createElement('section');
  section.id = 'learn';
  section.className = 'view learning';
  section.setAttribute('aria-labelledby', 'learn-title');
  section.innerHTML = `
    <header class="page-heading"><div><p class="eyebrow">START HERE / MINI REACT를 처음 만났다면</p><h1 id="learn-title">클릭 한 번이 <span>화면을 바꾸기까지.</span></h1><p class="page-description">이 프로젝트는 UI를 데이터로 표현하고, 달라진 부분을 찾아 실제 화면에 적용하는 작은 엔진입니다. 아래 순서대로 읽고 실행하면 코드와 검증 결과가 연결됩니다.</p></div></header>
    <nav class="learn-index" aria-label="학습 목차"><a href="#learn-words">1. 기본 용어</a><a href="#learn-map">2. 전체 구조</a><a href="#learn-trace">3. 한 단계씩 실행</a><a href="#learn-runtime">4. 상태와 Hooks</a><a href="#learn-contracts">5. 검증 읽는 법</a></nav>
    <section id="learn-words" class="learn-block"><p class="eyebrow">01 / 먼저 네 단어만</p><h2>화면, 설계 데이터, 변경 계산, 변경 적용</h2><div class="learn-four">
      <article><h3>DOM · 실제 화면의 노드</h3><p>브라우저가 관리하는 객체입니다. p 요소 안에 글자를 담은 Text 노드가 있습니다. JavaScript로 이 객체를 바꾸면 화면도 바뀝니다.</p><code>p → Text("안녕")</code></article>
      <article><h3>VDOM · 화면을 설명하는 값</h3><p>DOM 자체가 아니라 평범한 JavaScript 객체입니다. 태그, 속성, 자식 정보를 담아 이전 화면과 다음 화면을 비교하기 쉽게 만듭니다.</p><code>{ tag: 'p', children: [...] }</code></article>
      <article><h3>Diff · 무엇이 달라졌나?</h3><p>이전 VDOM과 다음 VDOM을 받아 변경 명령 배열을 만듭니다. 이 함수는 실제 DOM을 건드리지 않습니다.</p><code>diff(previous, next) → Patch[]</code></article>
      <article><h3>Patch · 그 부분만 바꾸기</h3><p>변경 명령을 읽고 실제 DOM을 수정합니다. 글자만 달라졌다면 기존 p와 Text를 유지하고 Text의 값만 바꿀 수 있습니다.</p><code>patch(root, changes) → root</code></article></div>
      <p class="learn-note">“다시 렌더링”은 함수와 비교 계산을 다시 실행한다는 뜻입니다. 실제 DOM을 전부 새로 만드는지는 Patch 명령에 따라 달라집니다.</p></section>
    <section id="learn-map" class="learn-block"><p class="eyebrow">02 / 프로젝트 지도</p><h2>누가 무엇을 맡을까요?</h2><div class="learn-route"><span>main.js<br><small>앱 시작</small></span><b>→</b><span>bootstrap.js<br><small>화면 연결·종료 정리</small></span><b>→</b><span>Controller<br><small>사용자 행동을 엔진에 연결</small></span><b>→</b><span>runtime / history / vdom<br><small>각자 맡은 계산과 적용</small></span></div>
    <div class="learn-two"><article class="panel learn-card"><h3>01 DOM Playground: 편집한 HTML이 출발점</h3><p>테스트 영역을 편집해도 실제 영역은 바로 바뀌지 않습니다. ‘변경 적용’을 누르면 저장된 VDOM과 편집 DOM에서 읽은 VDOM을 비교하고, 실제 DOM에 Patch한 뒤 History에 저장합니다.</p><pre>편집 DOM → domToVNode → 다음 VDOM
저장된 이전 VDOM + 다음 VDOM → diff
변경 명령 → patch(실제 DOM) → history.push</pre><p>연결: src/playground/controller.js<br>저장: src/history/history.js</p></article>
    <article class="panel learn-card"><h3>02 Component Studio: 상태가 출발점</h3><p>버튼 이벤트가 setter를 호출합니다. 런타임이 상태를 저장하고 루트 함수를 다시 실행해 다음 VDOM을 얻습니다. 그다음은 같은 diff/patch 엔진을 사용합니다.</p><pre>이벤트 → setter → schedule → update
App() → 다음 VDOM → diff → patch
DOM 반영 → 이전 cleanup → 새 effect</pre><p>연결: src/demo/app.js<br>실행: src/runtime/function-component.js</p></article></div><p class="learn-note">화면이 엔진을 호출합니다. vdom은 메뉴나 History를 모르고, History는 DOM을 모릅니다. History에는 이벤트 함수가 없는 Phase 1 VDOM을 저장합니다.</p></section>
    <section id="learn-trace" class="learn-block"><p class="eyebrow">03 / 실제 엔진을 한 단계씩</p><h2>‘안녕’을 ‘반가워’로 바꿔보세요.</h2><p>아래는 독립된 작은 실습입니다. ‘다음 단계’를 눌러야 해당 함수가 실행됩니다. 오른쪽 출력은 실행 중 얻은 실제 값이며, 위 Playground의 상태에는 영향을 주지 않습니다.</p>
    <div class="learn-actions"><button type="button" class="primary" data-learn-next>다음 단계 →</button><button type="button" data-learn-reset>처음으로</button><span data-learn-progress></span></div>
    <ol class="learn-steps"><li>DOM 읽기</li><li>다음 VDOM</li><li>Diff 계산</li><li>Patch 적용</li><li>History 저장</li></ol>
    <div class="learn-two"><article class="panel learn-card"><h3>실제 DOM · 지금 브라우저에 붙어 있는 노드</h3><div class="learn-dom" data-learn-dom></div><p data-learn-identity></p><h3 data-learn-heading></h3><p data-learn-description role="status" aria-live="polite"></p></article><article class="panel learn-card"><h3>이번 단계의 입력 → 출력</h3><pre class="learn-output" data-learn-output></pre></article></div>
    <details><summary>path [0]은 어디를 가리키나요?</summary><p>이 실험의 루트는 p입니다. []는 p 자체, [0]은 p의 첫 번째 자식인 Text입니다. Playground는 바깥 div가 있으므로 같은 문장도 [0, 0]일 수 있습니다. 경로는 화면의 줄 번호가 아니라 변경 전 트리의 자식 인덱스입니다.</p><pre>p                 ← []
└─ Text("안녕")   ← [0]</pre></details></section>
    <section id="learn-runtime" class="learn-block"><p class="eyebrow">04 / 함수는 끝났는데 상태는 왜 남을까?</p><h2>값의 보관 장소는 함수 밖의 인스턴스입니다.</h2><p>FunctionComponent 인스턴스가 hooks 배열을 갖습니다. App 실행을 시작할 때 hookIndex를 0으로 되돌리고, Hook을 만날 때마다 다음 슬롯을 사용합니다. 함수의 지역변수가 새로 생겨도 같은 슬롯의 값을 읽습니다.</p>
    <div class="learn-route"><span>hooks[0]<br><small>state: count</small></span><span>hooks[1]<br><small>memo: count × 2</small></span><span>hooks[2]<br><small>effect: 실행과 정리</small></span></div>
    <div class="learn-actions"><button type="button" class="primary" data-learn-batch>setter 3번 호출 (+3)</button><button type="button" data-learn-noop>같은 값으로 setter 호출</button></div>
    <div class="learn-two"><article class="panel learn-card"><h3>실제 함수형 컴포넌트</h3><div class="learn-dom" data-learn-component></div><p data-learn-batch-result role="status" aria-live="polite"></p><pre data-learn-slots></pre></article><article class="panel learn-card"><h3>DOM commit 이후의 실제 Effect 로그</h3><pre data-learn-effects></pre><p>cleanup은 이전 Effect가 만든 자원을 정리합니다. 타이머라면 clearInterval이 필요합니다. 이 예제는 숫자 변경마다 이전 cleanup → 새 effect 순서를 기록합니다.</p></article></div>
    <div class="learn-two"><article><h3>Batching · 세 번 저장, 한 번 갱신</h3><p>이 구현에서 setter는 슬롯 값을 즉시 계산합니다. 함수형 setter 세 번은 0 → 1 → 2 → 3 순서로 적용됩니다. schedule은 Promise microtask 하나만 예약하므로 같은 이벤트의 세 setter가 루트 함수를 한 번 다시 실행시킵니다.</p></article><article><h3>Memo · 언제 다시 계산하나요?</h3><p>의존성 [count]의 각 값을 Object.is로 비교합니다. count가 바뀌면 다시 계산하고, 같으면 보관한 값을 사용합니다. []는 mount 때 한 번, 의존성 생략은 매번 계산합니다. 같은 객체를 직접 수정하면 변경을 놓칠 수 있습니다.</p></article></div>
    <details><summary>Hook 순서를 지키지 않으면?</summary><p>조건문 때문에 두 번째 Hook이 사라지면 같은 호출 위치가 같은 슬롯을 가리킨다는 약속이 깨집니다. 이 엔진은 Hook 종류나 개수 변경을 오류로 거부합니다. 같은 종류의 Hook 두 개를 서로 바꾸는 오류는 검출하지 못합니다. 자식은 props만 받으며 Hook은 루트 함수에서만 지원합니다.</p></details></section>
    <section id="learn-contracts" class="learn-block"><p class="eyebrow">05 / 이제 검증 결과를 읽어봅시다</p><h2>무엇을 비교해야 ‘맞다’고 할 수 있을까요?</h2>
    <div class="learn-table"><table><thead><tr><th>검사</th><th>버튼을 누르면</th><th>결과가 뜻하는 것</th></tr></thead><tbody>
    <tr><td>DOM 참조 유지</td><td>최초 노드를 저장하고 TEXT Patch 후 === 비교</td><td>true면 같은 객체입니다. 글자가 같다는 뜻과 다릅니다. 전체 교체 대조군에서는 false가 정상입니다.</td></tr>
    <tr><td>Patch 정확성</td><td>예상 TEXT 명령과 실제 diff 배열 비교 + 적용한 DOM 역변환</td><td>명령도 예상과 같고 최종 VDOM도 목표와 같아야 두 검사가 통과합니다.</td></tr>
    <tr><td>History 복구</td><td>상태 추가 → Undo → Redo → Undo 후 새 상태 추가</td><td>DOM이 선택한 스냅샷과 같아야 합니다. 과거에서 새로 저장하면 이전 미래 이력을 제거합니다.</td></tr>
    <tr><td>Hook 일관성</td><td>재렌더 전후 슬롯 참조 비교 + 조건부 Hook 오류 유도</td><td>정상 갱신은 같은 슬롯을 사용하고, 개수가 바뀐 호출은 오류여야 합니다. 예상 오류는 방어 동작의 증거입니다.</td></tr></tbody></table></div>
    <h3>History는 화면 사진이 아닌 VDOM 스냅샷입니다.</h3><p>A → B → C를 저장한 뒤 B로 돌아가 D를 저장하면 [A, B, D]가 됩니다. structuredClone으로 원본과 분리하고 freeze로 과거 객체의 수정을 막습니다. 복구할 때는 현재 VDOM에서 목표 스냅샷으로 가는 diff를 계산하고 patch합니다.</p>
    <h3>여섯 가지 변경 명령</h3><div class="learn-table"><table><thead><tr><th>명령</th><th>상황</th><th>동작</th></tr></thead><tbody><tr><td>TEXT</td><td>글자 변경</td><td>기존 Text의 nodeValue 수정</td></tr><tr><td>PROPS</td><td>title, value, 이벤트 변경</td><td>속성·프로퍼티·리스너 적용 또는 제거</td></tr><tr><td>REPLACE</td><td>p → h2처럼 종류 변경</td><td>새 노드로 교체, 하위 노드도 새로 생성</td></tr><tr><td>INSERT</td><td>새 자식 추가</td><td>path는 부모, index는 추가될 위치</td></tr><tr><td>REMOVE</td><td>자식 삭제</td><td>기존 대상 노드 제거</td></tr><tr><td>MOVE</td><td>고유 key를 가진 형제의 순서 변경</td><td>기존 노드 이동. key가 없거나 불완전·중복이면 인덱스 비교</td></tr></tbody></table></div>
    <p class="learn-note">Patch는 변경 전에 대상 노드 참조를 확보합니다. 자식을 삭제하거나 이동해 인덱스가 달라져도 원래 대상에 적용하기 위해서입니다. 루트도 바뀔 수 있으므로 반환값을 저장해야 합니다.</p>
    <div class="learn-actions"><button type="button" data-learn-go="proof" class="primary">이해한 내용을 검증 실험실에서 확인 →</button><button type="button" data-learn-go="phase1">HTML을 직접 편집해보기</button><button type="button" data-learn-go="phase2">컴포넌트 앱 조작하기</button></div>
    <details><summary>실제 React와 같은가요? 성능도 증명하나요?</summary><p>이 프로젝트는 학습용 구현입니다. Fiber, 동시 렌더링, 자식별 Hook 상태, Fragment, JSX는 지원하지 않습니다. Effect는 DOM commit 직후 동기로 실행합니다. DOM 참조 유지와 명령 비교는 일부 업데이트의 근거이며, Reflow/Repaint 횟수나 모든 상황에서의 속도 우위를 증명하지 않습니다.</p></details></section>`;
  scope.querySelector('.workspace').append(section);
  for (const item of scope.querySelectorAll('[data-view]')) {
    const active = item === button;
    item.setAttribute('aria-pressed', String(active));
    const view = scope.querySelector('#' + item.dataset.view);
    if (view) view.hidden = !active;
  }
  const get = (selector) => section.querySelector(selector);
  let step, root, original, originalText, previous, next, changes, history;
  const phases = [
    [
      '준비: 화면과 데이터는 다릅니다.',
      '화면에는 p와 Text가 이미 있습니다. 아직 비교용 VDOM이나 변경 명령은 만들지 않았습니다.',
    ],
    [
      '1. domToVNode(root)',
      '현재 DOM을 읽어 이전 VDOM 객체를 만듭니다. DOM은 그대로이며, History도 이 초기 스냅샷에서 시작합니다.',
    ],
    [
      '2. h("p", {}, "반가워")',
      '다음에 보여줄 화면을 JavaScript 객체로 만듭니다. 목표 데이터만 생겼으므로 실제 화면은 여전히 안녕입니다.',
    ],
    [
      '3. diff(previous, next)',
      '두 객체에서 텍스트 값만 다르므로 TEXT 명령 하나를 얻습니다. 계산만 했으므로 실제 DOM은 아직 바뀌지 않습니다.',
    ],
    [
      '4. root = patch(root, changes)',
      '실제 Text 노드의 값을 수정합니다. p와 Text 참조는 유지됩니다. 이때 화면이 처음 바뀝니다.',
    ],
    [
      '5. history.push(next)',
      '목표 VDOM의 복사본을 저장합니다. DOM을 새로 만들지 않으며, Undo로 초기 스냅샷을 선택할 준비가 됩니다.',
    ],
  ];
  function showTrace(output) {
    get('[data-learn-heading]').textContent = phases[step][0];
    get('[data-learn-description]').textContent = phases[step][1];
    get('[data-learn-progress]').textContent = `${step} / 5 단계`;
    get('[data-learn-output]').textContent = output;
    get('[data-learn-identity]').textContent =
      `최초 p === 현재 p: ${original === root} / 최초 Text === 현재 Text: ${originalText === root.firstChild}`;
    get('[data-learn-next]').disabled = step === 5;
    section.querySelectorAll('.learn-steps li').forEach((li, i) => {
      li.dataset.done = String(i < step);
      li.setAttribute('aria-current', i === step - 1 ? 'step' : 'false');
    });
  }
  function reset() {
    step = 0;
    root = render(h('p', {}, '안녕'));
    original = root;
    originalText = root.firstChild;
    previous = next = changes = history = undefined;
    get('[data-learn-dom]').replaceChildren(root);
    showTrace(
      '실제 DOM: <p>안녕</p>\n이전 VDOM: 아직 읽지 않음\n다음 VDOM: 아직 생성하지 않음\nPatch: 아직 계산하지 않음',
    );
  }
  reset();
  let setter,
    count = 0,
    disposed = false;
  const logs = [];
  const instance = new FunctionComponent(() => {
    const [value, set] = useState(0);
    setter = set;
    count = value;
    const doubled = useMemo(() => value * 2, [value]);
    useEffect(() => {
      logs.push(
        `effect(${value}) · commit된 DOM: ${get('[data-learn-component]').textContent}`,
      );
      return () => logs.push(`cleanup(${value})`);
    }, [value]);
    return h('p', {}, `count = ${value}, 두 배 = ${doubled}`);
  }).mount(get('[data-learn-component]'));
  function showRuntime(message) {
    get('[data-learn-batch-result]').textContent = message;
    get('[data-learn-slots]').textContent =
      pretty(
        instance.hooks.map((slot, i) => ({
          slot: i,
          kind: slot.kind,
          ...(slot.kind !== 'effect' ? { value: slot.value } : {}),
        })),
      ) +
      `\n누적 렌더: ${instance.renderCount} / Memo 계산: ${instance.memoRuns}`;
    get('[data-learn-effects]').textContent = logs.slice(-12).join('\n');
  }
  showRuntime('초기 mount: App 실행 1회 → DOM 생성 → effect(0) 실행');
  async function onClick(event) {
    if (event.target.closest('[data-learn-next]')) {
      if (step >= 5) return;
      step++;
      if (step === 1) {
        previous = domToVNode(root);
        history = createHistory(previous);
        showTrace('입력: <p>안녕</p>\n출력 previous:\n' + pretty(previous));
      }
      if (step === 2) {
        next = h('p', {}, '반가워');
        showTrace('입력: h("p", {}, "반가워")\n출력 next:\n' + pretty(next));
      }
      if (step === 3) {
        changes = diff(previous, next);
        showTrace(
          '입력: previous + next\n출력 Patch[]:\n' +
            pretty(changes) +
            '\n실제 DOM은 여전히: ' +
            root.outerHTML,
        );
      }
      if (step === 4) {
        root = patch(root, changes);
        showTrace(
          '입력: root + Patch[]\n출력 DOM: ' +
            root.outerHTML +
            '\nDOM에서 다시 읽은 VDOM:\n' +
            pretty(domToVNode(root)),
        );
      }
      if (step === 5) {
        history.push(next);
        showTrace(
          `입력: next\n이력 ${history.index + 1} / ${history.length}\nUndo 가능: ${history.canUndo()}\n저장된 스냅샷:\n` +
            pretty(history.current()),
        );
      }
    }
    if (event.target.closest('[data-learn-reset]')) reset();
    const go = event.target.closest('[data-learn-go]');
    if (go) scope.querySelector(`[data-view="${go.dataset.learnGo}"]`)?.click();
    const batch = event.target.closest('[data-learn-batch]');
    const noop = event.target.closest('[data-learn-noop]');
    if (batch || noop) {
      const controls = section.querySelectorAll(
        '[data-learn-batch], [data-learn-noop]',
      );
      controls.forEach((control) => {
        control.disabled = true;
      });
      const before = instance.renderCount,
        start = count;
      if (batch) for (let i = 0; i < 3; i++) setter((value) => value + 1);
      else setter(count);
      await instance.settled();
      if (disposed) return;
      showRuntime(
        `${batch ? 'setter 3번 호출' : '같은 값으로 setter 호출'}: ${start} → ${count} / 실제 추가 렌더 ${instance.renderCount - before}회`,
      );
      controls.forEach((control) => {
        control.disabled = false;
      });
    }
  }
  section.addEventListener('click', onClick);
  return () => {
    disposed = true;
    instance.unmount();
    section.removeEventListener('click', onClick);
    section.remove();
    button.remove();
  };
}
