import { domToVNode } from '../vdom/dom-to-vnode.js';
import { render } from '../vdom/render.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import { createHistory } from '../history/history.js';
import {
  h,
  FunctionComponent,
  useState,
  useEffect,
  useMemo,
} from '../runtime/index.js';
import { App } from '../demo/app.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 테스트 프레임워크 없이 브라우저의 실제 DOM에서 실행하는 재현 가능한 기능 검사. */
export async function runBrowserChecks() {
  const results = [];
  const sandbox = document.createElement('div');
  sandbox.hidden = true;
  sandbox.dataset.testSandbox = '';
  document.body.append(sandbox);
  let active;
  async function check(name, task) {
    try {
      await task();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error: error.message });
    } finally {
      active?.unmount();
      active = null;
      sandbox.replaceChildren();
    }
  }
  function mount(Component, props = {}) {
    active = new FunctionComponent(Component, props).mount(sandbox);
    return active;
  }
  try {
    await check('DOM → VDOM → DOM: 중첩·공백·속성 보존', () => {
      sandbox.innerHTML = '<p class="x">안녕 <strong>정글</strong></p>';
      const vnode = domToVNode(sandbox.firstChild);
      assert(
        same(domToVNode(render(vnode)), vnode),
        '왕복 변환 결과가 다릅니다.',
      );
    });
    await check('Diff: 다섯 가지 변경 분류', () => {
      const cases = [
        [h('p', {}, 'a'), h('p', {}, 'b'), 'TEXT'],
        [h('p', { title: 'a' }), h('p', { title: 'b' }), 'PROPS'],
        [h('p'), h('div'), 'REPLACE'],
        [h('div'), h('div', {}, h('p')), 'INSERT'],
        [h('div', {}, h('p')), h('div'), 'REMOVE'],
      ];
      cases.forEach(([a, b, type]) =>
        assert(diff(a, b)[0]?.type === type, type + ' 분류 실패'),
      );
    });
    await check('Patch: 연속 삭제 + 형제 변경', () => {
      const a = h(
        'div',
        {},
        h(
          'ul',
          {},
          ['a', 'b', 'c'].map((t) => h('li', {}, t)),
        ),
        h('p', {}, 'old'),
      );
      const b = h('div', {}, h('ul', {}, h('li', {}, 'a')), h('p', {}, 'new'));
      assert(
        same(domToVNode(patch(render(a), diff(a, b))), b),
        '여러 변경의 적용 결과가 다릅니다.',
      );
    });
    await check('Patch: 바뀌지 않은 노드 참조 유지', () => {
      const a = h('div', {}, h('button', {}, '고정'), h('p', {}, 'a'));
      const b = h('div', {}, h('button', {}, '고정'), h('p', {}, 'b'));
      const root = render(a),
        button = root.firstChild;
      patch(root, diff(a, b));
      assert(
        root.firstChild === button && root.lastChild.textContent === 'b',
        '기존 노드가 불필요하게 교체됐습니다.',
      );
    });
    await check('Patch: 기존 이벤트 제거 + 새 이벤트 등록', () => {
      let first = 0,
        second = 0;
      const a = h('button', { onClick: () => first++ }),
        b = h('button', { onClick: () => second++ });
      const root = render(a);
      sandbox.append(root);
      patch(root, diff(a, b));
      root.click();
      assert(first === 0 && second === 1, '이벤트 교체 실패');
    });
    await check('History: undo/redo + 새 분기 + 스냅샷 보호', () => {
      const original = h('p', {}, 'a'),
        history = createHistory(original);
      original.children[0].value = '변이';
      assert(
        history.current().children[0].value === 'a',
        '스냅샷이 원본과 공유됩니다.',
      );
      history.push(h('p', {}, 'b'));
      history.push(h('p', {}, 'c'));
      history.undo();
      assert(history.redo().children[0].value === 'c', 'redo 실패');
      history.undo();
      history.push(h('p', {}, 'd'));
      assert(!history.canRedo() && history.length === 3, '미래 이력 제거 실패');
    });
    await check('useState: 상태 보존 + 함수형 setter 3회 배칭', async () => {
      let set;
      const app = mount(() => {
        const [n, s] = useState(0);
        set = s;
        return h('p', {}, n);
      });
      set((n) => n + 1);
      set((n) => n + 1);
      set((n) => n + 1);
      await app.settled();
      assert(
        app.root.textContent === '3' && app.renderCount === 2,
        '배칭 또는 상태 보존 실패',
      );
    });
    await check('useMemo: 같은 의존성 캐시 + 변경 시 재계산', async () => {
      let setA,
        setB,
        computations = 0;
      const app = mount(() => {
        const [a, sa] = useState(1),
          [b, sb] = useState(0);
        setA = sa;
        setB = sb;
        const value = useMemo(() => {
          computations++;
          return a * 2;
        }, [a]);
        return h('p', {}, value, '/', b);
      });
      setB(1);
      await app.settled();
      assert(computations === 1, '캐시를 재사용하지 않았습니다.');
      setA(2);
      await app.settled();
      assert(
        computations === 2 && app.root.textContent === '4/1',
        '의존성 갱신 실패',
      );
    });
    await check(
      'useEffect: commit 후 실행 → cleanup → 재실행 → unmount 정리',
      async () => {
        let set;
        const calls = [];
        const app = mount(() => {
          const [n, s] = useState(0);
          set = s;
          useEffect(() => {
            calls.push('effect:' + sandbox.textContent);
            return () => calls.push('cleanup:' + n);
          }, [n]);
          return h('p', {}, n);
        });
        set(1);
        await app.settled();
        app.unmount();
        assert(
          same(calls, ['effect:0', 'cleanup:0', 'effect:1', 'cleanup:1']),
          'Effect 실행 순서가 다릅니다.',
        );
      },
    );
    await check('제약: 자식 컴포넌트 Hook 사용 거부', () => {
      const Child = () => {
        useState(0);
        return h('p');
      };
      let rejected = false;
      try {
        mount(() => h(Child));
      } catch {
        rejected = true;
      }
      assert(rejected, '자식에서 Hook을 호출할 수 있습니다.');
    });
    await check('할 일 앱: 입력 → 추가 → 검색 → 완료 → 삭제', async () => {
      const app = mount(App, { logEffect() {}, idPrefix: 'self-' });
      const draft = sandbox.querySelector('#self-task-draft');
      draft.value = '브라우저 검사';
      draft.dispatchEvent(new Event('input'));
      await app.settled();
      sandbox
        .querySelector('form')
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await app.settled();
      assert(sandbox.querySelectorAll('.task-item').length === 4, '추가 실패');
      const search = sandbox.querySelector('#self-task-search');
      search.value = '브라우저 검사';
      search.dispatchEvent(new Event('input'));
      await app.settled();
      const checkbox = sandbox.querySelector('.task-item input');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      await app.settled();
      assert(
        sandbox.querySelector('.task-item').classList.contains('done'),
        '완료 처리 실패',
      );
      sandbox.querySelector('.task-item button').click();
      await app.settled();
      assert(
        Boolean(sandbox.querySelector('.empty-state')),
        '삭제 또는 검색 실패',
      );
    });
    await check('Unmount: 예약 업데이트·뒤늦은 setter 무시', async () => {
      let set;
      const app = mount(() => {
        const [n, s] = useState(0);
        set = s;
        return h('p', {}, n);
      });
      set(1);
      app.unmount();
      await app.settled();
      set(2);
      assert(
        !sandbox.childNodes.length && app.renderCount === 1,
        'Unmount 이후 DOM이 갱신됐습니다.',
      );
    });
  } finally {
    active?.unmount();
    sandbox.remove();
  }
  return results;
}

export function setupSelfTests(scope = document) {
  const button = scope.querySelector('#run-self-tests'),
    output = scope.querySelector('#self-test-output');
  async function run() {
    button.disabled = true;
    output.textContent = '실제 DOM에서 검사 중…';
    try {
      const results = await runBrowserChecks();
      const passed = results.filter((result) => result.passed).length;
      output.textContent =
        passed +
        ' / ' +
        results.length +
        ' 통과\n\n' +
        results
          .map(
            (result) =>
              (result.passed ? 'PASS' : 'FAIL') +
              '  ' +
              result.name +
              (result.error ? '\n      ' + result.error : ''),
          )
          .join('\n');
      output.dataset.error = String(passed !== results.length);
    } finally {
      button.disabled = false;
    }
  }
  button.addEventListener('click', run);
  return () => button.removeEventListener('click', run);
}
