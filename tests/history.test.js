import { describe, expect, it } from 'vitest';
import { createHistory } from '../src/history/history.js';

const text = (value) => ({ type: 'text', value });

describe('history', () => {
  it('처음과 마지막에서 범위를 벗어나지 않는다', () => {
    const history = createHistory(text('A'));
    expect(history.current()).toEqual(text('A'));
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.undo()).toEqual(text('A'));
    expect(history.redo()).toEqual(text('A'));

    history.push(text('B'));
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
    expect(history.redo()).toEqual(text('B'));
    expect(history.undo()).toEqual(text('A'));
    expect(history.canRedo()).toBe(true);
    expect(history.undo()).toEqual(text('A'));
    expect(history.redo()).toEqual(text('B'));
  });

  it('뒤로 이동 후 저장하면 미래 이력을 제거한다', () => {
    const history = createHistory(text('A'));
    history.push(text('B'));
    history.push(text('C'));
    history.undo();
    history.push(text('D'));

    expect(history.current()).toEqual(text('D'));
    expect(history.canRedo()).toBe(false);
    expect(history.redo()).toEqual(text('D'));
    expect(history.undo()).toEqual(text('B'));
    expect(history.undo()).toEqual(text('A'));
  });

  it('이전 스냅샷을 변경하지 않는다', () => {
    const initial = {
      type: 'element',
      tag: 'p',
      props: { class: 'greeting' },
      children: [text('A')],
    };
    const saved = structuredClone(initial);
    const history = createHistory(initial);
    initial.props.class = '외부 수정';
    initial.children[0].value = '외부 수정';
    expect(history.current()).toEqual(saved);

    const next = text('B');
    history.push(next);
    next.value = '저장 후 수정';
    expect(history.current()).toEqual(text('B'));
    history.current().value = '반환값 수정';
    expect(history.current()).toEqual(text('B'));
    expect(history.undo()).toEqual(saved);
  });
});
