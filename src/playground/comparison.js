import { domToVNode } from '../vdom/dom-to-vnode.js';
import { render } from '../vdom/render.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';

export function setupComparison() {
  const tabs = [...document.querySelectorAll('[role="tab"]')].filter(
    (tab) => !tab.disabled,
  );
  function selectTab(selected) {
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden =
        !active;
    }
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
        return;
      event.preventDefault();
      const selected =
        event.key === 'Home'
          ? tabs[0]
          : event.key === 'End'
            ? tabs.at(-1)
            : tabs[
                (tabs.indexOf(tab) +
                  (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) %
                  tabs.length
              ];
      selectTab(selected);
      selected.focus();
    });
  }

  const full = document.querySelector('#full-result');
  const partial = document.querySelector('#partial-result');
  const indexInput = document.querySelector('#compare-index');
  const textInput = document.querySelector('#compare-text');
  const status = document.querySelector('#comparison-status');
  const commands = document.querySelector('#comparison-patches');
  const sizeInput = document.querySelector('#compare-size');
  const highlight = document.querySelector('#comparison-highlight');
  let runCount = 0;
  let scrollTimer;
  const operationInput = document.querySelector('#compare-operation');
  const tagInput = document.querySelector('#compare-tag');

  function updateOperation() {
    indexInput.disabled = ['append', 'remove'].includes(operationInput.value);
    tagInput.disabled = operationInput.value !== 'tag';
    textInput.disabled = operationInput.value === 'remove';
  }

  function showMap(prefix, operations) {
    const map = document.getElementById(`${prefix}-map`);
    const slots = Math.min(100, operations.length);
    const tiles = [];
    for (let slot = 0; slot < slots; slot += 1) {
      const start = Math.floor((slot * operations.length) / slots);
      const end = Math.floor(((slot + 1) * operations.length) / slots);
      const group = operations.slice(start, end);
      const created = group.filter(
        (operation) => operation === 'created',
      ).length;
      const changed = group.filter((operation) => operation === 'text').length;
      const replaced = group.filter(
        (operation) => operation === 'element',
      ).length;
      const removed = group.filter(
        (operation) => operation === 'removed',
      ).length;
      const tile = map.children[slot] || document.createElement('span');
      tile.dataset.operation = created
        ? 'created'
        : removed
          ? 'removed'
          : replaced
            ? 'element'
            : changed
              ? 'text'
              : 'kept';
      tile.title = `${start + 1}~${end}번: 항목 생성 ${created}, 삭제 ${removed}, 내부 요소 교체 ${replaced}, 기존 요소의 글자만 수정 ${changed}`;
      tile.setAttribute('aria-hidden', 'true');
      tiles.push(tile);
    }
    map.replaceChildren(...tiles);
    const perTile = operations.length / slots;
    document.getElementById(`${prefix}-map-unit`).textContent =
      `요약 지도 ${slots}칸 · 한 칸 = ${Number.isInteger(perTile) ? perTile : `${Math.floor(perTile)}~${Math.ceil(perTile)}`}개 문장${operations.includes('removed') ? ' (삭제 위치 포함)' : ''}`;
    map.setAttribute(
      'aria-label',
      `${prefix === 'full' ? '전체 교체' : 'Diff·Patch'}: 항목 생성 ${operations.filter((operation) => operation === 'created').length}개, 삭제 ${operations.filter((operation) => operation === 'removed').length}개, 내부 요소 교체 ${operations.filter((operation) => operation === 'element').length}개, 기존 요소의 글자만 수정 ${operations.filter((operation) => operation === 'text').length}개`,
    );
  }

  function reset() {
    clearTimeout(scrollTimer);
    runCount = 0;
    const size = Number(sizeInput.value);
    const list = document.createElement('ul');
    for (let index = 1; index <= size; index += 1) {
      const item = document.createElement('li');
      item.textContent = `문장 ${index}`;
      if (index === 1) {
        const memo = document.createElement('input');
        memo.type = 'text';
        memo.className = 'comparison-memo';
        memo.setAttribute('aria-label', '목록 안의 메모');
        memo.placeholder = '비교 전에 메모를 입력하세요';
        memo.maxLength = 200;
        item.appendChild(memo);
      }
      list.appendChild(item);
    }
    full.replaceChildren(list);
    partial.replaceChildren(render(domToVNode(list)));
    for (const container of [full, partial]) {
      container.querySelector('input').value = '작성 중인 메모';
    }
    indexInput.max = String(size);
    indexInput.value = String(size / 2);
    textInput.value = `수정한 문장 ${size / 2}`;
    operationInput.value = 'text';
    tagInput.value = 'strong';
    updateOperation();
    document.querySelector('#compare-index-label').textContent =
      `바꿀 문장 번호 (1~${size})`;
    document.querySelector('#comparison-map-unit').textContent =
      '색상 지도는 문장 전체를 최대 100칸으로 요약합니다. 문장 수가 바뀌면 한 칸이 뜻하는 문장 수가 바뀝니다. 실제 작업 개수는 각 지도 위 숫자를 확인하세요.';
    for (const prefix of ['full', 'partial']) {
      for (const metric of ['kept', 'created', 'removed']) {
        document.getElementById(`${prefix}-${metric}`).textContent = '—';
      }
      document.getElementById(`${prefix}-time`).textContent = '—';
      for (const metric of ['created', 'removed'])
        document.getElementById(`${prefix}-elements-${metric}`).textContent =
          '—';
      document.getElementById(`${prefix}-work`).textContent =
        '아직 실행하지 않았습니다.';
      document.getElementById(`${prefix}-memo`).textContent = '작성 중인 메모';
      document.getElementById(`${prefix}-map-unit`).textContent =
        `요약 지도 100칸 · 한 칸 = ${size / 100}개 문장`;
      showMap(prefix, Array(size).fill('kept'));
    }
    full.classList.remove('has-run');
    highlight.textContent = '';
    commands.textContent = '[]';
    full.scrollTop = partial.scrollTop = 0;
    status.textContent = `양쪽 모두 문장 1~${size}입니다. 번호와 새 문장을 정한 뒤 비교를 실행하세요.`;
  }

  function showCounts(prefix, before, beforeElements, container) {
    const after = [...container.querySelectorAll('li')];
    const elements = [...container.querySelectorAll('*')];
    const elementSet = new Set(elements);
    const createdElements = elements.filter(
      (node) => !beforeElements.has(node),
    ).length;
    const removedElements = [...beforeElements].filter(
      (node) => !elementSet.has(node),
    ).length;
    document.getElementById(`${prefix}-elements-created`).textContent =
      String(createdElements);
    document.getElementById(`${prefix}-elements-removed`).textContent =
      String(removedElements);
    const oldNodes = new Set(before.keys());
    const newNodes = new Set(after);
    const kept = after.filter((node) => oldNodes.has(node)).length;
    document.getElementById(`${prefix}-kept`).textContent = String(kept);
    document.getElementById(`${prefix}-created`).textContent = String(
      after.length - kept,
    );
    document.getElementById(`${prefix}-removed`).textContent = String(
      [...before.keys()].filter((node) => !newNodes.has(node)).length,
    );
    const operations = after.map((node) =>
      !oldNodes.has(node)
        ? 'created'
        : [...node.children].some((child) => !beforeElements.has(child))
          ? 'element'
          : before.get(node) !== node.textContent
            ? 'text'
            : 'kept',
    );
    for (let index = after.length; index < before.size; index += 1)
      operations.push('removed');
    showMap(prefix, operations);
    const changed = operations.filter(
      (operation) => operation === 'text',
    ).length;
    document.getElementById(`${prefix}-work`).textContent =
      `새 요소 ${createdElements}개 · 제거 ${removedElements}개 · 기존 요소의 글자만 수정 ${changed}개`;
  }

  document.querySelector('#compare-run').addEventListener('click', () => {
    const number = Number(indexInput.value);
    const size = partial.firstChild.children.length;
    const operation = operationInput.value;
    if (
      ['text', 'tag'].includes(operation) &&
      (!Number.isInteger(number) || number < 1 || number > size)
    ) {
      status.textContent = `문장 번호는 1~${size} 사이의 정수로 입력하세요. 화면은 변경하지 않았습니다.`;
      return;
    }
    if (operation === 'append' && size >= 1000) {
      status.textContent =
        '체험 목록은 최대 1,000개입니다. 처음 상태로 돌아가 100개로 시작한 뒤 추가해 보세요.';
      return;
    }
    if (operation === 'remove' && size <= 1) {
      status.textContent = '마지막 항목은 메모 보존 체험을 위해 남겨 둡니다.';
      return;
    }
    const previous = domToVNode(partial.firstChild);
    const next = structuredClone(previous);
    if (operation === 'append') {
      next.children.push({
        type: 'element',
        tag: 'li',
        props: {},
        children: [{ type: 'text', value: textInput.value }],
      });
    } else if (operation === 'remove') {
      next.children.pop();
    } else {
      const item = next.children[number - 1];
      const text = { type: 'text', value: textInput.value };
      if (operation === 'tag') {
        item.children[0] = {
          type: 'element',
          tag: tagInput.value,
          props: {},
          children: [text],
        };
      } else if (item.children[0].type === 'text') {
        item.children[0] = text;
      } else {
        item.children[0].children = [text];
      }
    }
    const oldFull = new Map(
      [...full.querySelectorAll('li')].map((node) => [node, node.textContent]),
    );
    const oldPartial = new Map(
      [...partial.querySelectorAll('li')].map((node) => [
        node,
        node.textContent,
      ]),
    );
    const oldFullElements = new Set(full.querySelectorAll('*'));
    const oldPartialElements = new Set(partial.querySelectorAll('*'));
    let changes;
    const timings = {};
    // 실제로 필요한 두 작업만 한 번씩 수행한다. 실행 순서는 매번 교대한다.
    for (const name of runCount % 2 === 0
      ? ['full', 'partial']
      : ['partial', 'full']) {
      const start = performance.now();
      if (name === 'full') full.replaceChildren(render(next));
      else {
        changes = diff(previous, next);
        patch(partial.firstChild, changes);
      }
      timings[name] = performance.now() - start;
    }
    runCount += 1;
    document.querySelector('#full-time').textContent =
      `${timings.full.toFixed(3)} ms`;
    document.querySelector('#partial-time').textContent =
      `${timings.partial.toFixed(3)} ms`;
    showCounts('full', oldFull, oldFullElements, full);
    showCounts('partial', oldPartial, oldPartialElements, partial);
    commands.textContent = JSON.stringify(changes, null, 2);
    const same = full.innerHTML === partial.innerHTML;
    full.classList.add('has-run');
    const targetIndex = ['append', 'remove'].includes(operation)
      ? next.children.length - 1
      : number - 1;
    indexInput.max = String(next.children.length);
    indexInput.value = String(
      Math.min(Math.max(number, 1), next.children.length),
    );
    document.querySelector('#compare-index-label').textContent =
      `대상 항목 번호 (1~${next.children.length})`;
    highlight.textContent =
      changes.length > 0
        ? `#partial-result li:nth-child(${targetIndex + 1}) { background: var(--changed-soft); border-left-color: var(--changed); }`
        : '';
    const action = {
      text: `${number}번 글자 수정`,
      tag: `${number}번 내부 태그 → ${tagInput.value}`,
      append: '끝에 항목 추가',
      remove: '끝 항목 삭제',
    }[operation];
    status.textContent = `${action} · 현재 ${next.children.length}개 항목 · 목록 글자·HTML 구조 ${same ? '일치' : '불일치'} · Patch 명령 ${changes.length}개.`;
    for (const [prefix, container] of [
      ['full', full],
      ['partial', partial],
    ]) {
      document.getElementById(`${prefix}-memo`).textContent =
        container.querySelector('input').value || '(빈 입력칸)';
    }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      // 스타일 갱신 이후 위치를 모아서 읽고, 스크롤은 그 뒤에 적용한다.
      const positions = [full, partial].map((container) => {
        const items = container.firstElementChild.children;
        const targetTop =
          items[targetIndex].getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop;
        return [
          container,
          Math.max(0, targetTop - items[0].getBoundingClientRect().height - 12),
        ];
      });
      for (const [container, top] of positions) container.scrollTop = top;
    }, 0);
  });
  document.querySelector('#compare-reset').addEventListener('click', reset);
  sizeInput.addEventListener('change', reset);
  operationInput.addEventListener('change', updateOperation);
  reset();
}
