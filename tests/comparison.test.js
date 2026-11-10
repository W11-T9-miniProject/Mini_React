import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupComparison } from '../src/characters/comparison.js';
import { h } from '../src/runtime/index.js';
import { diff } from '../src/vdom/diff.js';
import { render } from '../src/vdom/render.js';

let comparison;
afterEach(() => {
  comparison?.destroy();
  comparison = undefined;
});
const get = (name) => document.querySelector(`[data-comparison="${name}"]`);
const treeNode = (side, path) =>
  get(side).querySelector(`.cp-node[data-path="${path.join('.')}"]`);
function start(options) {
  document.body.innerHTML = '<div id="comparison"></div>';
  comparison = setupComparison(document.getElementById('comparison'), options);
}
function frame(previous, next, extra = {}) {
  return {
    id: 1,
    source: 'phase1',
    stream: 'test',
    previous,
    next,
    patches: previous && next ? diff(previous, next) : [],
    ...extra,
  };
}

describe('이전·다음 VDOM 비교와 실제 DOM 반영', () => {
  it('Patch 선택이 두 VDOM의 대응 노드를 연결하고 선택 정보를 캐릭터 화면에 전달한다', () => {
    const onSelect = vi.fn();
    start({ onSelect });
    const previous = h('p', {}, '이전'),
      next = h('p', {}, '다음');
    comparison.show(frame(previous, next), 2);
    get('patches').querySelector('[data-patch-index="0"]').click();
    expect(treeNode('before', [0]).getAttribute('aria-pressed')).toBe('true');
    expect(treeNode('after', [0]).getAttribute('aria-pressed')).toBe('true');
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        path: [0],
        side: 'before',
        previousPath: [0],
        nextPath: [0],
      }),
    );
  });

  it('반영 전에는 이전 DOM을 유지하고 TEXT·PROPS만 부분 반영하며 동일 단계 재생은 객체를 보존한다', () => {
    start();
    const previous = h(
      'section',
      {},
      h('p', { title: 'before' }, '이전'),
      h('aside', {}, '그대로'),
    );
    const next = h(
      'section',
      {},
      h('p', { title: 'after' }, '다음'),
      h('aside', {}, '그대로'),
    );
    const record = frame(previous, next);
    comparison.show(record, 2);
    const root = get('dom').firstChild,
      paragraph = root.firstChild,
      text = paragraph.firstChild,
      untouched = root.lastChild;
    expect(root.textContent).toBe('이전그대로');
    expect(paragraph.title).toBe('before');
    expect(treeNode('before', [0, 0]).textContent).toContain('이전');
    expect(treeNode('after', [0, 0]).textContent).toContain('다음');
    expect(treeNode('before', [0]).dataset.changed).toBe('true');
    expect(treeNode('after', [0]).dataset.changed).toBe('true');
    expect(treeNode('before', [1]).dataset.changed).toBe('false');
    expect(treeNode('after', [1]).dataset.changed).toBe('false');
    comparison.show(record, 3);
    expect(get('dom').firstChild).toBe(root);
    expect(root.firstChild).toBe(paragraph);
    expect(paragraph.firstChild).toBe(text);
    expect(root.lastChild).toBe(untouched);
    expect(root.textContent).toBe('다음그대로');
    expect(paragraph.title).toBe('after');
    comparison.show(record, 3);
    expect(get('dom').firstChild).toBe(root);
    expect(root.firstChild.firstChild).toBe(text);
  });

  it('key 이동과 텍스트 변경은 이전 경로의 DOM 객체를 새 위치에서 재사용하고 연결 선택도 key를 따른다', () => {
    start();
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
    const record = frame(previous, next);
    comparison.show(record, 2);
    const root = get('dom').firstChild,
      [a, b] = root.children,
      text = a.firstChild;
    comparison.show(record, 3);
    expect([...root.children]).toEqual([b, a]);
    expect(a.firstChild).toBe(text);
    expect(text.nodeValue).toBe('새 A');
    a.getBoundingClientRect = () => ({
      left: 20,
      top: 30,
      width: 100,
      height: 20,
    });
    comparison.selectPath([0], 'before');
    expect(treeNode('before', [0]).getAttribute('aria-pressed')).toBe('true');
    expect(treeNode('after', [1]).getAttribute('aria-pressed')).toBe('true');
    expect(treeNode('after', [0]).getAttribute('aria-pressed')).toBe('false');
    expect(get('outline').hidden).toBe(false);
  });

  it('REPLACE는 해당 객체만 교체하고 형제와 다른 subtree는 보존한다', () => {
    start();
    const previous = h(
      'section',
      {},
      h('h3', {}, '교체'),
      h('p', {}, h('strong', {}, '유지')),
    );
    const next = h(
      'section',
      {},
      h('h2', {}, '새 노드'),
      h('p', {}, h('strong', {}, '유지')),
    );
    const record = frame(previous, next);
    comparison.show(record, 2);
    const root = get('dom').firstChild,
      replaced = root.firstChild,
      preserved = root.lastChild,
      nested = preserved.firstChild;
    comparison.show(record, 3);
    expect(root.firstChild).not.toBe(replaced);
    expect(root.firstChild.tagName).toBe('H2');
    expect(root.lastChild).toBe(preserved);
    expect(preserved.firstChild).toBe(nested);
    expect(root.contains(replaced)).toBe(false);
  });

  it('삭제·삽입 비교는 추가와 제거된 쪽만 선택하며 유지 노드를 재사용한다', () => {
    start();
    const previous = h(
      'ul',
      {},
      h('li', { key: 'a' }, '삭제'),
      h('li', { key: 'b' }, '유지'),
    );
    const next = h(
      'ul',
      {},
      h('li', { key: 'b' }, '유지'),
      h('li', { key: 'c' }, '추가'),
    );
    const record = frame(previous, next);
    comparison.show(record, 2);
    const root = get('dom').firstChild,
      removed = root.firstChild,
      kept = root.lastChild;
    comparison.show(record, 3);
    expect(root.firstChild).toBe(kept);
    expect(root.contains(removed)).toBe(false);
    expect(root.lastChild.textContent).toBe('추가');
    comparison.selectPath([0], 'before');
    expect(treeNode('before', [0]).getAttribute('aria-pressed')).toBe('true');
    expect(get('after').querySelectorAll('[aria-pressed="true"]')).toHaveLength(
      0,
    );
    expect(get('outline').hidden).toBe(true);
    root.lastChild.getBoundingClientRect = () => ({
      left: 20,
      top: 30,
      width: 100,
      height: 20,
    });
    comparison.selectPath([1], 'after');
    expect(treeNode('after', [1]).getAttribute('aria-pressed')).toBe('true');
    expect(
      get('before').querySelectorAll('[aria-pressed="true"]'),
    ).toHaveLength(0);
    expect(get('outline').hidden).toBe(false);
  });

  it('함수와 표시용 이벤트 문자열을 실행·등록하지 않고 원본 VDOM과 앱 DOM을 변경하지 않는다', () => {
    start();
    const handler = vi.fn();
    const previous = h('button', { onClick: handler, title: '이전' }, '이전');
    const next = h(
      'button',
      { onClick: '[이벤트 함수]', onmouseover: '[이벤트 함수]', title: '다음' },
      '다음',
    );
    const original = render(previous);
    document.body.append(original);
    const record = frame(previous, next, { root: original });
    comparison.show(record, 2);
    get('dom').firstChild.click();
    comparison.show(record, 3);
    const mirror = get('dom').firstChild;
    expect(get('dom').inert || get('dom').hasAttribute('inert')).toBe(true);
    mirror.click();
    mirror.dispatchEvent(new Event('mouseover'));
    expect(handler).not.toHaveBeenCalled();
    expect(mirror.getAttribute('onclick')).toBeNull();
    expect(mirror.getAttribute('onmouseover')).toBeNull();
    expect(previous.props.onClick).toBe(handler);
    expect(next.props.onClick).toBe('[이벤트 함수]');
    expect(original.outerHTML).toBe('<button title="이전">이전</button>');
    expect(mirror.outerHTML).toBe('<button title="다음">다음</button>');
    original.click();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('마운트·언마운트와 과거 단계로 이동을 독립된 미리보기에서 처리하고 종료 시 정리한다', () => {
    start();
    const vnode = h('p', {}, '마운트');
    const mount = frame(null, vnode);
    comparison.show(mount, 2);
    expect(get('dom').childNodes).toHaveLength(0);
    comparison.show(mount, 3);
    expect(get('dom').textContent).toBe('마운트');
    const unmount = frame(vnode, null, { id: 2 });
    comparison.show(unmount, 2);
    expect(get('dom').textContent).toBe('마운트');
    comparison.show(unmount, 3);
    expect(get('dom').childNodes).toHaveLength(0);
    comparison.show(mount, 2);
    expect(get('dom').childNodes).toHaveLength(0);
    comparison.show(mount, 3);
    expect(get('dom').textContent).toBe('마운트');
    comparison.destroy();
    comparison = undefined;
    expect(document.getElementById('comparison').childNodes).toHaveLength(0);
  });
});
