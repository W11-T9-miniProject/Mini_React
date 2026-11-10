import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupJourney } from '../src/characters/journey.js';
import { buildDiffTrace } from '../src/characters/diff-trace.js';
import { h } from '../src/runtime/index.js';
import { diff } from '../src/vdom/diff.js';
import { setupJourneyView } from '../src/characters/journey-view.js';

let journey, view;
afterEach(() => {
  journey?.destroy();
  journey = undefined;
  view?.destroy();
  view = undefined;
  vi.useRealTimers();
});
const get = (name) => document.querySelector(`[data-journey="${name}"]`);
const action = (name) =>
  document.querySelector(`[data-journey-action="${name}"]`).click();
function start() {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="journey"></div>';
  journey = setupJourney(document.getElementById('journey'));
}
function draft(name) {
  if (!get('read').disabled) get('read').click();
  action(name);
}
function compareAll(onStep = () => {}) {
  get('compare').click();
  for (let i = 0; i < 500 && !journey.state.completed; i++) {
    onStep();
    expect(get('patch').disabled).toBe(true);
    expect(get('next').disabled).toBe(false);
    get('next').click();
  }
  expect(journey.state.completed).toBe(true);
  expect(get('patch').disabled).toBe(false);
}
function deliver() {
  get('patch').click();
  vi.advanceTimersByTime(1200);
  expect(journey.state.phase).toBe('patched');
}

describe('실제 DOM 읽기 → VDOM 쌍별 Diff → Patch 배달', () => {
  it('읽기·모든 초안 편집·Diff 각 단계는 실제 DOM을 바꾸지 않고 완료 전 Patch를 막는다', () => {
    start();
    const root = journey.root,
      original = root.outerHTML;
    expect(journey.state.phase).toBe('dom');
    expect(journey.state.previous).toBeNull();
    expect(get('patch').disabled).toBe(true);
    get('read').click();
    expect(journey.root).toBe(root);
    expect(root.outerHTML).toBe(original);
    for (const name of [
      'text',
      'props',
      'insert',
      'remove',
      'replace',
      'move',
    ]) {
      action(name);
      expect(journey.root).toBe(root);
      expect(root.outerHTML).toBe(original);
      get('patch').click();
      expect(root.outerHTML).toBe(original);
    }
    compareAll(() => {
      expect(journey.root).toBe(root);
      expect(root.outerHTML).toBe(original);
    });
    expect(root.outerHTML).toBe(original);
    get('patch').click();
    expect(journey.state.phase).toBe('applying');
    expect(root.outerHTML).toBe(original);
    vi.advanceTimersByTime(1200);
    expect(journey.state.phase).toBe('patched');
    expect(journey.root.outerHTML).not.toBe(original);
  });

  it('완료된 TEXT·PROPS·MOVE 배달은 실제 요소와 Text 객체를 부분 재사용한다', () => {
    start();
    const root = journey.root;
    const heading = root.querySelector('h3'),
      text = heading.firstChild;
    const list = root.querySelector('ul'),
      before = [...list.children];
    draft('text');
    action('props');
    action('move');
    const originalText = text.nodeValue,
      originalClass = root.className;
    compareAll();
    deliver();
    expect(journey.root).toBe(root);
    expect(root.querySelector('h3')).toBe(heading);
    expect(heading.firstChild).toBe(text);
    expect(text.nodeValue).not.toBe(originalText);
    expect(root.className).not.toBe(originalClass);
    expect(root.querySelector('ul')).toBe(list);
    expect(list.firstElementChild).toBe(before.at(-1));
    expect(new Set(list.children)).toEqual(new Set(before));
  });

  it('REPLACE 배달은 대상만 교체하고 바뀌지 않은 형제 노드와 subtree를 보존한다', () => {
    start();
    const root = journey.root,
      heading = root.querySelector('h3'),
      list = root.querySelector('ul'),
      item = list.firstChild;
    draft('replace');
    compareAll();
    deliver();
    expect(journey.root).toBe(root);
    expect(root.contains(heading)).toBe(false);
    expect(root.querySelector('h2')).not.toBeNull();
    expect(root.querySelector('ul')).toBe(list);
    expect(list.firstChild).toBe(item);
  });

  it('Patch한 다음 상태가 새 초안의 비교 기준이 되어 이전 변경을 다시 계산하지 않는다', () => {
    start();
    draft('text');
    compareAll();
    deliver();
    const committed = structuredClone(journey.state.next);
    draft('props');
    expect(journey.state.previous).toEqual(committed);
    compareAll();
    expect(journey.state.patches.some((patch) => patch.type === 'TEXT')).toBe(
      false,
    );
    expect(journey.state.patches.some((patch) => patch.type === 'PROPS')).toBe(
      true,
    );
  });

  it('같은 초안은 전체 비교를 마친 뒤 변경 0개로 끝나고 실제 DOM을 유지한다', () => {
    start();
    const root = journey.root,
      children = [...root.childNodes],
      original = root.outerHTML;
    draft('noop');
    compareAll();
    expect(journey.state.patches).toEqual([]);
    deliver();
    expect(journey.root).toBe(root);
    expect([...root.childNodes]).toEqual(children);
    expect(root.outerHTML).toBe(original);
  });

  it('한 번 배달한 삽입 명령은 새 초안 없이 다시 비교·배달되지 않는다', () => {
    start();
    draft('insert');
    compareAll();
    deliver();
    const root = journey.root,
      actual = root.outerHTML,
      nodes = [...root.querySelectorAll('*')];
    expect(get('patch').disabled).toBe(true);
    get('compare').click();
    get('play').click();
    get('patch').click();
    vi.advanceTimersByTime(100000);
    expect(journey.state.phase).toBe('patched');
    expect(journey.root).toBe(root);
    expect(root.outerHTML).toBe(actual);
    expect([...root.querySelectorAll('*')]).toEqual(nodes);
  });

  it('Phase 2의 실제 Hook 배칭은 초안만 만들며 Patch를 누르기 전 메인 DOM에 반영하지 않는다', async () => {
    start();
    const root = journey.root,
      original = root.outerHTML;
    if (!get('read').disabled) get('read').click();
    const before = journey.runtime.renderCount;
    action('batch');
    await journey.runtime.settled();
    expect(journey.runtime.renderCount).toBe(before + 1);
    expect(journey.state.count).toBe(3);
    expect(journey.root).toBe(root);
    expect(root.outerHTML).toBe(original);
    compareAll(() => expect(root.outerHTML).toBe(original));
    expect(root.outerHTML).toBe(original);
    deliver();
    expect(journey.root.outerHTML).not.toBe(original);
  });

  it('재생과 배달 대기 중에도 초기화·종료가 예약 작업을 취소한다', () => {
    start();
    draft('text');
    get('compare').click();
    get('play').click();
    expect(journey.state.playing).toBe(true);
    get('reset').click();
    const resetRoot = journey.root,
      resetHTML = resetRoot.outerHTML;
    vi.advanceTimersByTime(100000);
    expect(journey.state.phase).toBe('dom');
    expect(journey.root).toBe(resetRoot);
    expect(resetRoot.outerHTML).toBe(resetHTML);
    draft('text');
    compareAll();
    get('patch').click();
    expect(journey.state.phase).toBe('applying');
    get('reset').click();
    const cancelledRoot = journey.root;
    vi.advanceTimersByTime(2000);
    expect(journey.root).toBe(cancelledRoot);
    expect(journey.state.phase).toBe('dom');
    draft('text');
    get('compare').click();
    get('play').click();
    journey.destroy();
    journey = undefined;
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
  });

  it('Patch 후 퇴장 중인 캐릭터도 초기화하면 즉시 제거하고 남은 타이머를 취소한다', () => {
    start();
    draft('text');
    action('props');
    compareAll();
    get('patch').click();
    vi.advanceTimersByTime(710);
    expect(journey.state.phase).toBe('patched');
    expect(document.querySelectorAll('.jv-ghost').length).toBeGreaterThan(0);
    get('reset').click();
    expect(journey.state.phase).toBe('dom');
    expect(document.querySelectorAll('.jv-ghost')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(document.querySelectorAll('.jv-ghost')).toHaveLength(0);
  });
});

describe('Diff 수집가의 발견 순서', () => {
  it('방문한 비교가 가리키는 명령만 수집하며 INSERT와 MOVE·PROPS의 모든 명령을 놓치지 않는다', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="view"></div>';
    view = setupJourneyView(document.getElementById('view'));
    const previous = h(
      'ul',
      {},
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'b', title: 'old' }, 'B'),
    );
    const next = h(
      'ul',
      {},
      h('li', { key: 'c' }, 'C'),
      h('li', { key: 'b', title: 'new' }, 'B'),
      h('li', { key: 'a' }, 'A'),
    );
    const patches = diff(previous, next),
      trace = buildDiffTrace(previous, next, patches);
    expect(
      trace.some((entry) => entry.kind === 'INSERT' && entry.oldPath === null),
    ).toBe(true);
    expect(
      trace.some(
        (entry) =>
          entry.kind === 'PROPS' &&
          entry.patches.some((index) => patches[index].type === 'MOVE'),
      ),
    ).toBe(true);
    const state = {
      phase: 'comparing',
      previous,
      next,
      patches,
      trace,
      cursor: -1,
      completed: false,
      playing: false,
      speed: 1000,
      speech: '',
      evidence: null,
    };
    view.render(state);
    expect(document.querySelectorAll('.jv-scroll')).toHaveLength(0);
    const discovered = new Set();
    for (let index = 0; index < trace.length; index++) {
      state.cursor = index;
      state.completed = index === trace.length - 1;
      state.phase = state.completed ? 'ready' : 'comparing';
      trace[index].patches.forEach((patchIndex) => discovered.add(patchIndex));
      view.render(state);
      const scrolls = [...document.querySelectorAll('.jv-scroll')];
      expect(
        new Set(scrolls.map((scroll) => Number(scroll.dataset.patchIndex))),
      ).toEqual(discovered);
      expect(
        scrolls.every((scroll) => scroll.dataset.collected === 'true'),
      ).toBe(true);
    }
    expect(discovered.size).toBe(patches.length);
  });
});

describe('Diff 캐릭터의 실제 비교 순서', () => {
  it('변하지 않은 노드도 방문하고 불완전한 key 목록은 인덱스로 비교하며 입력을 보존한다', () => {
    const previous = h('ul', {}, h('li', { key: 'a' }, 'A'), h('li', {}, 'B'));
    const next = h('ul', {}, h('li', {}, 'B'), h('li', { key: 'a' }, 'A'));
    const snapshot = structuredClone({ previous, next });
    const same = buildDiffTrace(previous, previous, []);
    expect(same).toHaveLength(5);
    expect(same.every((entry) => entry.kind === 'same')).toBe(true);
    const trace = buildDiffTrace(previous, next, diff(previous, next));
    expect(trace.some((entry) => entry.kind === 'MOVE')).toBe(false);
    for (const entry of trace) expect(entry.newPath).toEqual(entry.oldPath);
    expect({ previous, next }).toEqual(snapshot);
  });

  it('고유 key는 이전·다음 경로가 달라도 같은 노드와 그 자식을 대응시킨다', () => {
    const previous = h(
      'ul',
      {},
      h('li', { key: 'a' }, 'A'),
      h('li', { key: 'b' }, 'B'),
    );
    const next = h(
      'ul',
      {},
      h('li', { key: 'b' }, 'B'),
      h('li', { key: 'a' }, '새 A'),
    );
    const patches = diff(previous, next),
      trace = buildDiffTrace(previous, next, patches);
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ oldPath: [0], newPath: [1], kind: 'MOVE' }),
        expect.objectContaining({
          oldPath: [0, 0],
          newPath: [1, 0],
          kind: 'TEXT',
        }),
      ]),
    );
    for (const entry of trace)
      for (const index of entry.patches) expect(patches[index]).toBeDefined();
  });

  it('교체·삽입·삭제 subtree는 뿌리에서 끝내고 존재하지 않는 자식 비교를 만들지 않는다', () => {
    const previous = h('section', {}, h('h3', {}, h('span', {}, '예전')));
    const next = h('section', {}, h('h2', {}, h('strong', {}, '새것')));
    const trace = buildDiffTrace(previous, next, diff(previous, next));
    expect(trace).toHaveLength(2);
    expect(trace[1]).toMatchObject({
      oldPath: [0],
      newPath: [0],
      kind: 'REPLACE',
    });
    const before = h('ul', {}, h('li', { key: 'a' }, h('p', {}, '삭제')));
    const after = h('ul', {}, h('li', { key: 'b' }, h('p', {}, '추가')));
    const changes = buildDiffTrace(before, after, diff(before, after));
    expect(changes.filter((entry) => entry.kind === 'INSERT')).toHaveLength(1);
    expect(changes.filter((entry) => entry.kind === 'REMOVE')).toHaveLength(1);
    expect(
      changes.some(
        (entry) => entry.oldPath?.length > 1 || entry.newPath?.length > 1,
      ),
    ).toBe(false);
  });
});
