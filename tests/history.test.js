import { describe, it, expect } from 'vitest';
import { createHistory } from '../src/history/history.js';

describe('history', () => {
  it('처음과 마지막에서 범위를 벗어나지 않는다', () => {
    const h = createHistory({ type: 'text', value: 'a' });
    expect(h.undo()).toEqual({ type: 'text', value: 'a' });
    h.push({ type: 'text', value: 'b' });
    expect(h.redo()).toEqual({ type: 'text', value: 'b' });
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
  });
  it('뒤로 이동 후 저장하면 미래 이력을 제거하고 스냅샷을 복사한다', () => {
    const h = createHistory({ type: 'text', value: 'a' });
    const b = { type: 'text', value: 'b' };
    h.push(b);
    h.push({ type: 'text', value: 'c' });
    h.undo();
    h.push({ type: 'text', value: 'd' });
    expect(h.canRedo()).toBe(false);
    b.value = 'mutated';
    expect(h.undo()).toEqual({ type: 'text', value: 'b' });
  });

  it('타임라인 조회는 전체 스냅샷 복사본과 현재 위치를 제공한다', () => {
    const h = createHistory({ type: 'text', value: 'a' });
    h.push({ type: 'text', value: 'b' });

    const entries = h.entries();
    expect(entries).toEqual([
      { type: 'text', value: 'a' },
      { type: 'text', value: 'b' },
    ]);
    expect(h.index()).toBe(1);

    entries[0].value = 'external mutation';
    expect(h.entries()[0]).toEqual({ type: 'text', value: 'a' });
    expect(h.index()).toBe(1);
  });

  it('요소 key는 History 스냅샷 복사에서도 유지된다', () => {
    const vnode = {
      type: 'element',
      tag: 'li',
      key: 'row-1',
      props: {},
      children: [],
    };
    const h = createHistory(vnode);
    expect(h.current()).toEqual(vnode);
    expect(h.entries()[0]).toEqual(vnode);
  });

  it('goTo는 유효한 위치로 이동하고 처음/마지막 경계는 고정된다', () => {
    const h = createHistory({ type: 'text', value: 'a' });
    h.push({ type: 'text', value: 'b' });
    h.push({ type: 'text', value: 'c' });

    expect(h.goTo(0)).toEqual({ type: 'text', value: 'a' });
    expect(h.index()).toBe(0);
    expect(h.undo()).toEqual({ type: 'text', value: 'a' });
    expect(h.goTo(2)).toEqual({ type: 'text', value: 'c' });
    expect(h.index()).toBe(2);
    expect(h.redo()).toEqual({ type: 'text', value: 'c' });
  });

  it('goTo는 비정수와 범위 밖 인덱스를 RangeError로 거부한다', () => {
    const h = createHistory({ type: 'text', value: 'a' });

    for (const index of [-1, 0.5, 1, Number.NaN]) {
      expect(() => h.goTo(index)).toThrow(RangeError);
    }
  });
});
