import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import { render } from '../vdom/render.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CASES = [
  {
    id: 'small',
    title: '상품 3개 중 하나의 수량 변경',
    count: 3,
    kind: 'list',
    directMode: 'replace',
    description:
      '작은 목록에서 한 상품의 수량을 바꿉니다. 전체 재생성은 작고, VDOM은 새 트리 비교 비용이 상대적으로 크게 느껴질 수 있습니다.',
  },
  {
    id: 'large',
    title: '상품 1,000개 중 하나의 수량 변경',
    count: 1000,
    kind: 'list',
    directMode: 'replace',
    description:
      '큰 목록에서 한 상품만 바꿉니다. 전체 교체는 모든 항목을 다시 만들고, VDOM은 비교 후 바뀐 부분을 Patch합니다.',
  },
  {
    id: 'replace-all',
    title: '목록 구조 전체 교체',
    count: 1000,
    kind: 'structure',
    directMode: 'replace',
    description:
      '기존 ul/li 트리를 새 section/article 트리로 바꿉니다. 재사용할 노드가 거의 없어 VDOM도 새 실제 DOM을 만들어 교체합니다.',
  },
  {
    id: 'known-node',
    title: '수정 위치를 알고 있는 경우',
    count: 1000,
    kind: 'list',
    directMode: 'partial',
    description:
      '바꿀 상품 노드를 이미 알고 있다고 가정합니다. 직접 DOM은 해당 노드의 속성과 글자만 바로 바꾸며, VDOM은 새 트리 생성 후 전체 비교를 거칩니다.',
  },
];

function label(index, quantity) {
  return `상품 ${index + 1} · 수량 ${quantity}개`;
}

function makeVNode(spec, updated) {
  const changed = (index) => updated && index === 0;
  if (spec.kind === 'structure') {
    return {
      type: 'element',
      tag: updated ? 'section' : 'ul',
      props: { class: 'jv-bench-list' },
      children: Array.from({ length: spec.count }, (_, index) => ({
        type: 'element',
        tag: updated ? 'article' : 'li',
        props: { 'data-item': String(index + 1) },
        children: [
          {
            type: 'text',
            value: updated ? `새 항목 ${index + 1}` : label(index, 1),
          },
        ],
      })),
    };
  }
  return {
    type: 'element',
    tag: 'ul',
    props: { class: 'jv-bench-list' },
    children: Array.from({ length: spec.count }, (_, index) => {
      const quantity = changed(index) ? 2 : 1;
      return {
        type: 'element',
        tag: 'li',
        props: { 'data-quantity': String(quantity) },
        children: [{ type: 'text', value: label(index, quantity) }],
      };
    }),
  };
}

function makeDom(vnode) {
  if (vnode.type === 'text') return document.createTextNode(vnode.value);
  const element = document.createElement(vnode.tag);
  for (const [name, value] of Object.entries(vnode.props || {}))
    element.setAttribute(name, String(value));
  for (const child of vnode.children || []) element.append(makeDom(child));
  return element;
}

function elementSet(root) {
  return new Set([root, ...root.querySelectorAll('*')]);
}

function svgNode(name, attributes = {}, text = '') {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes))
    node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  return node;
}

function formatMs(value) {
  return `${value.toFixed(3)} ms`;
}

export function setupPerformanceLab(host) {
  if (!host) return () => {};
  host.innerHTML = `<section class="jv-benchmark" aria-labelledby="jv-benchmark-title">
    <header class="jv-benchmark-heading"><div><p>상황별 성능 비교</p><h2 id="jv-benchmark-title">어떤 경우에 DOM과 VDOM이 유리할까?</h2></div><span>조건을 선택해 직접 실행</span></header>
    <p class="jv-benchmark-intro">같은 업데이트를 세 가지 방식으로 실행합니다. 막대는 이 브라우저에서 방금 측정한 시간이고, 작업량 표와 설명을 함께 보고 유리한 경우를 비교하세요.</p>
    <div class="jv-benchmark-operations" role="group" aria-label="비교 상황">
      ${CASES.map((item, index) => `<button type="button" data-bench-case="${item.id}" aria-pressed="${index === 0}">${item.title}</button>`).join('')}
    </div>
    <p class="jv-benchmark-model" data-bench-description>${CASES[0].description}</p>
    <div class="jv-benchmark-controls"><button type="button" data-bench-run>선택한 조건 측정</button><button type="button" data-bench-clear>결과 초기화</button></div>
    <p class="jv-benchmark-status" data-bench-status role="status" aria-live="polite">비교 상황을 선택하고 측정을 실행하세요.</p>
    <div class="jv-benchmark-chart-wrap"><svg class="jv-benchmark-chart" viewBox="0 0 960 410" role="img" aria-labelledby="jv-benchmark-chart-title jv-benchmark-chart-desc"><title id="jv-benchmark-chart-title">DOM 업데이트 방식별 처리 시간</title><desc id="jv-benchmark-chart-desc">직접 전체 교체, 직접 부분 수정, VDOM Diff와 Patch의 처리 시간을 선택한 조건에서 비교합니다.</desc><g data-bench-plot></g></svg></div>
    <div class="jv-benchmark-legend"><span><i class="jv-bench-dot jv-bench-direct"></i>직접 DOM 전체 교체</span><span><i class="jv-bench-dot jv-bench-partial"></i>직접 DOM 부분 수정</span><span><i class="jv-bench-dot jv-bench-vdom"></i>VDOM Diff + Patch</span></div>
    <div class="jv-benchmark-results" data-bench-results><p>아직 측정 결과가 없습니다.</p></div>
    <p class="jv-benchmark-note">다음 VDOM과 시작 화면은 측정 전에 준비합니다. 타이머에는 각 방식의 DOM 작업만 포함되고, 변경량 집계는 타이머 밖에서 합니다. 직접 부분 수정은 대상 DOM 노드를 미리 알고 있는 조건입니다. DOM은 문서에 연결하지 않아 Layout·Paint는 측정하지 않습니다. 짧은 작업의 단일 측정값은 브라우저 상태에 따라 달라질 수 있으므로, 시간만으로 일반적인 우열을 단정하지 말고 실제 변경량과 함께 보세요.</p>
  </section>`;

  const plot = host.querySelector('[data-bench-plot]');
  const status = host.querySelector('[data-bench-status]');
  const results = host.querySelector('[data-bench-results]');
  const description = host.querySelector('[data-bench-description]');
  let selected = CASES[0];
  let runCount = 0;

  function draw(times = null, metrics = null, patchTypes = []) {
    plot.replaceChildren();
    if (!times) {
      plot.append(
        svgNode(
          'text',
          { x: 480, y: 205, 'text-anchor': 'middle', class: 'jv-bench-empty' },
          '조건을 측정하면 막대그래프가 표시됩니다',
        ),
      );
      results.replaceChildren(
        Object.assign(document.createElement('p'), {
          textContent: '아직 측정 결과가 없습니다.',
        }),
      );
      return;
    }

    const width = 960,
      height = 410,
      left = 92,
      right = 34,
      top = 34,
      bottom = 82;
    const plotWidth = width - left - right,
      plotHeight = height - top - bottom;
    const maxTime = Math.max(...Object.values(times), 0.001),
      yMax = maxTime * 1.25;
    const y = (value) => top + (1 - value / yMax) * plotHeight;
    const baseline = top + plotHeight;
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = (yMax * tick) / 4,
        yPos = y(value);
      plot.append(
        svgNode('line', {
          x1: left,
          x2: width - right,
          y1: yPos,
          y2: yPos,
          class: 'jv-bench-grid',
        }),
      );
      plot.append(
        svgNode(
          'text',
          {
            x: left - 12,
            y: yPos + 5,
            'text-anchor': 'end',
            class: 'jv-bench-axis-label',
          },
          `${value.toFixed(3)} ms`,
        ),
      );
    }
    plot.append(
      svgNode('line', {
        x1: left,
        x2: left,
        y1: top,
        y2: baseline,
        class: 'jv-bench-axis',
      }),
      svgNode('line', {
        x1: left,
        x2: width - right,
        y1: baseline,
        y2: baseline,
        class: 'jv-bench-axis',
      }),
    );
    const bars = [
      { key: 'direct', label: '전체 교체', color: 'direct' },
      { key: 'partial', label: '부분 수정', color: 'partial' },
      { key: 'vdom', label: 'VDOM Diff + Patch', color: 'vdom' },
    ].filter((bar) => Object.hasOwn(times, bar.key));
    bars.forEach((bar, index) => {
      const x = left + (plotWidth * (index + 0.5)) / bars.length;
      const barWidth = 142,
        barHeight = Math.max(2, baseline - y(times[bar.key]));
      const rect = svgNode('rect', {
        x: x - barWidth / 2,
        y: baseline - barHeight,
        width: barWidth,
        height: barHeight,
        rx: 8,
        class: `jv-bench-bar-${bar.color}`,
      });
      rect.append(
        svgNode('title', {}, `${bar.label}: ${formatMs(times[bar.key])}`),
      );
      plot.append(rect);
      plot.append(
        svgNode(
          'text',
          {
            x,
            y: Math.max(top + 20, baseline - barHeight - 10),
            'text-anchor': 'middle',
            class: 'jv-bench-value',
          },
          formatMs(times[bar.key]),
        ),
      );
      plot.append(
        svgNode(
          'text',
          {
            x,
            y: height - 38,
            'text-anchor': 'middle',
            class: 'jv-bench-axis-label',
          },
          bar.label,
        ),
      );
    });
    plot.append(
      svgNode(
        'text',
        {
          x: 22,
          y: top + plotHeight / 2,
          transform: `rotate(-90 22 ${top + plotHeight / 2})`,
          'text-anchor': 'middle',
          class: 'jv-bench-axis-title',
        },
        '처리 시간 (ms)',
      ),
    );

    const table = document.createElement('table');
    table.innerHTML =
      '<thead><tr><th>비교 항목</th><th>직접 DOM 전체 교체</th><th>직접 DOM 부분 수정</th><th>VDOM Diff·Patch</th></tr></thead>';
    const rows = [
      [
        '유지한 기존 Element',
        metrics.direct ? `${metrics.direct.retained}개` : '—',
        metrics.partial ? `${metrics.partial.retained}개` : '—',
        `${metrics.vdom.retained}개`,
      ],
      [
        '새로 생성한 Element',
        metrics.direct ? `${metrics.direct.created}개` : '—',
        metrics.partial ? `${metrics.partial.created}개` : '—',
        `${metrics.vdom.created}개`,
      ],
      [
        '제거한 Element',
        metrics.direct ? `${metrics.direct.removed}개` : '—',
        metrics.partial ? `${metrics.partial.removed}개` : '—',
        `${metrics.vdom.removed}개`,
      ],
      [
        'Diff 변경 명령',
        times.direct ? '해당 없음' : '—',
        times.partial ? '해당 없음' : '—',
        `${patchTypes.length}개${patchTypes.length ? `: ${patchTypes.join(' + ')}` : ''}`,
      ],
      [
        '측정 시간',
        times.direct === undefined ? '—' : formatMs(times.direct),
        times.partial === undefined ? '—' : formatMs(times.partial),
        formatMs(times.vdom),
      ],
    ];
    const body = document.createElement('tbody');
    for (const values of rows) {
      const row = document.createElement('tr');
      for (const value of values) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    }
    table.append(body);
    results.replaceChildren(table);
  }

  function runComparison() {
    const current = selected;
    const previous = makeVNode(current, false);
    const next = makeVNode(current, true);
    const directHost = document.createElement('div');
    directHost.append(makeDom(previous));
    const partialHost = document.createElement('div');
    partialHost.append(makeDom(previous));
    const vdomHost = document.createElement('div');
    let vdomRoot = render(previous);
    vdomHost.append(vdomRoot);
    const directBeforeSet = elementSet(directHost.firstElementChild);
    const partialBeforeSet = elementSet(partialHost.firstElementChild);
    const vdomBeforeSet = elementSet(vdomRoot);
    let knownNode = null;
    if (current.directMode === 'partial')
      knownNode = partialHost.querySelector('li');
    const times = {};
    let changes = [];
    const methods =
      current.directMode === 'partial'
        ? ['partial', 'vdom']
        : ['direct', 'vdom'];
    const sequence = runCount % 2 === 0 ? methods : [...methods].reverse();
    for (const method of sequence) {
      const started = performance.now();
      if (method === 'direct') {
        directHost.replaceChildren(makeDom(next));
      } else if (method === 'partial') {
        knownNode.setAttribute('data-quantity', '2');
        knownNode.firstChild.nodeValue = label(0, 2);
      } else {
        changes = diff(previous, next);
        vdomRoot = patch(vdomRoot, changes);
      }
      times[method] = performance.now() - started;
    }
    runCount += 1;
    const measure = (root, beforeSet) => {
      const afterSet = elementSet(root);
      return {
        retained: [...afterSet].filter((node) => beforeSet.has(node)).length,
        created: [...afterSet].filter((node) => !beforeSet.has(node)).length,
        removed: [...beforeSet].filter((node) => !afterSet.has(node)).length,
      };
    };
    const patchTypes = changes.map((change) => change.type);
    const metrics = {
      direct:
        current.directMode === 'replace'
          ? measure(directHost.firstElementChild, directBeforeSet)
          : null,
      partial:
        current.directMode === 'partial'
          ? measure(partialHost.firstElementChild, partialBeforeSet)
          : null,
      vdom: measure(vdomRoot, vdomBeforeSet),
    };
    draw(times, metrics, patchTypes);
    const lowest = Object.entries(times).sort((a, b) => a[1] - b[1])[0][0];
    const winner = {
      direct: '직접 DOM 전체 교체',
      partial: '직접 DOM 부분 수정',
      vdom: 'VDOM Diff·Patch',
    }[lowest];
    status.textContent = `${current.title} 조건에서 ${winner}의 측정 시간이 가장 짧았습니다. 한 번의 측정 결과이므로 실제 변경량과 함께 해석하세요.`;
  }

  async function onClick(event) {
    const button = event.target.closest('button');
    if (!button || !host.contains(button)) return;
    if (button.matches('[data-bench-case]')) {
      selected =
        CASES.find((item) => item.id === button.dataset.benchCase) || CASES[0];
      host
        .querySelectorAll('[data-bench-case]')
        .forEach((choice) =>
          choice.setAttribute('aria-pressed', String(choice === button)),
        );
      description.textContent = selected.description;
      status.textContent = `선택 조건: ${selected.title}. 실행할 때 측정합니다.`;
      return;
    }
    if (button.matches('[data-bench-clear]')) {
      draw();
      status.textContent = '그래프와 결과를 초기화했습니다.';
      return;
    }
    if (!button.matches('[data-bench-run]')) return;
    button.disabled = true;
    status.textContent = '선택한 조건을 세 방식으로 측정하고 있습니다…';
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      runComparison();
    } catch (error) {
      status.textContent = `비교 중 오류가 발생했습니다: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  }

  host.addEventListener('click', onClick);
  draw();
  return () => {
    host.removeEventListener('click', onClick);
    host.replaceChildren();
  };
}
