import { context } from './context.js';
import { render } from '../vdom/render.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';

export class FunctionComponent {
  constructor(component, props = {}) {
    this.component = component;
    this.props = props;
    this.hooks = [];
    this.hookIndex = 0;
    this.renderCount = 0;
    this.memoRuns = 0;
    this.pendingEffects = [];
    this.disposed = false;
    this.scheduled = false;
    this.pending = Promise.resolve();
  }
  mount(container) {
    if (this.container || this.disposed)
      throw new Error('이미 mount되었거나 종료된 컴포넌트입니다.');
    this.container = container;
    this.update();
    return this;
  }
  update() {
    if (this.disposed || !this.container) return;
    if (context.current)
      throw new Error('중첩 루트 렌더링은 지원하지 않습니다.');
    const expectedHooks = this.hooks.length;
    this.hookIndex = 0;
    this.pendingEffects = [];
    let next;
    context.current = this;
    try {
      next = this.component(this.props);
      if (!next || !['element', 'text'].includes(next.type))
        throw new Error('컴포넌트는 하나의 VNode를 반환해야 합니다.');
      if (this.renderCount && this.hookIndex !== expectedHooks)
        throw new Error('Hook 개수/호출 순서가 변경되었습니다.');
    } catch (error) {
      this.pendingEffects = [];
      throw error;
    } finally {
      context.current = null;
    }
    const previous = this.vnode ?? null;
    const changes = this.vnode ? diff(this.vnode, next) : [];
    try {
      if (this.vnode) this.root = patch(this.root, changes);
      else {
        this.root = render(next);
        this.container.replaceChildren(this.root);
      }
    } catch (error) {
      this.pendingEffects = [];
      throw error;
    }
    this.vnode = next;
    this.renderCount++;
    this.commitEffects();
    this.onCommit?.({
      previous,
      next,
      root: this.root,
      renderCount: this.renderCount,
      memoRuns: this.memoRuns,
      patches: changes,
    });
  }
  commitEffects() {
    const errors = [];
    const pending = this.pendingEffects;
    this.pendingEffects = [];
    for (const { hook, effect, deps } of pending) {
      if (this.disposed) break;
      hook.initialized = true;
      hook.deps = deps;
      const previousCleanup = hook.cleanup;
      hook.cleanup = undefined;
      if (typeof previousCleanup === 'function') {
        try {
          previousCleanup();
        } catch (error) {
          errors.push(error);
        }
      }
      if (this.disposed) break;
      try {
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          if (!this.disposed && this.hooks.includes(hook))
            hook.cleanup = cleanup;
          else {
            try {
              cleanup();
            } catch (error) {
              errors.push(error);
            }
          }
        }
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) {
      const error = new AggregateError(
        errors,
        'useEffect 실행 중 오류가 발생했습니다.',
      );
      if (this.onError) this.onError(error);
      else console.error(error);
    }
  }
  schedule() {
    if (this.scheduled || this.disposed) return;
    this.scheduled = true;
    this.pending = Promise.resolve().then(() => {
      this.scheduled = false;
      if (!this.disposed) this.update();
    });
    // 브라우저에서도 실패를 조용히 삼키지 않고 데모 상태에 표시한다.
    this.pending.catch((error) => this.onError?.(error));
  }
  async settled() {
    do {
      const pending = this.pending;
      await pending;
      if (pending === this.pending && !this.scheduled) break;
    } while (!this.disposed);
  }
  unmount() {
    if (this.disposed) return;
    this.disposed = true;
    const errors = [];
    for (const hook of this.hooks) {
      if (hook.kind !== 'effect' || typeof hook.cleanup !== 'function')
        continue;
      const cleanup = hook.cleanup;
      hook.cleanup = undefined;
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    this.container?.replaceChildren();
    this.container = null;
    this.vnode = null;
    this.root = null;
    this.hooks = [];
    this.hookIndex = 0;
    this.pendingEffects = [];
    if (errors.length)
      throw new AggregateError(
        errors,
        'useEffect cleanup 중 오류가 발생했습니다.',
      );
  }
}
