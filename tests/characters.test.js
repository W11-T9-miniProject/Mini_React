import { afterEach, describe, expect, it, vi } from 'vitest';
import html from './fixtures/legacy-page.html?raw';
import { setupApplication } from './fixtures/legacy-application.js';
import { setupCharacterScene } from '../src/characters/scene.js';
import { h } from '../src/runtime/index.js';
import { render } from '../src/vdom/render.js';
import { diff } from '../src/vdom/diff.js';

let application, scene;
afterEach(() => {
  application?.destroy();
  scene?.destroy();
  application = scene = undefined;
  vi.useRealTimers();
});
const get = (selector) => document.querySelector(selector);
const act = (name) => get(`[data-world-action="${name}"]`).click();
const cw = (name) => get(`[data-cw="${name}"]`);
function start() {
  document.body.innerHTML = html.match(
    /<body>([\s\S]*)<script type="module"/,
  )[1];
  application = setupApplication();
}

describe('캐릭터 세계와 실제 엔진 연결', () => {
  it('여섯 변화가 실제 Patch와 DOM에 반영되며 keyed 이동은 DOM 객체를 보존한다', () => {
    start();
    expect(get('#characters').hidden).toBe(false);
    const first = get('#world-dom li');
    for (const [action, kind] of [
      ['text', 'TEXT'],
      ['props', 'PROPS'],
      ['insert', 'INSERT'],
      ['remove', 'REMOVE'],
      ['replace', 'REPLACE'],
      ['move', 'MOVE'],
    ]) {
      act(action);
      expect(cw('patches').textContent).toContain(kind);
    }
    expect(get('#world-dom h2').textContent).toContain('반가워');
    expect(get('#world-dom .accent')).not.toBeNull();
    expect(get('#world-dom li:last-child')).toBe(first);
    const before = [...get('#world-dom').querySelectorAll('*')].map(
      (node) => node.outerHTML,
    );
    cw('back').click();
    cw('play').click();
    expect(
      [...get('#world-dom').querySelectorAll('*')].map(
        (node) => node.outerHTML,
      ),
    ).toEqual(before);
  });

  it('세 setter가 한 렌더로 배칭되고 Undo 후 새 변경은 미래 이력을 버린다', async () => {
    start();
    const before = application.world.runtime.renderCount;
    act('batch');
    await application.world.runtime.settled();
    expect(application.world.runtime.renderCount).toBe(before + 1);
    expect(get('#world-state').textContent).toContain('카운트 3');
    expect(get('#world-state').textContent).toContain('Memo ×2 = 6');
    expect(cw('caption').textContent).toContain('배칭');
    act('text');
    const text = get('#world-dom').textContent;
    act('insert');
    act('undo');
    expect(get('#world-dom').textContent).toBe(text);
    act('props');
    expect(application.world.history.canRedo()).toBe(false);
    const branched = get('#world-dom').innerHTML;
    act('redo');
    expect(get('#world-dom').innerHTML).toBe(branched);
  });

  it('직접 누른 실험은 다른 Phase 필터나 과거 기록 재생 중에도 새 변화를 따라간다', () => {
    start();
    cw('source').value = 'phase2';
    cw('source').dispatchEvent(new Event('change'));
    cw('play').click();
    act('insert');
    expect(cw('source').value).not.toBe('phase2');
    expect(cw('caption').textContent).toContain('INSERT');
    expect(cw('patches').textContent).toContain('INSERT');
    expect(cw('record').selectedIndex).toBe(cw('record').options.length - 1);
    expect(cw('play').textContent).toContain('재생');
    expect(cw('play').textContent).not.toContain('일시정지');
  });

  it('Phase 1 미적용 편집과 잘못된 HTML은 기록하지 않고 적용·이력 이동을 기록한다', () => {
    start();
    const count = () => cw('record').options.length;
    const initial = count();
    const source = get('#html-source');
    source.value = '<p>새 문장</p>';
    source.dispatchEvent(new Event('input'));
    expect(count()).toBe(initial);
    get('#patch-button').click();
    expect(count()).toBe(initial + 1);
    expect(cw('caption').textContent).toContain('HTML 변경 적용');
    get('#undo-button').click();
    expect(count()).toBe(initial + 2);
    source.value = '<script>alert(1)</script>';
    source.dispatchEvent(new Event('input'));
    get('#patch-button').click();
    expect(count()).toBe(initial + 2);
  });

  it('함수 props와 변경 가능한 원본을 표시용 스냅샷으로 보존하고 DOM 속성을 건드리지 않는다', () => {
    document.body.innerHTML =
      '<div id="character-world"></div><div id="live"></div>';
    scene = setupCharacterScene();
    const handler = vi.fn();
    const next = h('button', { onClick: handler, title: '원본' }, '안녕');
    const root = render(next);
    get('#live').append(root);
    scene.record({ source: 'phase2', next, root, patches: [] });
    next.props.title = '변경됨';
    next.children[0].value = '변경됨';
    get('[data-cw="after"] .cw-actor:not([data-motion="exit"])').click();
    expect(cw('detail').textContent).toContain('[이벤트 함수]');
    expect(cw('detail').textContent).toContain('원본');
    expect(cw('after').textContent).toContain('안녕');
    expect(root.outerHTML).toBe('<button title="원본">안녕</button>');
    expect(handler).not.toHaveBeenCalled();
    root.click();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('같은 Phase의 서로 다른 실습은 각자의 최신 실제 DOM 연결을 유지한다', () => {
    document.body.innerHTML =
      '<div id="character-world"></div><div id="roots"></div>';
    scene = setupCharacterScene();
    for (const [stream, left] of [
      ['world-dom', 10],
      ['playground', 200],
    ]) {
      const next = h('p', {}, stream);
      const root = render(next);
      root.getBoundingClientRect = () => ({
        left,
        top: 20,
        width: 100,
        height: 30,
      });
      get('#roots').append(root);
      scene.record({ source: 'phase1', stream, next, root, patches: [] });
    }
    cw('record').selectedIndex = 0;
    cw('record').dispatchEvent(new Event('change'));
    cw('stages').querySelectorAll('button')[3].click();
    get('[data-cw="after"] .cw-actor:not([data-motion="exit"])').click();
    const outline = get('.cw-dom-outline');
    expect(outline.hidden).toBe(false);
    expect(outline.style.left).toBe('6px');
    expect(cw('detail').textContent).toContain('현재 실제 DOM');
    cw('record').selectedIndex = 1;
    cw('record').dispatchEvent(new Event('change'));
    cw('stages').querySelectorAll('button')[3].click();
    get('[data-cw="after"] .cw-actor:not([data-motion="exit"])').click();
    expect(outline.hidden).toBe(false);
    expect(outline.style.left).toBe('196px');
  });

  it('메뉴 이동 시 DOM 강조를 지우고 숨겨진 캐릭터 화면에서 스크롤로 되살리지 않는다', () => {
    start();
    const root = get('#world-dom').firstChild;
    root.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      width: 100,
      height: 30,
    });
    get('[data-cw="after"] .cw-actor:not([data-motion="exit"])').click();
    const outline = get('.cw-dom-outline');
    expect(outline.hidden).toBe(false);
    get('[data-view="phase1"]').click();
    expect(get('#characters').hidden).toBe(true);
    expect(outline.hidden).toBe(true);
    window.dispatchEvent(new Event('scroll'));
    expect(outline.hidden).toBe(true);
    get('[data-view="characters"]').click();
    window.dispatchEvent(new Event('scroll'));
    expect(outline.hidden).toBe(true);
  });

  it('한 트리의 가지를 유지하며 교체할 때 이전 캐릭터가 퇴장하고 새 캐릭터가 입장한다', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="character-world"></div>';
    scene = setupCharacterScene();
    const previous = h('section', {}, h('h3', {}, '원래 친구'));
    scene.record({
      source: 'phase1',
      stream: 'tree',
      next: previous,
      patches: [],
    });
    vi.advanceTimersByTime(1000);
    expect(document.querySelectorAll('[data-cw="after"]')).toHaveLength(1);
    expect(
      document.querySelectorAll('[data-cw="before"] .cw-actor'),
    ).toHaveLength(0);
    const old = get('.cw-actor[data-path="0"]');
    expect(
      cw('branches').querySelectorAll('path[data-parent][data-child]'),
    ).toHaveLength(2);
    const next = h('section', {}, h('h2', {}, '새 친구'));
    scene.record({
      source: 'phase1',
      stream: 'tree',
      previous,
      next,
      patches: diff(previous, next),
    });
    const incoming = get('.cw-actor[data-path="0"][data-motion="enter"]');
    expect(incoming).not.toBeNull();
    expect(incoming).not.toBe(old);
    expect(old.isConnected).toBe(true);
    expect(old.dataset.motion).toBe('exit');
    expect(old.disabled).toBe(true);
    expect(old.getAttribute('aria-hidden')).toBe('true');
    expect(
      cw('branches').querySelectorAll('path[data-parent][data-child]'),
    ).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(old.isConnected).toBe(false);
    expect(incoming.isConnected).toBe(true);
    expect(cw('after').querySelectorAll('[data-motion="exit"]')).toHaveLength(
      0,
    );
  });

  it('keyed 자리 이동은 같은 캐릭터 객체를 이동시키고 삭제·추가는 퇴장·입장으로 구분한다', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="character-world"></div>';
    scene = setupCharacterScene();
    const item = (key) => h('li', { key }, key);
    let previous = h('ul', {}, item('a'), item('b'));
    scene.record({
      source: 'phase1',
      stream: 'tree',
      next: previous,
      patches: [],
    });
    vi.advanceTimersByTime(1000);
    const firstActor = get('.cw-actor[data-path="0"]');
    let next = h('ul', {}, item('b'), item('a'));
    scene.record({
      source: 'phase1',
      stream: 'tree',
      previous,
      next,
      patches: diff(previous, next),
    });
    expect(get('.cw-actor[data-path="1"]:not([data-motion="exit"])')).toBe(
      firstActor,
    );
    expect(firstActor.dataset.motion).toBe('move');
    expect(
      cw('branches').querySelectorAll('path[data-parent][data-child]'),
    ).toHaveLength(4);
    vi.advanceTimersByTime(1000);
    previous = next;
    next = h('ul', {}, item('b'), item('a'), item('c'));
    scene.record({
      source: 'phase1',
      stream: 'tree',
      previous,
      next,
      patches: diff(previous, next),
    });
    const added = get('.cw-actor[data-path="2"][data-motion="enter"]');
    expect(added).not.toBeNull();
    vi.advanceTimersByTime(1000);
    previous = next;
    next = h('ul', {}, item('b'), item('a'));
    scene.record({
      source: 'phase1',
      stream: 'tree',
      previous,
      next,
      patches: diff(previous, next),
    });
    expect(added.dataset.motion).toBe('exit');
    expect(added.isConnected).toBe(true);
    expect(
      cw('branches').querySelectorAll('path[data-parent][data-child]'),
    ).toHaveLength(4);
    scene.destroy();
    scene = undefined;
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(get('#character-world').childNodes).toHaveLength(0);
  });

  it('TEXT와 PROPS는 VDOM 버전 캐릭터를 교대하면서 실제 DOM 객체를 재사용한다', () => {
    vi.useFakeTimers();
    start();
    vi.advanceTimersByTime(1000);
    const nativeRoot = get('#world-dom').firstChild;
    const nativeTitle = get('#world-dom h3');
    const nativeText = nativeTitle.firstChild;
    const oldTextActor = get(
      '.cw-actor[data-path="0.0"]:not([data-motion="exit"])',
    );
    act('text');
    const newTextActor = get(
      '.cw-actor[data-path="0.0"]:not([data-motion="exit"])',
    );
    expect(newTextActor).not.toBe(oldTextActor);
    expect(newTextActor.dataset.logicalId).toBe(oldTextActor.dataset.logicalId);
    expect(oldTextActor.dataset.motion).toBe('exit');
    expect(newTextActor.dataset.motion).toBe('enter');
    expect(get('#world-dom h3')).toBe(nativeTitle);
    expect(nativeTitle.firstChild).toBe(nativeText);
    expect(cw('after').textContent).toContain('실제 DOM 재사용');
    vi.advanceTimersByTime(1000);
    const oldRootActor = get(
      '.cw-actor[data-path=""]:not([data-motion="exit"])',
    );
    act('props');
    const newRootActor = get(
      '.cw-actor[data-path=""]:not([data-motion="exit"])',
    );
    expect(newRootActor).not.toBe(oldRootActor);
    expect(newRootActor.dataset.logicalId).toBe(oldRootActor.dataset.logicalId);
    expect(oldRootActor.dataset.motion).toBe('exit');
    expect(newRootActor.dataset.motion).toBe('enter');
    expect(get('#world-dom').firstChild).toBe(nativeRoot);
    expect(nativeRoot.classList.contains('accent')).toBe(true);
  });

  it('입장은 화면 밖에서 시작하고 퇴장은 밖에서 끝나며 종료 시 애니메이션을 취소한다', () => {
    vi.useFakeTimers();
    const descriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'animate',
    );
    const animations = [];
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: function (keyframes) {
        const animation = { cancel: vi.fn() };
        animations.push({ button: this, keyframes, animation });
        return animation;
      },
    });
    try {
      document.body.innerHTML = '<div id="character-world"></div>';
      scene = setupCharacterScene();
      const previous = h('p', {}, '친구');
      scene.record({
        source: 'phase1',
        stream: 'motion',
        next: previous,
        patches: [],
      });
      const incoming = animations.find(
        ({ button }) => button.dataset.path === '',
      );
      const dx = Number(
        incoming.keyframes[0].transform.match(/translate\(([-\d.]+)px/)[1],
      );
      const startX = Number.parseFloat(incoming.button.style.left) + dx;
      expect(startX < 0 || startX > 700).toBe(true);
      scene.record({
        source: 'phase1',
        stream: 'motion',
        previous,
        next: null,
        patches: [],
      });
      expect(incoming.button.dataset.motion).toBe('exit');
      const endX = Number.parseFloat(incoming.button.style.left);
      expect(endX < 0 || endX > 700).toBe(true);
      scene.destroy();
      scene = undefined;
      expect(animations.length).toBeGreaterThan(0);
      for (const { animation } of animations)
        expect(animation.cancel).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      if (descriptor)
        Object.defineProperty(Element.prototype, 'animate', descriptor);
      else delete Element.prototype.animate;
    }
  });

  it('기록은 32개로 제한되고 재생·필터 변경·종료가 실제 화면을 변경하지 않는다', () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<div id="character-world"></div><p id="live">현재</p>';
    scene = setupCharacterScene();
    for (let i = 0; i < 40; i++)
      scene.record({
        source: i % 2 ? 'phase1' : 'phase2',
        label: '기록 ' + i,
        next: h('p', {}, i),
        patches: [],
        root: get('#live'),
      });
    expect(cw('record').options).toHaveLength(32);
    expect(cw('record').options[0].textContent).toContain('기록 8');
    cw('record').selectedIndex = 0;
    cw('record').dispatchEvent(new Event('change'));
    cw('play').click();
    vi.advanceTimersByTime(2100);
    expect(get('#live').textContent).toBe('현재');
    cw('source').value = 'phase2';
    cw('source').dispatchEvent(new Event('change'));
    expect(cw('record').options).toHaveLength(16);
    cw('play').click();
    scene.destroy();
    expect(document.querySelector('.cw-dom-outline')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(() => {
      vi.runAllTimers();
      scene.record({ next: h('p', {}, '늦은 기록') });
    }).not.toThrow();
    scene = undefined;
    expect(get('#character-world').childNodes).toHaveLength(0);
  });
});
