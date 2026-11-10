import { h, FunctionComponent, useState, useMemo } from '../runtime/index.js';
import { render } from '../vdom/render.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import { domToVNode } from '../vdom/dom-to-vnode.js';
import { createHistory } from '../history/history.js';
import './proof.css';

const json = (value) => JSON.stringify(value, null, 2);
const same = (a, b) => json(a) === json(b);

export function setupProof(scope = document) {
  const nav = scope.querySelector('.view-nav');
  if (!nav) return () => {};
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.view = 'proof';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML =
    '<span class="nav-number">04</span><span>검증 실험실<small>보이는 결과에서 증거로</small></span>';
  nav.append(button);
  const section = document.createElement('section');
  section.id = 'proof';
  section.className = 'view';
  section.hidden = true;
  section.innerHTML = `
    <header class="page-heading"><div><p class="eyebrow">OBSERVE / COMPARE / VERIFY</p><h1>같아 보이는 화면, <span>같은 노드일까요?</span></h1><p class="page-description">실제 엔진을 실행하고, 참조·명령·스냅샷·슬롯을 비교합니다. 각 버튼은 독립된 실험입니다.</p></div></header>
    <div class="proof-grid">
    ${[
      [
        'dom',
        '01 / DOM IDENTITY',
        '다시 그렸을까, 고쳤을까?',
        'TEXT Patch와 전체 교체는 똑같이 보입니다. 저장한 노드와 현재 노드를 ===로 비교하세요.',
        [
          ['patch', 'TEXT Patch'],
          ['replace', '전체 교체 (대조군)'],
        ],
      ],
      [
        'commands',
        '02 / PATCH CONTRACT',
        '예상한 명령이 나왔을까?',
        '이전 p의 텍스트만 바꿉니다. 예상 명령 전체와 실제 diff 결과, 적용 후 VDOM을 각각 비교합니다.',
        [['commands', '명령 검증 실행']],
      ],
      [
        'history',
        '03 / TIME TRAVEL',
        '과거 상태로 돌아갈 수 있을까?',
        '값을 추가하고 Undo/Redo 하세요. History 목표와 실제 DOM을 다시 읽은 VDOM이 일치하는지 검사합니다.',
        [
          ['push', '새 상태 +1'],
          ['undo', 'Undo'],
          ['redo', 'Redo'],
        ],
      ],
      [
        'hooks',
        '04 / HOOK SLOTS',
        '상태는 어느 슬롯에 남을까?',
        '정상 갱신은 같은 슬롯을 재사용합니다. 조건부 Hook을 생략하면 런타임이 개수 변경을 거부합니다.',
        [
          ['hooks', '정상 갱신 +1'],
          ['invalid', '조건부 Hook 오류 실험'],
        ],
      ],
    ]
      .map(
        ([id, label, title, description, actions]) =>
          `<article class="panel proof-card" data-proof="${id}"><p class="eyebrow">${label}</p><h2>${title}</h2><p>${description}</p><div class="proof-actions">${actions.map(([action, text]) => `<button type="button" class="primary" data-proof-action="${action}">${text}</button>`).join('')}</div><div class="proof-stage" data-stage></div><pre class="code-output" data-evidence role="status" aria-live="polite"></pre></article>`,
      )
      .join('')}
    </div><p class="status-line">이 검사는 선택한 사례의 계약을 확인합니다. 성능·Reflow 횟수나 모든 입력의 정확성을 증명하지 않습니다. 같은 종류의 Hook끼리 순서를 바꾸는 오류는 자동 검출하지 못합니다.</p>`;
  scope.querySelector('.workspace').append(section);
  const card = (id) => section.querySelector(`[data-proof="${id}"]`);
  const explanations = {
    dom: [
      '누르는 순서: TEXT Patch → 전체 교체 → TEXT Patch',
      'TEXT Patch에서 true는 같은 노드 객체를 유지했다는 뜻입니다. 전체 교체에서 false는 예상된 결과입니다. 전체 교체 후에는 최초 노드가 사라졌으므로 다시 Patch해도 최초 참조 비교는 false입니다.',
    ],
    commands: [
      '읽는 순서: 예상 명령 → 실제 명령 → 적용 결과',
      'TEXT는 글자 수정, path [0]은 루트 p의 첫 자식 Text를 뜻합니다. 명령 전체 일치 PASS와 적용 결과 일치 PASS를 함께 확인하세요. 이 버튼은 고정된 한 사례를 검사합니다.',
    ],
    history: [
      '누르는 순서: 새 상태 두 번 → Undo → Redo → Undo → 새 상태',
      '커서는 선택한 이력 위치입니다. PASS는 저장된 목표 VDOM과 실제 DOM을 다시 읽은 값이 같다는 뜻입니다. 과거에서 새 상태를 추가하면 이전 미래가 지워져 Redo가 비활성화됩니다.',
    ],
    hooks: [
      '누르는 순서: 정상 갱신 → 정상 갱신 → 조건부 Hook 오류 실험',
      'index는 Hook이 호출된 순서이며 state는 상태, memo는 계산 결과입니다. 값이 바뀌어도 슬롯 참조가 유지되는지 확인하세요. 예상 오류는 잘못된 Hook 호출을 거부했다는 뜻이며 정상 예제의 고장이 아닙니다.',
    ],
  };
  for (const [id, [order, explanation]] of Object.entries(explanations)) {
    const note = document.createElement('div');
    note.className = 'proof-explanation';
    const title = document.createElement('strong');
    title.textContent = order;
    const text = document.createElement('p');
    text.textContent = explanation;
    note.append(title, text);
    card(id).querySelector('.proof-actions').before(note);
  }
  const stage = (id) => card(id).querySelector('[data-stage]');
  const report = (id, text) => {
    card(id).querySelector('[data-evidence]').textContent = text;
  };
  const tree = (n) => h('p', {}, `상태 ${n}`);
  let domN = 0;
  let domTree = tree(domN);
  let domRoot = render(domTree);
  stage('dom').append(domRoot);
  const original = domRoot;
  const originalText = domRoot.firstChild;
  let historyTree = tree(0);
  let historyRoot = render(historyTree);
  const history = createHistory(historyTree);
  stage('history').append(historyRoot);
  let serial = 0;
  function showHistory() {
    card('history').querySelector('[data-proof-action="undo"]').disabled =
      !history.canUndo();
    card('history').querySelector('[data-proof-action="redo"]').disabled =
      !history.canRedo();
    report(
      'history',
      `${same(domToVNode(historyRoot), history.current()) ? 'PASS' : 'FAIL'} · DOM과 목표 일치\n커서 ${history.index + 1} / ${history.length}\nRedo 가능: ${history.canRedo()}\n저장된 목표: ${json(history.current())}`,
    );
  }
  let setCount;
  const app = new FunctionComponent(() => {
    const [count, set] = useState(0);
    setCount = set;
    const doubled = useMemo(() => count * 2, [count]);
    return h('p', {}, `count ${count} / memo ${doubled}`);
  }).mount(stage('hooks'));
  const slots = app.hooks.slice();
  function showHooks() {
    report(
      'hooks',
      `${slots.every((slot, i) => slot === app.hooks[i]) ? 'PASS' : 'FAIL'} · 최초 슬롯 참조 유지\n렌더 ${app.renderCount}회\n${json(app.hooks.map((slot, index) => ({ index, kind: slot.kind, value: slot.value })))}`,
    );
  }
  let disposed = false;
  async function act(event) {
    const action = event.target.closest('[data-proof-action]')?.dataset
      .proofAction;
    if (!action) return;
    try {
      if (action === 'patch' || action === 'replace') {
        const next = tree(++domN);
        const changes = diff(domTree, next);
        domRoot = action === 'patch' ? patch(domRoot, changes) : render(next);
        stage('dom').replaceChildren(domRoot);
        domTree = next;
        report(
          'dom',
          `화면: ${domRoot.textContent}\n최초 element === 현재: ${original === domRoot}\n최초 Text === 현재: ${originalText === domRoot.firstChild}\n${action === 'patch' ? json(changes) : '전체 교체: 새 DOM 노드를 생성했습니다.'}\n전체 교체 후 최초 참조는 복구되지 않습니다.`,
        );
      } else if (action === 'commands') {
        const before = h('p', {}, '안녕');
        const after = h('p', {}, '반가워');
        const expected = [{ type: 'TEXT', path: [0], value: '반가워' }];
        const actual = diff(before, after);
        const result = patch(render(before), actual);
        stage('commands').replaceChildren(result);
        report(
          'commands',
          `${same(actual, expected) ? 'PASS' : 'FAIL'} · 명령 전체 일치\n${same(domToVNode(result), after) ? 'PASS' : 'FAIL'} · 적용 결과 일치\n예상: ${json(expected)}\n실제: ${json(actual)}`,
        );
      } else if (['push', 'undo', 'redo'].includes(action)) {
        if (action === 'push') history.push(tree(++serial));
        else history[action]();
        const target = history.current();
        historyRoot = patch(historyRoot, diff(historyTree, target));
        historyTree = target;
        showHistory();
      } else if (action === 'hooks') {
        setCount((n) => n + 1);
        await app.settled();
        if (!disposed) showHooks();
      } else if (action === 'invalid') {
        let enabled = true;
        const host = document.createElement('div');
        const bad = new FunctionComponent(() => {
          useState(0);
          if (enabled) useMemo(() => 1, []);
          return h('p', {}, '정상 commit');
        });
        try {
          bad.mount(host);
          enabled = false;
          bad.update();
          report('hooks', 'FAIL · 잘못된 Hook 호출이 허용되었습니다.');
        } catch (error) {
          report(
            'hooks',
            `예상 오류 관찰: ${error.message}\n마지막 DOM: ${host.textContent}\n정상 슬롯: state → memo\n오류 호출: state → (memo 생략)\n독립 인스턴스로 검사하여 위 정상 예제는 계속 사용할 수 있습니다.`,
          );
        } finally {
          bad.unmount();
        }
      }
    } catch (error) {
      report(
        event.target.closest('[data-proof]').dataset.proof,
        `FAIL · ${error.message}`,
      );
    }
  }
  section.addEventListener('click', act);
  report('dom', '대기 · 최초 element와 Text 참조를 저장했습니다.');
  report('commands', '대기 · 버튼을 누르면 예상값과 실제값을 표시합니다.');
  showHistory();
  showHooks();
  return () => {
    disposed = true;
    app.unmount();
    section.removeEventListener('click', act);
    section.remove();
    button.remove();
  };
}
