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
import { buildDiffTrace } from './diff-trace.js';
import { setupJourneyView } from './journey-view.js';
import { renderDirectly } from './direct-render.js';

const initialTree = () =>
  h(
    'section',
    { class: 'world-sample' },
    h('h3', {}, '안녕, 노드 친구들!'),
    h(
      'ul',
      {},
      h('li', { key: 'momo' }, '모모'),
      h('li', { key: 'ruru' }, '루루'),
    ),
    h('p', { class: 'journey-counter' }, 'State 0 · Memo ×2 = 0'),
  );
const copy = (tree) => structuredClone(tree);
function collect(root) {
  const nodes = new Set();
  function visit(node) {
    if (!node) return;
    nodes.add(node);
    for (const child of node.childNodes)
      if ([1, 3].includes(child.nodeType)) visit(child);
  }
  visit(root);
  return nodes;
}
const initialDirectModel = () => ({
  greeting: '안녕, 노드 친구들!',
  headingTag: 'h3',
  accent: false,
  friends: ['모모', '루루'],
  count: 0,
  memo: 0,
});

/** The visible DOM is authoritative and is changed only by Patch delivery/reset. */
export function setupJourney(host) {
  if (!host) return { destroy() {} };
  let root,
    committed,
    runtime,
    setter,
    playTimer,
    deliveryTimer,
    serial = 0,
    disposed = false,
    generation = 0,
    suppressRuntime = false,
    directRenders = 0,
    directModel = initialDirectModel(),
    effectLog = [];
  let keys = new WeakMap();
  const state = {
    phase: 'dom',
    previous: null,
    next: null,
    patches: [],
    trace: [],
    cursor: -1,
    completed: false,
    playing: false,
    speed: 1000,
    speech: '왼쪽은 진짜 DOM이에요. 먼저 DOM에서 기존 VDOM을 만들어 볼까요?',
    evidence: null,
    directEvidence: null,
    effectLog: [],
    instantMode: false,
    appliedMode: null,
    count: 0,
    renderCount: 0,
    memoRuns: 0,
  };
  const view = setupJourneyView(host, {
    read,
    draft,
    compare,
    next,
    play,
    patch: deliver,
    reset,
    instantMode(value) {
      state.instantMode = Boolean(value);
      if (
        state.instantMode &&
        ['draft', 'comparing', 'ready'].includes(state.phase) &&
        !runtime?.scheduled
      )
        applyInstantly();
      else show();
    },
    speed(value) {
      state.speed = Number(value) || 1000;
      if (state.playing) scheduleNext();
      show();
    },
  });
  function show() {
    if (!disposed) view.render(state);
  }
  function renderDirectModel() {
    const result = renderDirectly(view.directHost, directModel);
    directRenders++;
    state.directEvidence = {
      created: result.created,
      removed: result.removed,
      reused: result.reused,
      renders: directRenders,
    };
  }
  function stop() {
    clearTimeout(playTimer);
    state.playing = false;
  }
  function remember(tree, node) {
    if (!tree || !node) return;
    if (tree.props?.key != null) keys.set(node, tree.props.key);
    const children = Array.from(node.childNodes).filter((child) =>
      [1, 3].includes(child.nodeType),
    );
    (tree.children || []).forEach((child, index) =>
      remember(child, children[index]),
    );
  }
  function readKeys(tree, node) {
    if (tree.type === 'element' && keys.has(node))
      tree.props.key = keys.get(node);
    const children = Array.from(node.childNodes).filter((child) =>
      [1, 3].includes(child.nodeType),
    );
    (tree.children || []).forEach((child, index) =>
      readKeys(child, children[index]),
    );
    return tree;
  }
  function read() {
    if (disposed || state.phase === 'applying') return;
    stop();
    committed = readKeys(domToVNode(root), root);
    Object.assign(state, {
      phase: 'read',
      previous: copy(committed),
      next: null,
      patches: [],
      trace: [],
      cursor: -1,
      completed: false,
      evidence: null,
      speech:
        'DOM → domToVNode! 실제 화면을 읽어서 기존 VDOM 트리가 생겼어요. 이제 신규 VDOM을 만들어 보세요.',
    });
    show();
  }
  function prepare(candidate, speech) {
    stop();
    Object.assign(state, {
      phase: 'draft',
      previous: copy(committed),
      next: candidate,
      patches: [],
      trace: [],
      cursor: -1,
      completed: false,
      evidence: null,
      appliedMode: null,
      speech,
    });
    show();
    if (state.instantMode) applyInstantly();
  }
  function applyInstantly() {
    if (
      !state.next ||
      !['draft', 'comparing', 'ready'].includes(state.phase) ||
      runtime?.scheduled
    )
      return;
    stop();
    if (state.phase === 'draft') {
      state.patches = diff(state.previous, state.next);
      state.trace = buildDiffTrace(state.previous, state.next, state.patches);
    }
    state.cursor = state.trace.length - 1;
    state.completed = true;
    state.phase = 'patched';
    state.appliedMode = 'instant';
    const before = collect(root);
    root = patch(root, state.patches);
    const after = collect(root);
    state.evidence = {
      reused: [...after].filter((node) => before.has(node)).length,
      created: [...after].filter((node) => !before.has(node)).length,
      removed: [...before].filter((node) => !after.has(node)).length,
    };
    committed = copy(state.next);
    remember(committed, root);
    state.speech =
      '같은 입력으로 직접 DOM 전체 렌더와 VDOM Diff/Patch를 실행했어요. DOM 재사용과 변경 경로를 비교해 보세요. 애니메이션 대기 시간은 속도 비교가 아니에요.';
    show();
  }
  function makeRuntime() {
    const token = generation;
    function Candidate() {
      const [count, set] = useState(0);
      setter = set;
      const doubled = useMemo(() => count * 2, [count]);
      useEffect(() => {
        effectLog.push(`effect(${count}) · commit 뒤 실행`);
        return () => effectLog.push(`cleanup(${count}) · 다음 effect 전 정리`);
      }, [count]);
      const tree = copy(state.next || committed || initialTree());
      tree.children[2].children[0].value = `State ${count} · Memo ×2 = ${doubled}`;
      state.count = count;
      directModel.count = count;
      directModel.memo = doubled;
      return tree;
    }
    suppressRuntime = true;
    runtime = new FunctionComponent(Candidate);
    runtime.onCommit = (info) => {
      if (disposed || token !== generation) return;
      state.renderCount = info.renderCount;
      state.memoRuns = info.memoRuns;
      state.effectLog = [...effectLog];
      if (!suppressRuntime) renderDirectModel();
      if (!suppressRuntime)
        prepare(
          info.next,
          'setter 3번 → 컴포넌트 1번 실행 → 신규 VDOM 생성! 아직 화면의 실제 DOM은 그대로예요.',
        );
    };
    runtime.mount(host.ownerDocument.createElement('div'));
    suppressRuntime = false;
  }
  function draft(action) {
    if (
      disposed ||
      !committed ||
      state.phase === 'dom' ||
      state.phase === 'applying' ||
      runtime?.scheduled
    )
      return;
    if (action === 'batch') {
      stop();
      for (let index = 0; index < 3; index++) setter((value) => value + 1);
      return;
    }
    const tree = copy(
      state.phase === 'patched' ? committed : state.next || committed,
    );
    const title = tree.children[0],
      list = tree.children[1];
    if (action === 'text') {
      directModel.greeting = `반가워! ${++serial}번째 인사야`;
      title.children[0].value = directModel.greeting;
    } else if (action === 'props') {
      tree.props.class =
        tree.props.class === 'world-sample accent'
          ? 'world-sample'
          : 'world-sample accent';
      directModel.accent = tree.props.class.includes('accent');
    } else if (action === 'replace') {
      title.tag = title.tag === 'h3' ? 'h2' : 'h3';
      directModel.headingTag = title.tag;
    } else if (action === 'insert') {
      const friend = '새 친구 ' + ++serial;
      list.children.push(h('li', { key: 'new-' + serial }, friend));
      directModel.friends.push(friend);
    } else if (action === 'remove') {
      list.children.pop();
      directModel.friends.pop();
    } else if (action === 'move' && list.children.length > 1) {
      list.children.unshift(list.children.pop());
      directModel.friends.unshift(directModel.friends.pop());
    } else if (action !== 'noop' && action !== 'move') return;
    renderDirectModel();
    prepare(
      tree,
      '신규 VDOM만 바뀌었어요. 기존 VDOM과 실제 DOM은 그대로! Diff 친구에게 두 트리를 비교해 달라고 해보세요.',
    );
  }
  function compare() {
    if (
      disposed ||
      !state.next ||
      !['draft', 'comparing', 'ready'].includes(state.phase) ||
      runtime?.scheduled
    )
      return;
    stop();
    state.patches = diff(state.previous, state.next);
    state.trace = buildDiffTrace(state.previous, state.next, state.patches);
    state.cursor = -1;
    state.completed = false;
    state.phase = 'comparing';
    state.speech =
      'Diff 시작! 대응하는 노드끼리 하나씩 만나서 태그·텍스트·속성·key를 비교해요. 아직 DOM은 건드리지 않아요.';
    next();
  }
  function next() {
    if (
      disposed ||
      !['comparing', 'ready'].includes(state.phase) ||
      state.completed
    )
      return;
    state.cursor++;
    const item = state.trace[state.cursor];
    state.completed = state.cursor >= state.trace.length - 1;
    state.phase = state.completed ? 'ready' : 'comparing';
    state.speech = item ? item.label : '비교할 노드가 없어요.';
    if (state.completed) {
      stop();
      state.speech += ` 비교 완료! 변경 명령 ${state.patches.length}개를 Patch 친구에게 맡겼어요. Patch를 눌러야 실제 DOM이 바뀌어요.`;
    }
    show();
  }
  function scheduleNext() {
    clearTimeout(playTimer);
    if (state.playing)
      playTimer = setTimeout(() => {
        next();
        if (state.playing) scheduleNext();
      }, state.speed);
  }
  function play() {
    if (
      disposed ||
      !state.next ||
      !['draft', 'comparing', 'ready'].includes(state.phase)
    )
      return;
    if (state.playing) {
      stop();
      show();
      return;
    }
    if (state.phase !== 'comparing' || state.completed) compare();
    if (!state.completed) {
      state.playing = true;
      scheduleNext();
      show();
    }
  }
  function deliver() {
    if (
      disposed ||
      state.phase !== 'ready' ||
      !state.completed ||
      !state.next ||
      runtime?.scheduled
    )
      return;
    stop();
    state.phase = 'applying';
    state.speech =
      'Patch 친구가 변경 명령을 들고 실제 DOM으로 걸어가요. 도착하기 전까지 화면은 그대로예요!';
    show();
    const token = generation;
    deliveryTimer = setTimeout(
      () => {
        if (disposed || generation !== token || state.phase !== 'applying')
          return;
        const before = collect(root);
        root = patch(root, state.patches);
        const after = collect(root);
        state.evidence = {
          reused: [...after].filter((node) => before.has(node)).length,
          created: [...after].filter((node) => !before.has(node)).length,
          removed: [...before].filter((node) => !after.has(node)).length,
        };
        committed = copy(state.next);
        remember(committed, root);
        state.phase = 'patched';
        state.appliedMode = 'guided';
        state.speech = state.patches.length
          ? '배달 완료! 변경 명령만 실제 DOM에 적용했어요. TEXT·PROPS·MOVE는 기존 DOM을 재사용하고 REPLACE는 실제 노드를 교체해요.'
          : '배달 완료! 차이가 없어 Patch 0개. 실제 DOM 노드는 전부 그대로예요.';
        show();
      },
      Math.max(250, state.speed * 0.7),
    );
  }
  function reset() {
    stop();
    clearTimeout(deliveryTimer);
    generation++;
    runtime?.unmount();
    keys = new WeakMap();
    committed = null;
    serial = 0;
    directRenders = 0;
    directModel = initialDirectModel();
    effectLog = [];
    root = render(initialTree());
    view.dom.replaceChildren(root);
    remember(initialTree(), root);
    Object.assign(state, {
      phase: 'dom',
      previous: null,
      next: null,
      patches: [],
      trace: [],
      cursor: -1,
      completed: false,
      evidence: null,
      directEvidence: null,
      effectLog: [],
      appliedMode: null,
      count: 0,
      renderCount: 0,
      memoRuns: 0,
      speech:
        '여기서 시작해요. 실제 DOM을 읽어 기존 VDOM 친구들을 만들어 보세요.',
    });
    renderDirectModel();
    makeRuntime();
    show();
  }
  reset();
  return {
    get root() {
      return root;
    },
    get state() {
      return state;
    },
    get runtime() {
      return runtime;
    },
    destroy() {
      disposed = true;
      stop();
      clearTimeout(deliveryTimer);
      generation++;
      runtime?.unmount();
      view.destroy();
    },
  };
}
