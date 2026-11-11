import './scene.css';
import { setupComparison } from './comparison.js';

const stages = ['입력', 'VDOM 생성', 'Diff 비교', 'DOM 반영'];
const meanings = {
  INSERT: '새 친구 입장',
  REMOVE: '무대 밖으로 퇴장',
  REPLACE: '친구 교체 · 실제 DOM도 교체',
  TEXT: '새 VDOM 버전 · 실제 DOM 재사용',
  PROPS: '새 VDOM 버전 · 실제 DOM 재사용',
  MOVE: '같은 친구가 가지를 따라 이동',
};
const DURATION = 900;
const pathKey = (path) => path.join('.');
function snapshot(value) {
  if (typeof value === 'function') return '[이벤트 함수]';
  if (Array.isArray(value)) return value.map(snapshot);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, snapshot(item)]),
    );
  return value;
}
function flatten(tree, other) {
  const result = [];
  function visit(node, peer, path, id, parent) {
    if (!node) return;
    result.push({ node, path, id, parent, depth: path.length });
    const children = node.children || [],
      peers = peer?.children || [];
    const keyed = (items) =>
      items.length > 0 &&
      items.every((n) => n.type === 'element' && n.props?.key != null) &&
      new Set(items.map((n) => n.props.key)).size === items.length;
    const useKeys = keyed(children) && (!peer || keyed(peers));
    children.forEach((child, index) => {
      const match = useKeys
        ? peers.find((n) => n.props.key === child.props.key)
        : peers[index];
      const identity = useKeys
        ? `k:${typeof child.props.key}:${encodeURIComponent(child.props.key)}`
        : `i:${index}`;
      visit(
        child,
        match,
        [...path, index],
        `${id}/${identity}:${child.tag || 'text'}`,
        id,
      );
    });
  }
  visit(tree, other, [], tree ? `root:${tree.tag || 'text'}` : '', null);
  return result;
}
function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
// Logical identity follows Diff; an actor identifies a displayed VDOM version.
// TEXT/PROPS hand off versions. MOVE keeps the exact same actor element.
export function setupCharacterScene(scope = document) {
  const host = scope.querySelector('#character-world');
  if (!host) return { record() {}, clearSelection() {}, destroy() {} };
  const doc = host.ownerDocument;
  host.innerHTML = `
    <div class="cw-toolbar"><div><span class="cw-kicker">THE LITTLE NODE FOREST</span><h2>가지 위에 사는 노드 친구들<span>실제 엔진으로 움직이는 한 그루의 트리</span></h2></div><span class="cw-live">● LIVE VDOM</span></div>
    <p class="cw-intro">새 친구는 무대 밖에서 걸어 들어오고, 떠나는 친구는 가지에서 내려가요. 변경된 VDOM은 새 버전으로 인사하고, key가 같은 친구는 자리를 옮겨요.</p>
    <div class="cw-controls"><label>관찰 대상 <select data-cw="source"><option value="all">모든 Phase</option><option value="phase1">Phase 1 · DOM</option><option value="phase2">Phase 2 · Hooks</option></select></label><button type="button" data-cw="back" aria-label="이전 단계">← 이전</button><button type="button" data-cw="play">▶ 재생</button><button type="button" data-cw="step">다음 →</button><label>재생 속도 <select data-cw="speed"><option value="1800">느리게</option><option value="1000" selected>보통</option><option value="450">빠르게</option></select></label><button type="button" data-cw="live">최신 기록 ↗</button></div>
    <div class="cw-stages" data-cw="stages"></div><div class="cw-caption" role="status" aria-live="polite" data-cw="caption"></div>
    <div data-cw="comparison"></div>
    <div class="cw-stage-frame"><div class="cw-stage-label"><span>ONE TREE / ONE LITTLE WORLD</span><span>선을 따라 부모와 자식을 찾아보세요</span></div><div class="cw-stage-viewport" data-cw="viewport"><div class="cw-stage" data-cw="after" role="group" aria-label="노드 캐릭터 트리 무대"><svg data-cw="branches" class="cw-branches" aria-hidden="true"></svg><div class="cw-stage-empty" data-cw="empty">작은 친구들이 곧 찾아와요.<small>위의 변화 실험 버튼을 눌러보세요.</small></div></div></div><div class="cw-ground"><span>↗ 밖에서 입장</span><span>● 요소 친구　◆ 텍스트 친구　─ 부모·자식 가지</span><span>밖으로 퇴장 ↗</span></div><p class="cw-limit" data-cw="limit"></p></div>
    <div class="cw-bottom"><section><h3>이번에 일어난 일</h3><div data-cw="patches" class="cw-patches"></div></section><section><h3>친구에게 물어보기</h3><pre data-cw="detail">캐릭터를 눌러 경로와 속성, 실제 DOM의 대응 요소를 확인하세요.</pre></section></div>
    <details class="cw-data"><summary>변경 전·후 VDOM 데이터 살펴보기</summary><div><pre data-cw="before"></pre><pre data-cw="next-data"></pre></div></details>
    <div class="cw-records"><label for="cw-record">관찰 기록 <span data-cw="count">0 / 32</span></label><select id="cw-record" data-cw="record" aria-label="관찰 기록 선택"></select><p>최근 32개 기록. 재생은 이미 끝난 엔진 실행을 설명하며 실제 DOM을 되돌리지는 않아요. 캐릭터의 새 버전이 등장해도 TEXT·PROPS는 실제 DOM을 재사용해요.</p></div>`;
  const get = (name) => host.querySelector(`[data-cw="${name}"]`);
  const comparison = setupComparison(get('comparison'), {
    onApply() {
      stop();
      stage = 3;
      render();
    },
    onCompare() {
      stop();
      stage = 2;
      render();
    },
    onSelect({ path, side, node }) {
      clearSelection();
      const currentSide = stage === 3 ? 'after' : 'before';
      if (side === currentSide) {
        const actor = [...actors.values()].find(
          (item) => pathKey(item.item.path) === pathKey(path),
        );
        if (actor) {
          selected = actor;
          actor.button.setAttribute('aria-pressed', 'true');
          highlight();
        }
      }
      get('detail').textContent =
        `${side === 'before' ? '이전' : '다음'} VDOM · 경로 [${path.join(', ')}]\n${JSON.stringify(node, null, 2)}\n같은 색으로 표시된 노드와 실제 DOM을 함께 살펴보세요.`;
    },
  });
  const frames = [],
    latest = new Map(),
    actors = new Map(),
    exits = new Set(),
    listeners = [];
  let cursor = -1,
    stage = 3,
    playing = false,
    timer,
    serial = 0,
    actorSerial = 0,
    selected,
    disposed = false,
    drawnStream,
    drawnVersion,
    drawnSignature;
  const overlay = element(doc, 'div', 'cw-dom-outline');
  overlay.hidden = true;
  doc.body.append(overlay);
  function listen(node, event, fn, options) {
    node.addEventListener(event, fn, options);
    listeners.push(() => node.removeEventListener(event, fn, options));
  }
  function reduced() {
    return Boolean(
      doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    );
  }
  function visibleFrames() {
    return frames.filter(
      (frame) =>
        get('source').value === 'all' || get('source').value === frame.source,
    );
  }
  function stop() {
    playing = false;
    clearTimeout(timer);
    get('play').textContent = '▶ 재생';
  }
  function clearSelection() {
    overlay.hidden = true;
    selected = null;
    host
      .querySelectorAll('.cw-actor[aria-pressed="true"]')
      .forEach((node) => node.setAttribute('aria-pressed', 'false'));
  }
  function highlight() {
    overlay.hidden = true;
    if (!selected || host.closest('[hidden]') || stage !== 3) return;
    const frame = frames[cursor],
      live = frame && latest.get(frame.stream || frame.source);
    if (!live || live.id !== frame.id || !live.root?.isConnected) return;
    let node = live.root;
    for (const index of selected.item.path)
      node = Array.from(node?.childNodes || []).filter(
        (child) => child.nodeType === 1 || child.nodeType === 3,
      )[index];
    if (!node?.isConnected) return;
    const rect = (
      node.nodeType === 3 ? node.parentElement : node
    )?.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return;
    Object.assign(overlay.style, {
      left: `${rect.left - 4}px`,
      top: `${rect.top - 4}px`,
      width: `${rect.width + 8}px`,
      height: `${rect.height + 8}px`,
    });
    overlay.hidden = false;
  }
  function select(actor) {
    clearSelection();
    selected = actor;
    actor.button.setAttribute('aria-pressed', 'true');
    comparison.selectPath(actor.item.path, stage === 3 ? 'after' : 'before');
    const item = actor.item,
      frame = frames[cursor];
    const live =
      stage === 3 && latest.get(frame.stream || frame.source)?.id === frame.id;
    get('detail').textContent =
      `${item.node.type === 'text' ? '#text' : `<${item.node.tag}>`} · 경로 [${item.path.join(', ')}]\n${JSON.stringify(item.node.type === 'text' ? { value: item.node.value } : item.node.props, null, 2)}\n\n${live ? '현재 실제 DOM의 대응 요소를 강조합니다. 아래 실습 화면에서도 확인하세요.' : '과거 또는 변경 전 VDOM입니다. 현재 DOM과 직접 연결하지 않습니다.'}`;
    highlight();
  }
  function cancelActor(actor) {
    actor.animation?.cancel();
    clearTimeout(actor.cleanup);
  }
  function removeActor(actor) {
    cancelActor(actor);
    actor.button.remove();
    exits.delete(actor);
  }
  function resetStage() {
    for (const actor of actors.values()) removeActor(actor);
    for (const actor of exits) removeActor(actor);
    actors.clear();
    exits.clear();
    get('branches').replaceChildren();
    drawnVersion = undefined;
    drawnSignature = undefined;
  }
  function layout(items) {
    const byParent = new Map(),
      positions = new Map();
    for (const item of items) {
      if (!byParent.has(item.parent)) byParent.set(item.parent, []);
      byParent.get(item.parent).push(item);
    }
    let leaf = 0;
    function place(item) {
      const children = byParent.get(item.id) || [],
        childX = children.map(place);
      const x = childX.length
        ? (childX[0] + childX.at(-1)) / 2
        : 80 + leaf++ * 136;
      positions.set(item.id, { x, y: 46 + item.depth * 150 });
      return x;
    }
    for (const root of byParent.get(null) || []) place(root);
    const naturalWidth = Math.max(300, leaf * 136 + 24),
      width = Math.max(get('viewport').clientWidth || 700, naturalWidth),
      offset = (width - naturalWidth) / 2;
    for (const position of positions.values()) position.x += offset;
    return {
      positions,
      width,
      height: Math.max(
        360,
        180 + Math.max(0, ...items.map((item) => item.depth)) * 150,
      ),
    };
  }
  function visualPosition(actor) {
    const rect = actor.button.getBoundingClientRect(),
      base = get('after').getBoundingClientRect();
    return rect.width
      ? { x: rect.left - base.left, y: rect.top - base.top }
      : actor.position;
  }
  function travel(actor, from, to, motion) {
    cancelActor(actor);
    actor.position = to;
    actor.button.dataset.motion = motion;
    actor.button.style.left = `${to.x}px`;
    actor.button.style.top = `${to.y}px`;
    if (reduced()) {
      actor.button.dataset.motion = 'still';
      return;
    }
    if (motion !== 'exit')
      actor.cleanup = setTimeout(() => {
        actor.button.dataset.motion = 'still';
        actor.animation?.cancel();
      }, motionDuration());
    if (!actor.button.animate) return;
    actor.animation = actor.button.animate(
      [
        {
          transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)`,
          opacity: motion === 'enter' ? 0 : 1,
        },
        { transform: 'translate(0, 0)', opacity: motion === 'exit' ? 0 : 1 },
      ],
      {
        duration: motionDuration(),
        easing: 'cubic-bezier(.25,.75,.2,1)',
        fill: 'both',
      },
    );
  }
  function motionDuration() {
    return Math.max(350, Number(get('speed').value) * 0.9 || DURATION);
  }
  function exit(actor) {
    const current = visualPosition(actor),
      viewport = get('viewport');
    const right =
      current.x > viewport.scrollLeft + (viewport.clientWidth || 700) / 2;
    const destination = {
      x: right
        ? Math.max(
            viewport.scrollLeft + (viewport.clientWidth || 700) + 180,
            current.x + 240,
          )
        : Math.min(viewport.scrollLeft - 200, current.x - 240),
      y: current.y + 70,
    };
    actor.button.disabled = true;
    actor.button.setAttribute('aria-hidden', 'true');
    actor.button.setAttribute('aria-pressed', 'false');
    actor.button.querySelector('.cw-actor-status').textContent = '잘 있어!';
    exits.add(actor);
    travel(actor, current, destination, 'exit');
    if (reduced()) removeActor(actor);
    else actor.cleanup = setTimeout(() => removeActor(actor), motionDuration());
  }
  function createActor(item, logicalId) {
    const button = element(doc, 'button', 'cw-actor');
    button.type = 'button';
    button.dataset.logicalId = logicalId;
    button.dataset.actorId = `actor-${++actorSerial}`;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML =
      '<span class="cw-creature" aria-hidden="true"><span class="cw-antenna"></span><span class="cw-body"><i class="cw-eye"></i><i class="cw-eye"></i><i class="cw-smile"></i><i class="cw-cheek"></i><i class="cw-cheek"></i></span><span class="cw-arm cw-arm-left"></span><span class="cw-arm cw-arm-right"></span><span class="cw-leg cw-leg-left"></span><span class="cw-leg cw-leg-right"></span></span><span class="cw-speech"><strong></strong><small></small></span><span class="cw-actor-status"></span>';
    const actor = { button, item, position: { x: 0, y: 0 } };
    button.onclick = () => select(actor);
    get('after').append(button);
    return actor;
  }
  function describeActor(actor, item, types) {
    actor.item = item;
    actor.button.className = `cw-actor cw-kind-${item.node.type}${types.includes('MOVE') ? ' cw-moving' : ''}${types.includes('PROPS') ? ' cw-dressed' : ''}`;
    actor.button.dataset.path = pathKey(item.path);
    actor.button.dataset.nodeType = item.node.type;
    actor.button.querySelector('strong').textContent =
      item.node.type === 'text' ? '#text' : `<${item.node.tag}>`;
    const words =
      item.node.type === 'text'
        ? item.node.value.trim() || '␠ 공백'
        : item.node.props?.key != null
          ? `key: ${item.node.props.key}`
          : item.node.props?.class ||
            item.node.props?.className ||
            `자식 ${item.node.children?.length || 0}명`;
    actor.button.querySelector('small').textContent = words;
    actor.button.querySelector('.cw-actor-status').textContent = types.includes(
      'MOVE',
    )
      ? '같은 친구, 새 자리'
      : types.some((type) => type === 'TEXT' || type === 'PROPS')
        ? '새 버전 · 실제 DOM 재사용'
        : types.includes('REPLACE')
          ? '실제 DOM도 교체'
          : types.includes('INSERT')
            ? '안녕, 새 친구!'
            : '';
    actor.button.setAttribute(
      'aria-label',
      `${item.node.type === 'text' ? '텍스트' : item.node.tag} 노드 ${words}, 경로 ${item.path.join('.') || '루트'}`,
    );
  }
  function reconcile(items, peerItems, frame, animate, versionChanges = true) {
    const stream = frame.stream || frame.source,
      { positions, width, height } = layout(items);
    get('after').style.width = `${width}px`;
    get('after').style.height = `${height}px`;
    get('empty').hidden = items.length > 0;
    const previousByPath = new Map(
        peerItems.map((item) => [pathKey(item.path), item]),
      ),
      changes = new Map();
    for (const patch of frame.patches) {
      const old = previousByPath.get(pathKey(patch.path || []));
      if (old && patch.type !== 'INSERT') {
        const types = changes.get(old.id) || [];
        types.push(patch.type);
        changes.set(old.id, types);
      }
    }
    const targets = new Set(items.map((item) => `${stream}|${item.id}`));
    for (const [id, actor] of actors)
      if (!targets.has(id)) {
        actors.delete(id);
        if (animate) exit(actor);
        else removeActor(actor);
      }
    const peerIds = new Set(peerItems.map((item) => item.id));
    for (const item of items) {
      const logicalId = `${stream}|${item.id}`,
        types = versionChanges ? [...(changes.get(item.id) || [])] : [];
      if (!peerIds.has(item.id) && versionChanges) {
        const replacement = frame.patches.some(
          (patch) =>
            patch.type === 'REPLACE' &&
            pathKey(patch.path || []) === pathKey(item.path),
        );
        types.push(replacement ? 'REPLACE' : 'INSERT');
      }
      let actor = actors.get(logicalId);
      const handoff =
        versionChanges &&
        types.some((type) => type === 'TEXT' || type === 'PROPS') &&
        !types.includes('MOVE');
      if (actor && handoff) {
        exit(actor);
        actors.delete(logicalId);
        actor = null;
      }
      const fresh = !actor;
      if (!actor) {
        actor = createActor(item, logicalId);
        actors.set(logicalId, actor);
      }
      const target = {
        x: positions.get(item.id).x - 54,
        y: positions.get(item.id).y,
      };
      const old = fresh
        ? {
            x: get('viewport').scrollLeft - 190 - item.depth * 12,
            y: target.y + 70,
          }
        : visualPosition(actor);
      describeActor(actor, item, types);
      if (
        fresh ||
        Math.abs(old.x - target.x) > 1 ||
        Math.abs(old.y - target.y) > 1
      ) {
        if (animate) travel(actor, old, target, fresh ? 'enter' : 'move');
        else {
          cancelActor(actor);
          actor.position = target;
          actor.button.style.left = `${target.x}px`;
          actor.button.style.top = `${target.y}px`;
          actor.button.dataset.motion = 'still';
        }
      } else actor.button.dataset.motion = types.length ? 'update' : 'still';
    }
    const svg = get('branches');
    svg.replaceChildren();
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    for (const item of items)
      if (item.parent && positions.has(item.parent)) {
        const from = positions.get(item.parent),
          to = positions.get(item.id),
          line = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.dataset.parent = `${stream}|${item.parent}`;
        line.dataset.child = `${stream}|${item.id}`;
        line.setAttribute(
          'd',
          `M ${from.x} ${from.y + 58} C ${from.x} ${from.y + 105}, ${to.x} ${to.y - 36}, ${to.x} ${to.y + 10}`,
        );
        svg.append(line);
      }
  }
  function draw(frame, reset = false) {
    const stream = frame.stream || frame.source,
      before = flatten(frame.previous, frame.next),
      after = flatten(frame.next, frame.previous),
      target = stage === 3 ? after : before,
      version = `${frame.id}:${stage === 3 ? 'next' : 'previous'}`;
    if (version === drawnVersion && !reset) return;
    const previousSignature = JSON.stringify(frame.previous);
    const isActualPrevious =
      drawnStream === stream && drawnSignature === previousSignature;
    if (reset || drawnStream !== stream || (stage === 3 && !isActualPrevious)) {
      resetStage();
      if (stage === 3) reconcile(before.slice(0, 60), [], frame, false, false);
    } else if (stage === 3) {
      // Diff chooses key/index matching for each pair of snapshots. A node
      // already on stage must keep its actor when that matching mode changes
      // (e.g. an empty or partially-keyed list becomes a fully-keyed list).
      const byPath = new Map(before.map((item) => [pathKey(item.path), item]));
      const rebased = new Map();
      for (const [oldId, actor] of actors) {
        const item = byPath.get(pathKey(actor.item.path));
        const id = item ? `${stream}|${item.id}` : oldId;
        actor.button.dataset.logicalId = id;
        rebased.set(id, actor);
      }
      actors.clear();
      for (const [id, actor] of rebased) actors.set(id, actor);
    }
    reconcile(
      target.slice(0, 60),
      stage === 3 ? before : after,
      frame,
      !reduced(),
      stage === 3,
    );
    get('limit').textContent =
      target.length > 60
        ? `전체 ${target.length}개 중 앞의 60개를 표시해요. 아래 Patch 목록과 VDOM 데이터에는 모든 노드가 있어요. 가로·세로로 스크롤할 수 있어요.`
        : '캐릭터를 누르면 실제 DOM과 연결돼요. 넓은 트리는 무대를 가로로 스크롤해 보세요.';
    drawnStream = stream;
    drawnVersion = version;
    drawnSignature = JSON.stringify(stage === 3 ? frame.next : frame.previous);
  }
  function render(reset = false) {
    clearSelection();
    get('record').replaceChildren(
      ...visibleFrames().map((frame) => {
        const option = element(
          doc,
          'option',
          '',
          `#${frame.id} ${frame.source === 'phase2' ? 'Hooks' : 'DOM'} · ${frame.label}`,
        );
        option.value = frame.id;
        option.selected = frames[cursor] === frame;
        return option;
      }),
    );
    get('count').textContent = `${frames.length} / 32`;
    get('stages').replaceChildren(
      ...stages.map((label, index) => {
        const button = element(
          doc,
          'button',
          index === stage ? 'is-active' : index < stage ? 'is-done' : '',
          `${String(index + 1).padStart(2, '0')} ${label}`,
        );
        button.type = 'button';
        button.setAttribute('aria-current', index === stage ? 'step' : 'false');
        button.onclick = () => {
          stop();
          stage = index;
          render();
        };
        return button;
      }),
    );
    const frame = frames[cursor];
    for (const name of ['play', 'step', 'back']) get(name).disabled = !frame;
    if (!frame) {
      comparison.show(null, stage);
      resetStage();
      get('caption').textContent =
        '실습을 시작하면 이곳에 노드 친구들의 트리가 자라나요.';
      get('patches').textContent = '선택한 Phase의 기록이 없어요.';
      return;
    }
    const descriptions = [
      frame.source === 'phase2'
        ? 'State 변경을 같은 microtask로 모으고 컴포넌트를 실행해요.'
        : '편집한 DOM을 읽어 다음 상태를 준비해요.',
      '새 VDOM을 만들었어요. 다음 단계에서 이전 트리와 비교해요.',
      `${frame.patches.length}개의 Patch 발견. 변경 전 경로를 기준으로 다음 자리를 준비해요.`,
      frame.next
        ? '친구들이 제자리를 찾아요. TEXT·PROPS는 새 VDOM 버전끼리 교대하지만 실제 DOM은 재사용해요. REPLACE는 실제 DOM도 교체해요.'
        : 'Unmount 완료. 친구들이 퇴장하고 Effect를 정리해요.',
    ];
    get('caption').textContent =
      `#${frame.id} · ${frame.label} — ${descriptions[stage]}${frame.renderCount != null ? ` · 렌더 ${frame.renderCount}회 / Memo ${frame.memoRuns ?? 0}회` : ''}`;
    host.dataset.stage = String(stage);
    draw(frame, reset);
    comparison.show(frame, stage);
    get('before').textContent =
      `이전 VDOM\n${JSON.stringify(frame.previous, null, 2)}`;
    get('next-data').textContent =
      `다음 VDOM\n${JSON.stringify(frame.next, null, 2)}`;
    get('patches').replaceChildren();
    if (!frame.patches.length)
      get('patches').append(
        element(
          doc,
          'p',
          'cw-empty',
          !frame.previous && frame.next
            ? '첫 Mount · VDOM으로 DOM 생성'
            : !frame.next
              ? 'Unmount · DOM 제거와 Effect cleanup'
              : '변경 없음 · 같은 DOM 유지',
        ),
      );
    for (const patch of frame.patches) {
      const row = element(
        doc,
        'div',
        `cw-patch cw-${patch.type.toLowerCase()}`,
      );
      row.append(
        element(doc, 'b', '', patch.type),
        element(doc, 'span', '', meanings[patch.type] || patch.type),
        element(
          doc,
          'code',
          '',
          `[${(patch.path || []).join(',')}]${patch.index != null ? ` → ${patch.index}` : ''}`,
        ),
      );
      get('patches').append(row);
    }
    get('detail').textContent =
      '캐릭터를 누르면 태그, 경로, 속성을 볼 수 있어요. 선은 부모·자식 관계예요. key가 같은 친구는 자리를 바꾸어도 같은 캐릭터예요.';
  }
  function advance(direction = 1) {
    const options = visibleFrames(),
      current = options.indexOf(frames[cursor]);
    let reset = false;
    if (direction > 0 && stage < 3) stage++;
    else if (direction < 0 && stage > 0) stage--;
    else {
      const next = options[current + direction];
      if (!next) return false;
      cursor = frames.indexOf(next);
      stage = direction > 0 ? 0 : 3;
      reset = true;
    }
    render(reset);
    return true;
  }
  function tick() {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(
      () => {
        if (!advance()) stop();
        else tick();
      },
      Number(get('speed').value),
    );
  }
  listen(get('play'), 'click', () => {
    if (playing) {
      stop();
      return;
    }
    if (stage === 3 && frames[cursor] === visibleFrames().at(-1)) stage = 0;
    playing = true;
    get('play').textContent = 'Ⅱ 일시정지';
    render(true);
    tick();
  });
  listen(get('step'), 'click', () => {
    stop();
    advance();
  });
  listen(get('back'), 'click', () => {
    stop();
    advance(-1);
  });
  listen(get('speed'), 'change', tick);
  listen(get('source'), 'change', () => {
    stop();
    cursor = frames.indexOf(visibleFrames().at(-1));
    stage = 3;
    render(true);
  });
  listen(get('record'), 'change', () => {
    stop();
    cursor = frames.findIndex(
      (frame) => String(frame.id) === get('record').value,
    );
    stage = 0;
    render(true);
  });
  listen(get('live'), 'click', () => {
    stop();
    cursor = frames.indexOf(visibleFrames().at(-1));
    stage = 3;
    render(true);
  });
  if (doc.defaultView) {
    listen(doc.defaultView, 'resize', highlight);
    listen(doc.defaultView, 'scroll', highlight, true);
  }
  const viewNav = scope.querySelector('.view-nav');
  if (viewNav) listen(viewNav, 'click', clearSelection);
  render();
  return {
    clearSelection,
    record(input) {
      if (disposed) return;
      const wasLatest = cursor < 0 || frames[cursor] === visibleFrames().at(-1);
      const frame = {
        ...snapshot({
          source: input.source,
          stream: input.stream,
          label: input.label || '상태 변경',
          previous: input.previous || null,
          next: input.next || null,
          patches: input.patches || [],
          renderCount: input.renderCount,
          memoRuns: input.memoRuns,
        }),
        id: ++serial,
      };
      latest.set(frame.stream || frame.source, {
        id: frame.id,
        root: input.root,
      });
      const currentId = frames[cursor]?.id;
      frames.push(frame);
      if (frames.length > 32) frames.shift();
      cursor = frames.findIndex((item) => item.id === currentId);
      if (input.follow) {
        stop();
        if (
          get('source').value !== 'all' &&
          get('source').value !== frame.source
        )
          get('source').value = frame.source;
        cursor = frames.indexOf(frame);
        stage = 3;
      } else {
        const matches =
          get('source').value === 'all' || get('source').value === frame.source;
        if ((wasLatest && !playing && matches) || cursor < 0) {
          cursor = frames.indexOf(visibleFrames().at(-1));
          stage = 3;
        }
      }
      render();
    },
    destroy() {
      disposed = true;
      stop();
      listeners.forEach((off) => off());
      resetStage();
      comparison.destroy();
      latest.clear();
      frames.length = 0;
      overlay.remove();
      host.replaceChildren();
    },
  };
}
