import {
  h,
  FunctionComponent,
  useState,
  useMemo,
  useEffect,
} from '../runtime/index.js';
import { render } from '../vdom/render.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import { domToVNode } from '../vdom/dom-to-vnode.js';
import { createHistory } from '../history/history.js';

export function setupWorld(scope, record) {
  const host = scope.querySelector('#characters');
  if (!host) return { destroy() {} };
  const initial = h(
    'section',
    { class: 'world-sample' },
    h('h3', {}, '안녕, 나는 노드야!'),
    h('ul', {}, h('li', { key: 'a' }, '모모'), h('li', { key: 'b' }, '루루')),
  );
  let root = render(initial);
  host.querySelector('#world-dom').replaceChildren(root);
  const baseline = domToVNode(root);
  // key는 DOM 속성이 아닌 비교용 메타데이터이므로 변환 후 별도로 연결한다.
  baseline.children[1].children.forEach((node, index) => {
    node.props.key = initial.children[1].children[index].props.key;
  });
  const history = createHistory(baseline);
  let serial = 0;
  function commit(next, label) {
    const previous = history.current();
    const patches = diff(previous, next);
    root = patch(root, patches);
    if (patches.length) history.push(next);
    record({
      source: 'phase1',
      stream: 'world-dom',
      label,
      previous,
      next,
      patches,
      root,
    });
  }
  let setCount;
  let effectRuns = 0;
  function Counter() {
    const [count, setter] = useState(0);
    setCount = setter;
    const doubled = useMemo(() => count * 2, [count]);
    useEffect(() => {
      effectRuns++;
      return () => {};
    }, [count]);
    return h(
      'section',
      { class: 'world-sample' },
      h('h3', {}, 'State 친구'),
      h('p', {}, '카운트 ' + count),
      h('p', {}, 'Memo ×2 = ' + doubled),
    );
  }
  const runtime = new FunctionComponent(Counter);
  runtime.onCommit = (info) => {
    host.querySelector('#world-hook-status').textContent =
      `렌더 ${info.renderCount}회 · Memo ${info.memoRuns}회 · Effect ${effectRuns}회`;
    record({
      ...info,
      source: 'phase2',
      stream: 'world-state',
      label: info.previous
        ? 'setter 3번 → 배칭 1번 → DOM 반영 → Effect'
        : 'State 친구 Mount',
    });
  };
  runtime.mount(host.querySelector('#world-state'));
  record({
    source: 'phase1',
    stream: 'world-dom',
    label: 'DOM을 읽어 VDOM 친구로!',
    previous: null,
    next: history.current(),
    patches: [],
    root,
  });
  function onClick(event) {
    const open = event.target.closest('[data-world-open]');
    if (open)
      scope.querySelector(`[data-view="${open.dataset.worldOpen}"]`)?.click();
    const control = event.target.closest('[data-world-action]');
    if (!control) return;
    const action = control.dataset.worldAction;
    if (action === 'reset') {
      commit(structuredClone(baseline), '처음 트리로 · 친구들 다시 모이기');
      return;
    }
    if (action === 'noop') {
      commit(
        structuredClone(history.current()),
        '변경 없음 · Patch 0개 · 같은 DOM 유지',
      );
      return;
    }
    if (action === 'batch') {
      for (let i = 0; i < 3; i++) setCount((value) => value + 1);
      return;
    }
    if (action === 'undo' || action === 'redo') {
      const previous = history.current();
      const next = history[action]();
      const patches = diff(previous, next);
      root = patch(root, patches);
      record({
        source: 'phase1',
        stream: 'world-dom',
        label: action === 'undo' ? 'Undo · 이전 상태' : 'Redo · 다음 상태',
        previous,
        next,
        patches,
        root,
      });
      return;
    }
    const next = structuredClone(history.current());
    const title = next.children[0],
      list = next.children[1];
    if (action === 'text')
      title.children[0].value = `반가워! ${++serial}번째 인사야`;
    if (action === 'props')
      next.props.class =
        next.props.class === 'world-sample accent'
          ? 'world-sample'
          : 'world-sample accent';
    if (action === 'insert')
      list.children.push(
        h('li', { key: 'new-' + ++serial }, '새 친구 ' + serial),
      );
    if (action === 'remove') list.children.pop();
    if (action === 'replace') title.tag = title.tag === 'h3' ? 'h2' : 'h3';
    if (action === 'move' && list.children.length > 1)
      list.children.unshift(list.children.pop());
    const labels = {
      text: 'TEXT · 말풍선 바꾸기',
      props: 'PROPS · 옷 갈아입기',
      insert: 'INSERT · 새 친구 등장',
      remove: 'REMOVE · 친구 퇴장',
      replace: 'REPLACE · 다른 노드로 교체',
      move: 'MOVE · 같은 친구 자리 이동',
    };
    if (labels[action]) commit(next, labels[action]);
  }
  host.addEventListener('click', onClick);
  return {
    runtime,
    history,
    destroy() {
      host.removeEventListener('click', onClick);
      runtime.unmount();
    },
  };
}
