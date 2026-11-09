import { render } from '../vdom/render.js';
import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';

let activeComponent = null;
let batchDepth = 0;
const pendingUpdates = new Map();

function flushBatchedUpdates() {
  const errors = [];
  while (pendingUpdates.size) {
    const [owner, saved] = pendingUpdates.entries().next().value;
    pendingUpdates.delete(owner);
    if (!owner.root || owner.hooks !== saved.hooks) continue;
    const version = owner.commitVersion;
    try {
      owner.update();
    } catch (error) {
      // DOM 반영 전의 실패만 복구한다. Effect 오류로 이미 커밋한 상태는 유지한다.
      if (owner.commitVersion === version) {
        for (const [slot, value] of saved.states) slot.value = value;
      }
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1)
    throw new AggregateError(errors, '여러 배칭 갱신이 실패했습니다.');
}

export function batch(callback) {
  if (typeof callback !== 'function')
    throw new TypeError('batch에는 함수를 전달하세요.');
  if (activeComponent)
    throw new Error('렌더 중에는 batch를 실행할 수 없습니다.');
  batchDepth += 1;
  let result;
  const errors = [];
  try {
    result = callback();
  } catch (error) {
    errors.push(error);
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) {
      try {
        flushBatchedUpdates();
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1)
    throw new AggregateError(errors, '배칭 콜백과 갱신이 실패했습니다.');
  return result;
}

export class FunctionComponent {
  constructor(component, container, props = {}) {
    this.component = component;
    this.container = container;
    this.props = props;
    this.hooks = [];
    this.cursor = 0;
    this.root = null;
    this.vnode = null;
    this.patches = [];
    this.pendingEffects = [];
    this.flushingEffects = false;
    this.needsUpdate = false;
    this.commitVersion = 0;
    this.updateDepth = 0;
  }

  createVNode() {
    if (activeComponent)
      throw new Error('컴포넌트 렌더 중 다른 루트를 실행할 수 없습니다.');
    const expectedCount = this.hooks.length;
    this.cursor = 0;
    this.pendingEffects = [];
    activeComponent = this;
    try {
      const vnode = this.component(this.props);
      if (this.root && this.cursor !== expectedCount) {
        throw new Error(
          'Hook 호출 개수가 바뀌었습니다. Hook은 조건문 밖에서 같은 순서로 호출하세요.',
        );
      }
      return vnode;
    } finally {
      activeComponent = null;
    }
  }

  mount() {
    if (this.root) throw new Error('mount()는 한 번만 실행할 수 있습니다.');
    const vnode = this.createVNode();
    this.root = render(vnode);
    this.container.replaceChildren(this.root);
    this.vnode = vnode;
    this.commitVersion += 1;
    this.flushEffects();
  }

  update() {
    if (!this.root) throw new Error('mount() 이후에 update()를 실행하세요.');
    if (this.flushingEffects) {
      this.needsUpdate = true;
      return;
    }
    if (this.updateDepth >= 50)
      throw new Error(
        'Effect의 상태 변경이 계속 반복됩니다. 의존값과 종료 조건을 확인하세요.',
      );
    this.updateDepth += 1;
    this.needsUpdate = false;
    try {
      const next = this.createVNode();
      const changes = diff(this.vnode, next);
      this.root = patch(this.root, changes);
      this.vnode = next;
      this.patches = changes;
      this.commitVersion += 1;
      this.flushEffects();
    } finally {
      this.updateDepth -= 1;
    }
  }

  flushEffects() {
    const jobs = this.pendingEffects;
    this.pendingEffects = [];
    this.flushingEffects = true;
    try {
      for (const { slot, setup, deps } of jobs) {
        const cleanup = slot.cleanup;
        slot.cleanup = undefined;
        cleanup?.();
        slot.deps = deps;
        slot.initialized = true;
        const nextCleanup = setup();
        if (nextCleanup !== undefined && typeof nextCleanup !== 'function') {
          throw new TypeError(
            'Effect는 정리 함수 또는 undefined를 반환해야 합니다.',
          );
        }
        slot.cleanup = nextCleanup;
      }
    } catch (error) {
      this.needsUpdate = false;
      throw error;
    } finally {
      this.flushingEffects = false;
    }
    if (this.needsUpdate) this.update();
  }

  unmount() {
    if (!this.root) return;
    pendingUpdates.delete(this);
    this.root.remove();
    this.root = null;
    this.vnode = null;
    const hooks = this.hooks;
    this.hooks = [];
    this.pendingEffects = [];
    this.patches = [];
    this.needsUpdate = false;
    this.commitVersion += 1;
    let firstError;
    for (const slot of hooks) {
      if (slot.kind !== 'effect') continue;
      try {
        slot.cleanup?.();
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
  }
}

function getHook(kind, initialize) {
  if (!activeComponent)
    throw new Error('Hook은 컴포넌트 실행 중에만 사용할 수 있습니다.');
  const owner = activeComponent;
  const index = owner.cursor++;
  if (!Object.hasOwn(owner.hooks, index)) {
    if (owner.root) throw new Error('Hook 호출 개수가 바뀌었습니다.');
    owner.hooks[index] = initialize();
  }
  const slot = owner.hooks[index];
  if (slot.kind !== kind)
    throw new Error('Hook 호출 종류나 순서가 바뀌었습니다.');
  return [owner, slot, index];
}

export function useState(initialValue) {
  const [owner, slot, index] = getHook('state', () => ({
    kind: 'state',
    value: initialValue,
    setValue: null,
  }));
  if (!slot.setValue) {
    slot.setValue = (nextValue) => {
      if (activeComponent)
        throw new Error('렌더 중에는 상태를 변경할 수 없습니다.');
      if (!owner.root || owner.hooks[index] !== slot)
        throw new Error('이전 마운트의 상태는 변경할 수 없습니다.');
      const previous = slot.value;
      const next =
        typeof nextValue === 'function' ? nextValue(previous) : nextValue;
      if (Object.is(previous, next)) return;
      const deferred = batchDepth > 0 || pendingUpdates.has(owner);
      if (deferred && !pendingUpdates.has(owner)) {
        pendingUpdates.set(owner, {
          hooks: owner.hooks,
          states: owner.hooks
            .filter((hook) => hook.kind === 'state')
            .map((hook) => [hook, hook.value]),
        });
      }
      slot.value = next;
      if (deferred) return;
      const version = owner.commitVersion;
      try {
        owner.update();
      } catch (error) {
        if (owner.commitVersion === version) slot.value = previous;
        throw error;
      }
    };
  }
  return [slot.value, slot.setValue];
}

function copyDependencies(dependencies) {
  if (dependencies !== undefined && !Array.isArray(dependencies))
    throw new TypeError('Hook 의존값은 배열 또는 undefined여야 합니다.');
  return dependencies === undefined ? undefined : [...dependencies];
}

function dependenciesChanged(previous, next) {
  return (
    previous === undefined ||
    next === undefined ||
    previous.length !== next.length ||
    next.some((value, index) => !Object.is(value, previous[index]))
  );
}

export function useEffect(setup, dependencies) {
  const [owner, slot] = getHook('effect', () => ({
    kind: 'effect',
    initialized: false,
    deps: undefined,
    cleanup: undefined,
  }));
  if (typeof setup !== 'function')
    throw new TypeError('Effect의 작업은 함수여야 합니다.');
  const deps = copyDependencies(dependencies);
  const changed = !slot.initialized || dependenciesChanged(slot.deps, deps);
  if (changed) owner.pendingEffects.push({ slot, setup, deps });
}

export function useMemo(calculate, dependencies) {
  const [, slot] = getHook('memo', () => ({
    kind: 'memo',
    initialized: false,
    deps: undefined,
    value: undefined,
  }));
  if (typeof calculate !== 'function')
    throw new TypeError('Memo의 계산은 함수여야 합니다.');
  const deps = copyDependencies(dependencies);
  if (!slot.initialized || dependenciesChanged(slot.deps, deps)) {
    const value = calculate();
    slot.value = value;
    slot.deps = deps;
    slot.initialized = true;
  }
  return slot.value;
}
