import './journey.css';

const pkey = (path) => path.join('.');
const actionLabels = {
  text: '💬 말 바꾸기',
  props: '🎨 옷 바꾸기',
  replace: '↻ 친구 교체',
  insert: '＋ 친구 추가',
  remove: '− 친구 보내기',
  move: '⇄ 자리 바꾸기',
  noop: '＝ 똑같이 만들기',
  batch: '⚡ State +3',
};
function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function flatten(tree) {
  const items = [];
  function visit(node, path, id, parent) {
    if (!node) return;
    items.push({ node, path, id, parent, depth: path.length });
    const children = node.children || [],
      keys = children.map((child) => child.props?.key),
      keyed =
        keys.every((key) => key != null) && new Set(keys).size === keys.length;
    children.forEach((child, index) =>
      visit(
        child,
        [...path, index],
        `${id}/${keyed ? `key:${typeof keys[index]}:${encodeURIComponent(keys[index])}` : `i:${index}`}:${child.tag || 'text'}`,
        id,
      ),
    );
  }
  visit(tree, [], tree ? `root:${tree.tag || 'text'}` : '', null);
  return items;
}
function positionsFor(items, minimumWidth) {
  const byParent = new Map(),
    positions = new Map();
  for (const item of items) {
    if (!byParent.has(item.parent)) byParent.set(item.parent, []);
    byParent.get(item.parent).push(item);
  }
  let leaf = 0;
  function place(item) {
    const xs = (byParent.get(item.id) || []).map(place),
      x = xs.length ? (xs[0] + xs.at(-1)) / 2 : 52 + leaf++ * 98;
    positions.set(item.id, { x, y: 18 + item.depth * 104 });
    return x;
  }
  for (const root of byParent.get(null) || []) place(root);
  const natural = Math.max(180, leaf * 98 + 6),
    width = Math.max(minimumWidth || 280, natural);
  for (const point of positions.values()) point.x += (width - natural) / 2;
  return {
    positions,
    width,
    height: Math.max(
      200,
      122 + Math.max(0, ...items.map((item) => item.depth)) * 104,
    ),
  };
}
const creature =
  '<span class="jv-creature" aria-hidden="true"><span class="jv-sprout"></span><span class="jv-body"><i></i><i></i><b></b><em></em><em></em></span><span class="jv-arm jv-arm-left"></span><span class="jv-arm jv-arm-right"></span><span class="jv-leg jv-leg-left"></span><span class="jv-leg jv-leg-right"></span></span>';

export function setupJourneyView(host, callbacks = {}) {
  const doc = host.ownerDocument;
  host.classList.add('jv-journey');
  host.innerHTML = `<header class="jv-heading"><div><span>DOM → VDOM → DIFF → PATCH</span><h2>친구들이 만나고, 차이를 배달해요.</h2><p>DOM을 읽고 → 다음 트리를 만들고 → 한 쌍씩 만나고 → Patch가 배달해요.</p></div><button type="button" data-journey="reset">처음부터 ↻</button></header>
    <div class="jv-actions"><span>다음 VDOM 만들기</span>${Object.entries(
      actionLabels,
    )
      .map(
        ([action, label]) =>
          `<button type="button" data-journey-action="${action}">${label}</button>`,
      )
      .join(
        '',
      )}<label>걸음 속도 <select data-journey="speed"><option value="1800">천천히</option><option value="1000">보통</option><option value="450">빠르게</option></select></label></div>
    <section class="jv-render-compare" aria-labelledby="jv-render-title">
      <header><div><span>같은 상태 변경, 다른 렌더 방식</span><h3 id="jv-render-title">VDOM이 없을 때와 있을 때</h3><p>자동 실행에서도 VDOM 캐릭터의 교체·이동 애니메이션은 유지돼요. Patch 대기와 애니메이션은 설명 연출이며 실행 속도 측정이 아닙니다.</p></div><label class="jv-mode-toggle"><input type="checkbox" data-journey="instant-mode">같은 입력으로 자동 실행</label></header>
      <div class="jv-render-columns">
        <article class="jv-direct-column"><span class="jv-render-kicker">WITHOUT VDOM</span><h4>직접 DOM 전체 렌더</h4><p class="jv-render-flow">상태값 → createElement → 기존 화면 통째로 교체</p><div class="jv-direct-preview" data-journey="direct-dom"></div><p class="jv-render-metrics" data-journey="direct-metrics"></p></article>
        <article class="jv-patch-column"><span class="jv-render-kicker">MINI REACT</span><h4>VDOM Diff → Patch</h4><p class="jv-render-flow">이전·다음 VDOM 비교 → 변경 명령만 실제 DOM에 적용</p><p class="jv-engine-result" data-journey="engine-result"></p><dl><div><dt>재사용한 DOM</dt><dd data-journey="engine-reused">—</dd></div><div><dt>새로 만든 DOM</dt><dd data-journey="engine-created">—</dd></div><div><dt>제거한 DOM</dt><dd data-journey="engine-removed">—</dd></div></dl><h5>useEffect · commit 이후</h5><pre data-journey="effect-log">초기 effect 대기</pre></article>
      </div>
    </section>
    <div class="jv-storyboard"><section class="jv-dom-home"><div class="jv-panel-heading"><span>START & ARRIVAL</span><h3>진짜 DOM의 집</h3><small>아직 Patch가 오지 않으면 그대로예요.</small></div><div class="jv-live-window"><div data-journey="dom" class="jv-live-dom"></div></div><button type="button" class="jv-read" data-journey="read">① DOM 읽어오기 →</button><p class="jv-dom-note" data-journey="dom-note"></p><div class="jv-evidence" data-journey="evidence"></div></section>
    <section class="jv-tree-panel jv-old-panel"><div class="jv-panel-heading"><span>01 / PREVIOUS VDOM</span><h3>이전 트리</h3><small>진짜 DOM을 읽어서 만든 친구들 · 화면 안에 자동 맞춤</small></div><div class="jv-tree-window"><div class="jv-tree" data-journey="old-tree"><svg data-journey="old-branches" aria-hidden="true"></svg><p class="jv-tree-empty" data-journey="old-empty">먼저 DOM을 읽어주세요.</p></div></div></section>
    <section class="jv-tree-panel jv-new-panel"><div class="jv-panel-heading"><span>02 / NEXT VDOM</span><h3>다음 트리</h3><small>다음 모습 · DOM은 그대로 · 화면 안에 자동 맞춤</small></div><div class="jv-tree-window"><div class="jv-tree" data-journey="new-tree"><svg data-journey="new-branches" aria-hidden="true"></svg><p class="jv-tree-empty" data-journey="new-empty">다음 모습을 골라주세요.</p></div></div></section>
    <section class="jv-meeting"><div class="jv-meeting-top"><span>③ 하나씩 만나보는 비교 광장</span><span data-journey="progress">0 / 0 쌍</span></div><div class="jv-arena" data-journey="arena"><div class="jv-ring"></div><div class="jv-walker jv-walker-old" data-journey="walker-old">${creature}<strong></strong><small>이전 친구</small></div><div class="jv-walker jv-walker-new" data-journey="walker-new">${creature}<strong></strong><small>다음 친구</small></div><div class="jv-meeting-speech" role="status" aria-live="polite" data-journey="speech">친구들이 차례대로 만나러 와요.</div></div><div class="jv-compare-controls"><button type="button" data-journey="compare">② 비교 시작</button><button type="button" data-journey="next">한 쌍 더 →</button><button type="button" data-journey="play">▶ 걸어보자</button></div></section></div>
    <section class="jv-delivery"><div class="jv-delivery-arrow" aria-hidden="true">← ← DOM의 집으로 배달 ← ←</div><div class="jv-inspector">${creature}<div><strong>Diff 수집가</strong><small data-journey="inspector-speech">다른 부분만 두루마리에 적어요.</small></div></div><div class="jv-scrolls" data-journey="patches"></div><button type="button" class="jv-courier" data-journey="patch" disabled>${creature}<span class="jv-parcel" aria-hidden="true">≡</span><strong>Patch 배달부</strong><small data-journey="patch-label">비교가 끝나면 출발!</small></button></section>
    <div class="jv-footer"><p data-journey="status"></p><details><summary>선택한 친구의 VDOM 보기</summary><pre data-journey="detail">트리의 친구를 눌러보세요.</pre></details></div>`;
  const get = (name) => host.querySelector(`[data-journey="${name}"]`);
  const dom = get('dom'),
    actorMaps = { old: new Map(), new: new Map() },
    listeners = [],
    animations = new Set(),
    timers = new Set();
  dom.setAttribute('inert', '');
  let state,
    previousPhase,
    previousCursor = -1,
    serial = 0,
    courierAnimation,
    disposed = false;
  function reduced() {
    return Boolean(
      doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    );
  }
  function duration() {
    return Math.max(180, Number(state?.speed || 1000) * 0.7);
  }
  function listen(node, event, fn) {
    node.addEventListener(event, fn);
    listeners.push(() => node.removeEventListener(event, fn));
  }
  function animate(node, frames, options = {}) {
    if (reduced() || !node.animate) return null;
    const animation = node.animate(frames, {
      duration: duration(),
      easing: 'cubic-bezier(.25,.75,.25,1)',
      ...options,
    });
    animations.add(animation);
    animation.onfinish = () => animations.delete(animation);
    return animation;
  }
  function cancelActor(actor) {
    if (actor.animation) {
      actor.animation.cancel();
      animations.delete(actor.animation);
    }
  }
  function currentPoint(actor, tree) {
    const rect = actor.button.getBoundingClientRect(),
      base = tree.getBoundingClientRect(),
      zoom = Number(tree.dataset.zoom) || 1;
    return rect.width
      ? { x: (rect.left - base.left) / zoom, y: (rect.top - base.top) / zoom }
      : actor.position;
  }
  function moveActor(actor, from, to, motion) {
    cancelActor(actor);
    actor.position = to;
    actor.button.dataset.motion = motion;
    actor.button.style.left = `${to.x}px`;
    actor.button.style.top = `${to.y}px`;
    actor.animation = animate(
      actor.button,
      [
        {
          transform: `translate(${from.x - to.x}px,${from.y - to.y}px)`,
          opacity: motion === 'enter' ? 0 : 1,
        },
        { transform: 'translate(0,0)', opacity: motion === 'exit' ? 0 : 1 },
      ],
      { fill: 'both' },
    );
    for (const [index, leg] of actor.button
      .querySelectorAll('.jv-leg')
      .entries())
      animate(
        leg,
        Array.from({ length: 9 }, (_, step) => ({
          transform: `rotate(${(step + index) % 2 ? 28 : -28}deg)`,
        })),
        { easing: 'linear' },
      );
  }
  function removeGhost(actor, tree) {
    const ghost = actor.button.cloneNode(true);
    ghost.classList.add('jv-ghost');
    ghost.disabled = true;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.removeAttribute('data-path');
    ghost.dataset.motion = 'exit';
    tree.append(ghost);
    const from = currentPoint(actor, tree),
      destination = { x: -180, y: from.y + 60 };
    ghost.style.left = `${destination.x}px`;
    ghost.style.top = `${destination.y}px`;
    animate(
      ghost,
      [
        {
          transform: `translate(${from.x - destination.x}px,${from.y - destination.y}px)`,
          opacity: 0.9,
        },
        { transform: 'translate(0,0)', opacity: 0 },
      ],
      { fill: 'both' },
    );
    if (reduced()) ghost.remove();
    else {
      const timer = setTimeout(() => {
        ghost.remove();
        timers.delete(timer);
      }, duration());
      timers.add(timer);
    }
  }
  function makeActor(item, side) {
    const button = element(doc, 'button', `jv-actor jv-kind-${item.node.type}`);
    button.type = 'button';
    button.dataset.side = side;
    button.dataset.actorId = `journey-${++serial}`;
    button.innerHTML = `${creature}<span class="jv-node-label"><strong></strong><small></small></span>`;
    const actor = { button, item, position: { x: 0, y: 0 } };
    button.onclick = () => {
      get('detail').textContent =
        `${side === 'old' ? '이전' : '다음'} 트리 · 경로 [${actor.item.path.join(', ')}]\n${JSON.stringify(actor.item.node, (_, value) => (typeof value === 'function' ? '[이벤트 함수]' : value), 2)}`;
    };
    get(`${side}-tree`).append(button);
    return actor;
  }
  function drawTree(side, vnode) {
    const tree = get(`${side}-tree`),
      all = flatten(vnode),
      items = all,
      map = actorMaps[side],
      availableWidth = tree.parentElement.clientWidth || 280,
      availableHeight = Math.max(
        140,
        Math.min(440, (doc.defaultView?.innerHeight || 900) * 0.44),
      ),
      { positions, width, height } = positionsFor(items, availableWidth),
      zoom = Math.min(1, availableWidth / width, availableHeight / height);
    tree.style.width = `${width}px`;
    tree.style.height = `${height}px`;
    tree.style.zoom = String(zoom);
    tree.dataset.zoom = String(zoom);
    tree.dataset.naturalWidth = String(width);
    get(`${side}-empty`).hidden = items.length > 0;
    const targets = new Set(items.map((item) => item.id));
    for (const [id, actor] of map)
      if (!targets.has(id)) {
        cancelActor(actor);
        actor.button.remove();
        map.delete(id);
      }
    for (const item of items) {
      let actor = map.get(item.id);
      const fresh = !actor;
      if (!actor) {
        actor = makeActor(item, side);
        map.set(item.id, actor);
      }
      const point = positions.get(item.id),
        target = { x: point.x - 43, y: point.y },
        home = dom.getBoundingClientRect(),
        canvas = tree.getBoundingClientRect(),
        from = fresh
          ? side === 'old' && home.width
            ? {
                x: (home.left + home.width / 2 - canvas.left - 43) / zoom,
                y: (home.top - canvas.top) / zoom,
              }
            : { x: side === 'old' ? -170 : width + 160, y: target.y + 35 }
          : currentPoint(actor, tree);
      actor.item = item;
      actor.button.dataset.path = pkey(item.path);
      actor.button.dataset.nodeType = item.node.type;
      actor.button.querySelector('.jv-node-label strong').textContent =
        item.node.type === 'text' ? '#text' : `<${item.node.tag}>`;
      actor.button.querySelector('.jv-node-label small').textContent =
        item.node.type === 'text'
          ? item.node.value.trim() || '␠ 공백'
          : item.node.props?.key != null
            ? `key:${item.node.props.key}`
            : item.node.props?.class ||
              item.node.props?.className ||
              `${item.node.children?.length || 0}명`;
      actor.button.setAttribute(
        'aria-label',
        `${side === 'old' ? '이전' : '다음'} ${item.node.type === 'text' ? '텍스트' : item.node.tag} 노드, 경로 ${pkey(item.path) || '루트'}`,
      );
      if (
        fresh ||
        Math.abs(from.x - target.x) > 1 ||
        Math.abs(from.y - target.y) > 1
      )
        moveActor(actor, from, target, fresh ? 'enter' : 'move');
      actor.button.dataset.comparing = 'false';
      actor.button.dataset.change = 'same';
    }
    const svg = get(`${side}-branches`);
    svg.replaceChildren();
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    for (const item of items)
      if (item.parent && positions.has(item.parent)) {
        const a = positions.get(item.parent),
          b = positions.get(item.id),
          line = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.dataset.parent = item.parent;
        line.dataset.child = item.id;
        line.setAttribute(
          'd',
          `M ${a.x} ${a.y + 46} C ${a.x} ${a.y + 78},${b.x} ${b.y - 20},${b.x} ${b.y + 7}`,
        );
        svg.append(line);
      }
    tree.dataset.total = all.length;
  }
  function actorAt(side, path) {
    if (!Array.isArray(path)) return null;
    return [...actorMaps[side].values()].find(
      (actor) => pkey(actor.item.path) === pkey(path),
    );
  }
  function presentPair(entry, shouldAnimate) {
    const arena = get('arena');
    for (const side of ['old', 'new']) {
      const walker = get(`walker-${side}`),
        actor = actorAt(side, side === 'old' ? entry?.oldPath : entry?.newPath),
        label = walker.querySelector('strong');
      walker.hidden = !entry;
      walker.classList.toggle('jv-missing', Boolean(entry && !actor));
      label.textContent = actor
        ? actor.item.node.type === 'text'
          ? '#text'
          : `<${actor.item.node.tag}>`
        : '∅ 없음';
      const words = actor
        ? actor.item.node.type === 'text'
          ? actor.item.node.value.trim() || '␠ 공백'
          : actor.item.node.props?.key != null
            ? `key: ${actor.item.node.props.key}`
            : actor.item.node.props?.class ||
              actor.item.node.props?.className ||
              `${actor.item.node.children?.length || 0}명의 자식`
        : side === 'old'
          ? '새로 오는 친구예요'
          : '이 친구는 떠나요';
      walker.querySelector('small').textContent = words;
      walker.title = `${side === 'old' ? '이전' : '다음'}: ${words}`;
      if (actor) {
        actor.button.dataset.comparing = 'true';
        actor.button.dataset.change = entry.kind;
      }
      if (entry && shouldAnimate) {
        walker.getAnimations?.().forEach((animation) => animation.cancel());
        const base = walker.getBoundingClientRect(),
          origin = actor?.button.getBoundingClientRect();
        const dx = origin?.width
          ? origin.left + origin.width / 2 - base.left - base.width / 2
          : side === 'old'
            ? -arena.clientWidth / 2
            : arena.clientWidth / 2;
        const dy = origin?.height ? origin.top - base.top : -100;
        animate(walker, [
          { transform: `translate(${dx}px,${dy}px)`, opacity: 0.1 },
          { transform: 'translate(0,0)', opacity: 1 },
        ]);
        for (const [index, leg] of walker.querySelectorAll('.jv-leg').entries())
          animate(
            leg,
            Array.from({ length: 9 }, (_, step) => ({
              transform: `rotate(${(step + index) % 2 ? 28 : -28}deg)`,
            })),
            { easing: 'linear' },
          );
      }
    }
    arena.dataset.kind = entry?.kind || 'waiting';
  }
  function patchTransitions() {
    for (const entry of state.trace || []) {
      if (entry.kind === 'same') continue;
      const before = actorAt('old', entry.oldPath),
        after = actorAt('new', entry.newPath);
      if (before && ['REMOVE', 'REPLACE', 'TEXT', 'PROPS'].includes(entry.kind))
        removeGhost(before, get('old-tree'));
      if (after) {
        const tree = get('new-tree'),
          target = after.position,
          oldRect = before?.button.getBoundingClientRect(),
          base = tree.getBoundingClientRect();
        const from =
          entry.kind === 'MOVE' && oldRect?.width
            ? {
                x:
                  (oldRect.left - base.left) / (Number(tree.dataset.zoom) || 1),
                y: (oldRect.top - base.top) / (Number(tree.dataset.zoom) || 1),
              }
            : {
                x: Number(tree.dataset.naturalWidth || tree.clientWidth) + 170,
                y: target.y + 35,
              };
        moveActor(
          after,
          from,
          target,
          entry.kind === 'MOVE' ? 'move' : 'enter',
        );
        after.button.dataset.change = entry.kind;
      }
    }
  }
  function render(nextState) {
    if (disposed) return;
    state = nextState;
    if (
      (state.phase === 'dom' && previousPhase !== 'dom') ||
      (state.phase === 'draft' && previousPhase === 'patched')
    ) {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      host.querySelectorAll('.jv-ghost').forEach((ghost) => ghost.remove());
      courierAnimation = null;
    }
    host.dataset.phase = state.phase;
    host.dataset.completed = String(Boolean(state.completed));
    host.style.setProperty('--jv-step', `${duration()}ms`);
    get('read').disabled = state.phase !== 'dom';
    get('speed').disabled = state.phase === 'applying';
    host.querySelectorAll('[data-journey-action]').forEach((button) => {
      button.disabled = state.phase === 'dom' || state.phase === 'applying';
    });
    get('compare').disabled = !state.next || state.phase !== 'draft';
    get('next').disabled = state.phase !== 'comparing' || state.completed;
    get('play').disabled =
      !state.next ||
      !['draft', 'read', 'comparing'].includes(state.phase) ||
      state.completed;
    get('play').textContent = state.playing ? 'Ⅱ 잠깐 멈춰' : '▶ 걸어보자';
    get('patch').disabled = !(state.phase === 'ready' && state.completed);
    get('speed').value = String(state.speed || 1000);
    get('instant-mode').checked = Boolean(state.instantMode);
    get('instant-mode').disabled = state.phase === 'applying';
    get('patch-label').textContent =
      state.phase === 'applying'
        ? '명령을 들고 가는 중!'
        : state.phase === 'patched'
          ? state.appliedMode === 'instant'
            ? '자동 실행 · Patch 완료'
            : '배달 완료!'
          : state.phase === 'ready'
            ? '눌러서 DOM에 배달!'
            : '비교가 끝나면 출발!';
    get('dom-note').textContent =
      state.phase === 'patched'
        ? '배달 완료! 지금 처음으로 Patch가 실제 DOM에 반영됐어요.'
        : state.phase === 'applying'
          ? 'Patch가 오는 중이에요. 도착하기 전까지 진짜 DOM은 이전 모습 그대로예요.'
          : '친구들을 만들고 비교해도, 배달 전까지 진짜 DOM은 그대로예요.';
    get('evidence').textContent = state.evidence
      ? `실제 DOM 객체 · 재사용 ${state.evidence.reused} / 새로 생성 ${state.evidence.created} / 제거 ${state.evidence.removed}`
      : '실제 DOM은 이곳 하나예요. 별도 복제 화면을 쓰지 않아요.';
    get('direct-metrics').textContent = state.directEvidence
      ? `전체 렌더 ${state.directEvidence.renders}회 · 새 DOM ${state.directEvidence.created}개 · 이전 DOM ${state.directEvidence.removed}개 제거 · 재사용 0개`
      : '상태가 바뀌면 이 영역의 DOM을 전부 새로 만들어요.';
    const engineMessage =
      state.phase === 'patched'
        ? state.appliedMode === 'instant'
          ? '같은 입력에서 실제 Diff/Patch를 실행했어요. VDOM 캐릭터의 변환 애니메이션은 설명 연출이며 속도 비교가 아닙니다.'
          : 'Patch 완료 · 위 실제 DOM에 변경분만 반영했어요.'
        : state.phase === 'applying'
          ? '배달 중 · 도착할 때까지 실제 DOM은 이전 모습이에요.'
          : state.phase === 'ready'
            ? `Diff 완료 · ${state.patches.length}개 명령 대기 · Patch를 눌러 적용하세요.`
            : state.phase === 'comparing'
              ? 'Diff가 VDOM 트리를 비교하고 있어요. 실제 DOM은 유지됩니다.'
              : state.phase === 'draft'
                ? '새 VDOM만 준비됐어요. 비교와 Patch 전까지 실제 DOM은 유지됩니다.'
                : 'State가 바뀌면 컴포넌트가 새 VDOM을 만들어요.';
    get('engine-result').textContent = engineMessage;
    get('engine-reused').textContent = state.evidence?.reused ?? '—';
    get('engine-created').textContent = state.evidence?.created ?? '—';
    get('engine-removed').textContent = state.evidence?.removed ?? '—';
    get('effect-log').textContent = (state.effectLog || ['초기 effect 대기'])
      .slice(-6)
      .join('\n');
    drawTree('old', state.previous);
    drawTree('new', state.next);
    const trace = state.trace || [],
      cursor = state.cursor ?? -1,
      entry = cursor >= 0 ? trace[cursor] : null;
    for (const checked of trace.slice(0, cursor + 1))
      for (const side of ['old', 'new']) {
        const actor = actorAt(
          side,
          side === 'old' ? checked.oldPath : checked.newPath,
        );
        if (actor) actor.button.dataset.change = checked.kind;
      }
    presentPair(
      entry,
      cursor !== previousCursor || previousPhase !== state.phase,
    );
    get('speech').textContent = entry
      ? `${entry.kind === 'same' ? '같네!' : '여긴 달라!'} ${state.speech || entry.label || (entry.kind === 'same' ? '그대로 있어도 돼.' : 'Diff에게 알려주자.')}`
      : state.speech || '두 친구가 차례대로 만나러 와요.';
    get('progress').textContent =
      `${Math.min(trace.length, Math.max(0, cursor + 1))} / ${trace.length} 쌍${state.completed ? ' · 비교 완료' : ''}`;
    get('inspector-speech').textContent = state.completed
      ? `${(state.patches || []).length}개의 변경 명령을 모았어요.`
      : entry?.kind === 'same'
        ? '같은 친구는 적지 않아요.'
        : entry
          ? `${entry.kind} 발견! 두루마리에 적을게요.`
          : '한 쌍씩 비교하고, 다른 부분만 적어요.';
    get('patches').replaceChildren();
    const checkedIndexes = new Set(
      trace.slice(0, cursor + 1).flatMap((entry) => entry.patches || []),
    );
    for (const [index, change] of (state.patches || []).entries()) {
      const collected = state.completed || checkedIndexes.has(index);
      if (!collected) continue;
      const scroll = element(
        doc,
        'span',
        `jv-scroll${collected ? ' jv-collected' : ''}`,
        `${change.type} [${(change.path || []).join(',')}]${change.index != null ? ` → ${change.index}` : ''}`,
      );
      scroll.dataset.patchIndex = index;
      scroll.dataset.collected = String(collected);
      get('patches').append(scroll);
    }
    if (!get('patches').childElementCount)
      get('patches').append(
        element(
          doc,
          'span',
          'jv-no-scroll',
          state.completed
            ? '다 똑같아요! 변경 명령 0개.'
            : '비교하며 변경 명령을 모으는 중…',
        ),
      );
    get('status').textContent =
      `${state.phase === 'applying' ? 'Patch가 변경 명령을 들고 DOM으로 가는 중이에요.' : state.phase === 'dom' ? '① 진짜 DOM을 읽어 친구들을 초대해주세요.' : state.phase === 'read' ? '② 위에서 다음 VDOM의 모습을 골라주세요.' : state.phase === 'draft' ? '③ 비교 시작 또는 걸어보자를 눌러 한 쌍씩 만나게 해주세요.' : state.phase === 'ready' ? '④ 비교 끝! 빛나는 Patch 배달부를 눌러주세요.' : state.phase === 'patched' ? '배달 완료. 새 변화를 고르거나 처음부터 다시 해보세요.' : '친구들이 서로 인사하며 같은지 다른지 알아보고 있어요.'}${state.renderCount != null ? ` · 렌더 ${state.renderCount}회 / Memo ${state.memoRuns ?? 0}회` : ''}`;
    if (state.phase === 'applying' && previousPhase !== 'applying') {
      courierAnimation?.cancel();
      const courier = get('patch'),
        source = courier.getBoundingClientRect(),
        target = dom.getBoundingClientRect();
      courierAnimation = animate(
        courier,
        [
          { transform: 'translate(0,0)' },
          {
            transform: `translate(${target.left + target.width / 2 - source.left - source.width / 2}px,${target.top + Math.min(100, target.height / 2) - source.top}px)`,
          },
        ],
        { fill: 'forwards' },
      );
    } else if (state.phase !== 'applying' && courierAnimation) {
      courierAnimation.cancel();
      animations.delete(courierAnimation);
      courierAnimation = null;
    }
    if (state.phase === 'patched' && previousPhase !== 'patched')
      patchTransitions();
    previousPhase = state.phase;
    previousCursor = cursor;
  }
  listen(host, 'click', (event) => {
    const button = event.target.closest('button');
    if (!button || !host.contains(button) || button.disabled) return;
    if (button.dataset.journeyAction)
      callbacks.draft?.(button.dataset.journeyAction);
    else {
      const name = button.dataset.journey;
      if (['read', 'compare', 'next', 'play', 'patch', 'reset'].includes(name))
        callbacks[name]?.();
    }
  });
  listen(get('speed'), 'change', () =>
    callbacks.speed?.(Number(get('speed').value)),
  );
  listen(get('instant-mode'), 'change', () =>
    callbacks.instantMode?.(get('instant-mode').checked),
  );
  listen(doc.defaultView, 'resize', () => {
    if (!state || disposed) return;
    drawTree('old', state.previous);
    drawTree('new', state.next);
  });
  return {
    dom,
    directHost: get('direct-dom'),
    render,
    destroy() {
      disposed = true;
      listeners.forEach((off) => off());
      animations.forEach((animation) => animation.cancel());
      timers.forEach((timer) => clearTimeout(timer));
      animations.clear();
      timers.clear();
      host.replaceChildren();
    },
  };
}
