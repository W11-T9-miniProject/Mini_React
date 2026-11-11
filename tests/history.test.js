import { describe, it, expect } from 'vitest';
import { createHistory } from '../src/history/history.js';
import { h } from '../src/runtime/index.js';
describe('history', () => {
  const state = (value) => h('p', {}, value);
  it('초기 상태와 이동 경계를 처리한다', () => {
    const history = createHistory(state('a'));
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.undo()).toEqual(state('a'));
    expect(history.redo()).toEqual(state('a'));
    history.push(state('b'));
    expect(history.index).toBe(1);
    expect(history.undo()).toEqual(state('a'));
    expect(history.canRedo()).toBe(true);
    expect(history.redo()).toEqual(state('b'));
  });
  it('뒤로 이동 후 저장하면 미래 이력을 제거한다', () => {
    const history = createHistory(state('a'));
    history.push(state('b'));
    history.push(state('c'));
    history.undo();
    history.push(state('d'));
    expect(history.length).toBe(3);
    expect(history.canRedo()).toBe(false);
    expect(history.undo()).toEqual(state('b'));
  });
  it('원본 변이로부터 스냅샷을 보호한다', () => {
    const initial = state('a'),
      history = createHistory(initial);
    initial.children[0].value = 'mutated';
    expect(history.current()).toEqual(state('a'));
    expect(() => {
      history.current().children.push(state('x'));
    }).toThrow();
  });
});
