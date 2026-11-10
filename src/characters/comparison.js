import { render } from '../vdom/render.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import './comparison.css';

const key = (path) => path.join('.');
const parsePath = (value) => (value === '' ? [] : value.split('.').map(Number));
const canonicalSide = (side) =>
  side === 'after' || side === 'next' ? 'after' : 'before';
function flat(tree) {
  const nodes = [];
  function visit(node, path, parent) {
    if (!node) return;
    nodes.push({ node, path, parent, depth: path.length });
    (node.children || []).forEach((child, index) =>
      visit(child, [...path, index], key(path)),
    );
  }
  visit(tree, [], null);
  return nodes;
}
function pair(previous, next) {
  const forward = new Map(),
    backward = new Map();
  const keyed = (nodes) =>
    nodes.every((node) => node.props?.key != null) &&
    new Set(nodes.map((node) => node.props.key)).size === nodes.length;
  function visit(a, b, oldPath, newPath) {
    if (!a || !b) return;
    forward.set(key(oldPath), key(newPath));
    backward.set(key(newPath), key(oldPath));
    if (a.type !== b.type || (a.type === 'element' && a.tag !== b.tag)) return;
    if (a.type === 'text') return;
    const ac = a.children || [],
      bc = b.children || [];
    if (keyed(ac) && keyed(bc)) {
      const byKey = new Map(bc.map((node, index) => [node.props.key, index]));
      ac.forEach((node, index) => {
        const target = byKey.get(node.props.key);
        if (target !== undefined)
          visit(node, bc[target], [...oldPath, index], [...newPath, target]);
      });
    } else
      for (let index = 0; index < Math.min(ac.length, bc.length); index++)
        visit(ac[index], bc[index], [...oldPath, index], [...newPath, index]);
  }
  visit(previous, next, [], []);
  return { forward, backward };
}
// Replay uses inert descriptions of nodes; historical event handlers and their
// snapshot labels are never installed on the observation DOM.
function safe(node) {
  if (!node) return null;
  if (node.type === 'text')
    return { type: 'text', value: String(node.value ?? '') };
  return {
    type: 'element',
    tag: node.tag,
    props: Object.fromEntries(
      Object.entries(node.props || {}).filter(
        ([name, value]) => !/^on/i.test(name) && typeof value !== 'function',
      ),
    ),
    children: (node.children || []).map(safe),
  };
}
function referencePaths(root) {
  const paths = new Map();
  function visit(node, path) {
    if (!node) return;
    paths.set(key(path), node);
    Array.from(node.childNodes || [])
      .filter((child) => child.nodeType === 1 || child.nodeType === 3)
      .forEach((child, index) => visit(child, [...path, index]));
  }
  visit(root, []);
  return paths;
}
function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function marksFor(frame, model) {
  const before = new Map(),
    after = new Map();
  const mark = (map, path, type) => {
    if (!map.has(path)) map.set(path, new Set());
    map.get(path).add(type);
  };
  const subtree = (map, nodes, path, type) =>
    nodes.forEach((item) => {
      const itemKey = key(item.path);
      if (itemKey === path || path === '' || itemKey.startsWith(`${path}.`))
        mark(map, itemKey, type);
    });
  for (const change of frame.patches || []) {
    const oldPath = key(change.path || []),
      nextPath = model.forward.get(oldPath);
    if (change.type === 'INSERT') {
      if (nextPath !== undefined)
        subtree(
          after,
          model.after,
          key([...parsePath(nextPath), change.index]),
          'INSERT',
        );
    } else if (change.type === 'REMOVE')
      subtree(before, model.before, oldPath, 'REMOVE');
    else if (change.type === 'REPLACE') {
      subtree(before, model.before, oldPath, 'REPLACE');
      if (nextPath !== undefined)
        subtree(after, model.after, nextPath, 'REPLACE');
    } else {
      mark(before, oldPath, change.type);
      if (nextPath !== undefined) mark(after, nextPath, change.type);
    }
  }
  if (!frame.previous)
    model.after.forEach((item) => mark(after, key(item.path), 'INSERT'));
  if (!frame.next)
    model.before.forEach((item) => mark(before, key(item.path), 'REMOVE'));
  return { before, after };
}
function treePositions(items, minimumWidth) {
  const children = new Map(),
    positions = new Map();
  for (const item of items) {
    if (!children.has(item.parent)) children.set(item.parent, []);
    children.get(item.parent).push(item);
  }
  let leaf = 0;
  function visit(item) {
    const xs = (children.get(key(item.path)) || []).map(visit);
    const x = xs.length ? (xs[0] + xs.at(-1)) / 2 : 40 + leaf++ * 78;
    positions.set(key(item.path), { x, y: 12 + item.depth * 87 });
    return x;
  }
  for (const root of children.get(null) || []) visit(root);
  const natural = Math.max(140, leaf * 78 + 4),
    width = Math.max(minimumWidth || 280, natural);
  for (const point of positions.values()) point.x += (width - natural) / 2;
  return {
    positions,
    width,
    height: Math.max(
      160,
      100 + Math.max(0, ...items.map((item) => item.depth)) * 87,
    ),
  };
}

export function setupComparison(host, { onSelect, onApply, onCompare } = {}) {
  if (!host) return { show() {}, selectPath() {}, destroy() {} };
  const doc = host.ownerDocument;
  host.innerHTML = `<div class="cp-heading"><div><span>COMPARE → DIFF → APPLY</span><h3>두 트리를 비교하고, 바뀐 부분만 DOM으로.</h3></div><button type="button" data-comparison="apply">변경 부분만 실제 DOM에 적용 →</button><button type="button" data-comparison="compare">다시 비교</button></div><div class="cp-board"><section class="cp-column"><header><span>01 / BEFORE</span><h4>이전 VDOM</h4></header><div class="cp-tree-window"><div data-comparison="before" class="cp-tree"></div></div></section><section class="cp-column"><header><span>02 / AFTER</span><h4>다음 VDOM <small>달라진 친구만 색으로</small></h4></header><div class="cp-tree-window"><div data-comparison="after" class="cp-tree"></div></div></section><section class="cp-column cp-real"><header><span>03 / REAL DOM</span><h4>관찰용 실제 DOM</h4><small>같은 엔진으로 재생</small></header><div class="cp-preview" data-comparison="preview"><div class="cp-dom-window"><div data-comparison="dom" inert></div></div><div class="cp-outline" data-comparison="outline" hidden></div></div><p class="cp-stats" data-comparison="stats"></p><p class="cp-evidence" data-comparison="evidence">친구를 골라 같은 DOM 객체인지 확인하세요.</p></section></div><div class="cp-patch-strip" data-comparison="patches"></div><p class="cp-note" data-comparison="note"></p>`;
  const get = (name) => host.querySelector(`[data-comparison="${name}"]`);
  const listeners = [],
    objectIds = new WeakMap();
  let currentFrame,
    model,
    marks,
    stage = 0,
    currentKey,
    applied = false,
    root,
    oldRefs = new Map(),
    newRefs = new Map(),
    selected,
    serial = 0,
    disposed = false;
  const idFor = (node) => {
    if (!node) return '없음';
    if (!objectIds.has(node)) objectIds.set(node, `DOM #${++serial}`);
    return objectIds.get(node);
  };
  function listen(node, event, fn, options) {
    node.addEventListener(event, fn, options);
    listeners.push(() => node.removeEventListener(event, fn, options));
  }
  function seed() {
    root = currentFrame.previous ? render(safe(currentFrame.previous)) : null;
    get('dom').replaceChildren(...(root ? [root] : []));
    oldRefs = referencePaths(root);
    newRefs = new Map();
    applied = false;
  }
  function apply() {
    const previous = safe(currentFrame.previous),
      next = safe(currentFrame.next);
    if (previous && next) root = patch(root, diff(previous, next));
    else if (next) {
      root = render(next);
      get('dom').replaceChildren(root);
    } else {
      root = null;
      get('dom').replaceChildren();
    }
    newRefs = referencePaths(root);
    applied = true;
  }
  function updateStats() {
    const count = (currentFrame.patches || []).length;
    if (!applied) {
      get('stats').textContent =
        `아직 반영 전 · 이전 DOM ${oldRefs.size}개 · 기록된 Patch ${count}개`;
      return;
    }
    const oldNodes = new Set(oldRefs.values()),
      newNodes = new Set(newRefs.values());
    const reused = [...newNodes].filter((node) => oldNodes.has(node)).length;
    get('stats').textContent =
      `기록된 Patch ${count}개 · DOM 재사용 ${reused}개 · 새로 생성 ${newNodes.size - reused}개 · 제거 ${oldNodes.size - reused}개`;
  }
  function updateSelection(notify = false) {
    const outline = get('outline');
    outline.hidden = true;
    host
      .querySelectorAll('.cp-node[aria-pressed="true"]')
      .forEach((node) => node.setAttribute('aria-pressed', 'false'));
    if (!selected || !currentFrame) return;
    const path = key(selected.path),
      oldPath = selected.side === 'before' ? path : model.backward.get(path),
      nextPath = selected.side === 'after' ? path : model.forward.get(path);
    for (const node of host.querySelectorAll('.cp-node'))
      if (
        (node.dataset.side === 'before' && node.dataset.path === oldPath) ||
        (node.dataset.side === 'after' && node.dataset.path === nextPath)
      )
        node.setAttribute('aria-pressed', 'true');
    const oldNode = oldPath === undefined ? null : oldRefs.get(oldPath),
      newNode = nextPath === undefined ? null : newRefs.get(nextPath);
    get('evidence').textContent = applied
      ? `${idFor(oldNode)} → ${idFor(newNode)} · ${oldNode && newNode ? (oldNode === newNode ? '같은 DOM 객체를 재사용했어요.' : '새 DOM 객체로 교체했어요.') : newNode ? '새 DOM 노드가 생겼어요.' : oldNode ? '기존 DOM 노드가 제거됐어요.' : '대응하는 DOM 노드가 없어요.'}`
      : `${idFor(oldNode)} · 아직 반영 전. 다음 VDOM이 준비되어도 DOM은 이전 상태예요.`;
    const targetNode = applied ? newNode : oldNode;
    const target =
      targetNode?.nodeType === 3 ? targetNode.parentElement : targetNode;
    const rect = target?.getBoundingClientRect(),
      base = get('preview').getBoundingClientRect();
    if (rect && (rect.width || rect.height)) {
      Object.assign(outline.style, {
        left: `${rect.left - base.left - 2}px`,
        top: `${rect.top - base.top - 2}px`,
        width: `${rect.width + 4}px`,
        height: `${rect.height + 4}px`,
      });
      outline.hidden = false;
    }
    if (notify) {
      const item = model[selected.side].find(
        (entry) => key(entry.path) === path,
      );
      if (item)
        onSelect?.({
          path: [...selected.path],
          side: selected.side,
          node: item.node,
          previousPath: oldPath === undefined ? null : parsePath(oldPath),
          nextPath: nextPath === undefined ? null : parsePath(nextPath),
        });
    }
  }
  function selectPath(path, side = 'before') {
    if (disposed || !model) return;
    selected = { path: [...path], side: canonicalSide(side) };
    updateSelection(true);
  }
  function drawTree(side) {
    const container = get(side),
      all = model[side],
      items = all.slice(0, 60),
      { positions, width, height } = treePositions(
        items,
        container.parentElement.clientWidth,
      );
    container.replaceChildren();
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    if (!items.length) {
      container.append(
        el(
          doc,
          'p',
          'cp-empty',
          side === 'before' ? '아직 없음 · 첫 Mount' : '없음 · Unmount',
        ),
      );
      return;
    }
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('cp-branches');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('aria-hidden', 'true');
    container.append(svg);
    for (const item of items) {
      const path = key(item.path),
        point = positions.get(path),
        changes = [...(marks[side].get(path) || [])];
      if (item.parent !== null && positions.has(item.parent)) {
        const parent = positions.get(item.parent),
          line = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute(
          'd',
          `M ${parent.x} ${parent.y + 30} C ${parent.x} ${parent.y + 62}, ${point.x} ${point.y - 20}, ${point.x} ${point.y + 5}`,
        );
        svg.append(line);
      }
      const button = el(
        doc,
        'button',
        `cp-node cp-kind-${item.node.type}${changes.length ? ' cp-changed' : ' cp-unchanged'}`,
      );
      button.type = 'button';
      button.dataset.path = path;
      button.dataset.side = side;
      button.dataset.changed = String(changes.length > 0);
      button.dataset.operations = changes.join(' ');
      button.setAttribute('aria-pressed', 'false');
      button.style.left = `${point.x - 34}px`;
      button.style.top = `${point.y}px`;
      const face = el(doc, 'span', 'cp-face');
      face.setAttribute('aria-hidden', 'true');
      face.innerHTML = '<i></i><i></i><b></b>';
      const label = item.node.type === 'text' ? '#text' : `<${item.node.tag}>`,
        value =
          item.node.type === 'text'
            ? item.node.value.trim() || '␠ 공백'
            : item.node.props?.key != null
              ? `key:${item.node.props.key}`
              : item.node.props?.class || item.node.props?.className || '';
      button.append(
        face,
        el(doc, 'strong', '', label),
        el(doc, 'small', '', value),
      );
      if (changes.length)
        button.append(el(doc, 'em', 'cp-badge', changes.join(' · ')));
      button.title = `${label} · 경로 [${item.path.join(',')}]\n${item.node.type === 'text' ? item.node.value : JSON.stringify(item.node.props || {}, null, 2)}`;
      button.setAttribute(
        'aria-label',
        `${side === 'before' ? '이전' : '다음'} ${label} 경로 ${path || '루트'} ${changes.join(' ') || '유지'}`,
      );
      button.onclick = () => selectPath(item.path, side);
      container.append(button);
    }
  }
  function drawPatches() {
    get('patches').replaceChildren();
    if (!(currentFrame.patches || []).length) {
      get('patches').append(
        el(
          doc,
          'span',
          'cp-patch-empty',
          !currentFrame.previous
            ? '첫 생성 · 기존 DOM 없음'
            : !currentFrame.next
              ? 'Unmount · DOM 제거'
              : '차이 없음 · DOM 유지',
        ),
      );
      return;
    }
    (currentFrame.patches || []).forEach((change, index) => {
      const button = el(
        doc,
        'button',
        `cp-patch cp-op-${change.type.toLowerCase()}`,
        `${change.type} [${(change.path || []).join(',')}]${change.index != null ? ` → ${change.index}` : ''}`,
      );
      button.type = 'button';
      button.dataset.patchIndex = index;
      button.onclick = () => {
        if (change.type === 'INSERT') {
          const parent = model.forward.get(key(change.path || []));
          if (parent !== undefined)
            selectPath([...parsePath(parent), change.index], 'after');
        } else selectPath(change.path || [], 'before');
      };
      get('patches').append(button);
    });
  }
  listen(get('apply'), 'click', () =>
    onApply ? onApply() : show(currentFrame, 3),
  );
  listen(get('compare'), 'click', () =>
    onCompare ? onCompare() : show(currentFrame, 2),
  );
  listen(get('dom'), 'submit', (event) => event.preventDefault());
  listen(get('dom'), 'click', (event) => event.preventDefault(), true);
  listen(get('preview'), 'scroll', () => updateSelection(), true);
  if (doc.defaultView)
    listen(doc.defaultView, 'resize', () => updateSelection());
  function show(frame, nextStage = 3) {
    if (disposed) return;
    host.hidden = !frame;
    if (!frame) {
      get('outline').hidden = true;
      return;
    }
    const nextKey = `${frame.stream || frame.source || ''}:${frame.id ?? ''}:${JSON.stringify([frame.previous, frame.next, frame.patches])}`;
    const changedFrame = nextKey !== currentKey;
    currentFrame = frame;
    stage = nextStage;
    if (changedFrame) {
      currentKey = nextKey;
      selected = null;
      model = {
        before: flat(frame.previous),
        after: flat(frame.next),
        ...pair(frame.previous, frame.next),
      };
      marks = marksFor(frame, model);
      seed();
    } else if (stage < 3 && applied) seed();
    if (stage === 3 && !applied) apply();
    drawTree('before');
    drawTree('after');
    drawPatches();
    updateStats();
    get('apply').hidden = stage === 3;
    get('compare').hidden = stage !== 3;
    get('note').textContent =
      `${model.before.length} → ${model.after.length} VDOM 노드 · 색은 기록된 Patch의 대상, 흐린 친구는 유지${Math.max(model.before.length, model.after.length) > 60 ? ' · 각 트리는 앞의 60개 표시' : ''}. Patch 수는 원래 실행 기록이에요. 오른쪽은 같은 엔진으로 재생하며, 이벤트만 바뀐 PROPS는 제외하므로 실제 적용 수와 다를 수 있어요.`;
    if (!selected) {
      get('outline').hidden = true;
      get('evidence').textContent =
        '친구 또는 Patch를 골라 같은 DOM 객체인지 확인하세요.';
    } else updateSelection();
  }
  return {
    show,
    selectPath,
    destroy() {
      disposed = true;
      listeners.forEach((off) => off());
      host.replaceChildren();
      root = null;
      oldRefs.clear();
      newRefs.clear();
    },
  };
}
