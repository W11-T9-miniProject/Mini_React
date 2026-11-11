import { afterEach, describe, it, expect, vi } from 'vitest';
import { h, FunctionComponent } from '../src/runtime/index.js';
import { App } from '../src/demo/app.js';
let app;
afterEach(() => {
  app?.unmount();
  vi.useRealTimers();
});
function start() {
  app = new FunctionComponent(App, { logEffect: vi.fn() }).mount(document.body);
  return app;
}
function input(id, value) {
  const element = document.getElementById(id);
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
describe('Phase 2 할 일 앱 통합', () => {
  it('추가/검색/완료/삭제를 실제 이벤트로 실행한다', async () => {
    start();
    input('task-draft', '새 작업');
    await app.settled();
    const before = app.renderCount;
    document
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await app.settled();
    expect(app.renderCount).toBe(before + 1);
    expect(document.querySelectorAll('.task-item')).toHaveLength(4);
    input('task-search', '새 작업');
    await app.settled();
    expect(document.querySelectorAll('.task-item')).toHaveLength(1);
    const checkbox = document.querySelector('.task-item input');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    await app.settled();
    expect(
      document.querySelector('.task-item').classList.contains('done'),
    ).toBe(true);
    document.querySelector('.task-item button').click();
    await app.settled();
    expect(document.querySelector('.empty-state')).not.toBeNull();
  });
  it('필터를 적용하고 빈 작업을 추가하지 않는다', async () => {
    start();
    input('task-draft', '   ');
    await app.settled();
    document
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await app.settled();
    expect(document.querySelectorAll('.task-item')).toHaveLength(3);
    const select = document.getElementById('task-filter');
    select.value = 'done';
    select.dispatchEvent(new Event('change'));
    await app.settled();
    expect(document.querySelectorAll('.task-item')).toHaveLength(1);
  });
  it('+3은 한 번 렌더하고 타이머는 memo를 다시 계산하지 않는다', async () => {
    vi.useFakeTimers();
    start();
    const memoRuns = app.memoRuns,
      renders = app.renderCount;
    document.getElementById('batch-demo').click();
    await app.settled();
    expect(app.renderCount).toBe(renders + 1);
    expect(app.memoRuns).toBe(memoRuns);
    document.getElementById('timer-toggle').click();
    await app.settled();
    await vi.advanceTimersByTimeAsync(2000);
    await app.settled();
    expect(document.querySelectorAll('.stat-card strong')[2].textContent).toBe(
      '5s',
    );
    expect(app.memoRuns).toBe(memoRuns);
    document.getElementById('timer-toggle').click();
    await app.settled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
