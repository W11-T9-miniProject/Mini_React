import { afterEach, describe, expect, it } from 'vitest';
import { setupComponentDemo } from '../src/component/demo.js';

const flushMicrotasks = async () => {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
};

function mountDemo() {
  const container = document.createElement('div');
  const effectStatus = document.createElement('p');
  const cleanupStatus = document.createElement('p');
  effectStatus.dataset.testid = 'effect-status';
  cleanupStatus.dataset.testid = 'cleanup-status';
  const instance = setupComponentDemo({
    container,
    effectStatus,
    cleanupStatus,
  });
  return { container, effectStatus, cleanupStatus, instance };
}

describe('Component demo page', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('초기 count와 useMemo 파생값, props를 받는 stateless child를 렌더한다', async () => {
    const { container, effectStatus, cleanupStatus, instance } = mountDemo();
    document.body.append(container, effectStatus, cleanupStatus);

    expect(container.querySelector('[data-count]').textContent).toBe('0');
    expect(container.querySelector('[data-double]').textContent).toBe('0');
    expect(container.querySelector('[data-summary]').textContent).toBe(
      'Count 0, double 0',
    );
    expect(effectStatus.textContent).toBe('');
    expect(cleanupStatus.textContent).toBe('');

    await flushMicrotasks();
    expect(effectStatus.textContent).toBe('Effect: count 0');

    instance.unmount();
  });

  it('native +, −, reset button clicks update state and memoized derived output', async () => {
    const { container, effectStatus, cleanupStatus, instance } = mountDemo();
    document.body.append(container, effectStatus, cleanupStatus);
    await flushMicrotasks();

    container.querySelector('[data-action="increment"]').click();
    await flushMicrotasks();
    expect(container.querySelector('[data-count]').textContent).toBe('1');
    expect(container.querySelector('[data-double]').textContent).toBe('2');
    expect(container.querySelector('[data-summary]').textContent).toBe(
      'Count 1, double 2',
    );
    await flushMicrotasks();
    expect(cleanupStatus.textContent).toBe('Cleanup: count 0');
    expect(effectStatus.textContent).toBe('Effect: count 1');

    container.querySelector('[data-action="increment"]').click();
    await flushMicrotasks();
    expect(container.querySelector('[data-count]').textContent).toBe('2');
    expect(container.querySelector('[data-double]').textContent).toBe('4');
    await flushMicrotasks();

    container.querySelector('[data-action="decrement"]').click();
    await flushMicrotasks();
    expect(container.querySelector('[data-count]').textContent).toBe('1');
    expect(container.querySelector('[data-double]').textContent).toBe('2');
    await flushMicrotasks();

    container.querySelector('[data-action="reset"]').click();
    await flushMicrotasks();
    expect(container.querySelector('[data-count]').textContent).toBe('0');
    expect(container.querySelector('[data-double]').textContent).toBe('0');
    await flushMicrotasks();
    expect(cleanupStatus.textContent).toBe('Cleanup: count 1');
    expect(effectStatus.textContent).toBe('Effect: count 0');

    instance.unmount();
  });

  it('state 변경 중 root와 정적 DOM 참조를 유지한다', async () => {
    const { container, instance } = mountDemo();
    const root = container.querySelector('[data-component-demo-root]');
    const staticNode = root.querySelector('[data-static]');

    container.querySelector('[data-action="increment"]').click();
    await flushMicrotasks();

    expect(container.querySelector('[data-component-demo-root]')).toBe(root);
    expect(root.querySelector('[data-static]')).toBe(staticNode);
    instance.unmount();
  });

  it('unmount는 루트를 제거하고 현재 effect의 cleanup 상태를 기록한다', async () => {
    const { container, effectStatus, cleanupStatus, instance } = mountDemo();
    document.body.append(container, effectStatus, cleanupStatus);
    await flushMicrotasks();
    container.querySelector('[data-action="increment"]').click();
    await flushMicrotasks();

    instance.unmount();

    expect(container.querySelector('[data-component-demo-root]')).toBeNull();
    expect(cleanupStatus.textContent).toBe('Cleanup: count 1');
  });
});
