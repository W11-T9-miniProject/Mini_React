let activeComponent = null;

export function withHooks(component, renderComponent) {
  if (activeComponent !== null) {
    throw new Error(
      '최상위 컴포넌트 렌더 중에는 다른 렌더를 시작할 수 없습니다.',
    );
  }

  component.hookCursor = 0;
  component.pendingEffects = [];
  component.pendingMemos = [];
  activeComponent = component;
  let completed = false;
  try {
    const result = renderComponent();
    completed = true;
    return result;
  } finally {
    activeComponent = null;
    if (completed) {
      const currentCount = component.hookCursor;
      if (component.hookCount === null) {
        component.hookCount = currentCount;
      } else if (component.hookCount !== currentCount) {
        component.pendingEffects = [];
        component.pendingMemos = [];
        throw new Error('Hook은 매 렌더마다 같은 순서로 호출해야 합니다.');
      }
    } else {
      component.pendingEffects = [];
      component.pendingMemos = [];
    }
  }
}

export function withoutHooks(run) {
  const previousComponent = activeComponent;
  activeComponent = null;
  try {
    return run();
  } finally {
    activeComponent = previousComponent;
  }
}

function getHook(kind, create) {
  if (activeComponent === null) {
    throw new Error(
      'Hook은 최상위 컴포넌트를 렌더링할 때만 호출할 수 있습니다.',
    );
  }

  const component = activeComponent;
  const index = component.hookCursor;
  component.hookCursor += 1;
  let hook = component.hooks[index];
  if (!hook) {
    hook = create();
    component.hooks[index] = hook;
  } else if (hook.kind !== kind) {
    throw new Error('Hook 호출 순서가 이전 렌더와 다릅니다.');
  }
  return hook;
}

export function useState(initialValue) {
  const component = activeComponent;
  const hook = getHook('state', () => ({ kind: 'state', value: initialValue }));
  const lifecycleId = component.lifecycleId;
  if (!hook.setValue) {
    hook.setValue = (nextValueOrUpdater) => {
      if (component.isRendering) {
        throw new Error(
          '컴포넌트를 렌더링하는 중에는 state를 바꿀 수 없습니다.',
        );
      }
      if (!component.mounted || component.lifecycleId !== lifecycleId) return;

      const previousValue = hook.value;
      const nextValue =
        typeof nextValueOrUpdater === 'function'
          ? nextValueOrUpdater(previousValue)
          : nextValueOrUpdater;
      if (Object.is(previousValue, nextValue)) return;
      if (!component.pendingStateValues.has(hook)) {
        component.pendingStateValues.set(hook, previousValue);
      }
      hook.value = nextValue;
      component.scheduleUpdate();
    };
  }
  return [hook.value, hook.setValue];
}

function sameDependencies(previous, next) {
  return (
    previous !== undefined &&
    previous.length === next.length &&
    previous.every((value, index) => Object.is(value, next[index]))
  );
}

export function useEffect(effect, dependencies) {
  const hook = getHook('effect', () => ({
    kind: 'effect',
    dependencies: undefined,
    hasCommitted: false,
    effect: null,
    cleanup: null,
  }));
  if (typeof effect !== 'function') {
    throw new TypeError('useEffect의 첫 번째 인자는 함수여야 합니다.');
  }
  if (dependencies !== undefined && !Array.isArray(dependencies)) {
    throw new TypeError('useEffect 의존성은 배열이어야 합니다.');
  }

  const nextDependencies = dependencies?.slice();
  const changed =
    !hook.hasCommitted ||
    dependencies === undefined ||
    !sameDependencies(hook.dependencies, nextDependencies);
  if (changed) {
    activeComponent.pendingEffects.push({
      hook,
      effect,
      dependencies: nextDependencies,
    });
  }
}

export function useMemo(factory, dependencies) {
  const hook = getHook('memo', () => ({
    kind: 'memo',
    dependencies: undefined,
    hasValue: false,
    value: undefined,
  }));
  if (typeof factory !== 'function') {
    throw new TypeError('useMemo의 첫 번째 인자는 함수여야 합니다.');
  }
  if (dependencies !== undefined && !Array.isArray(dependencies)) {
    throw new TypeError('useMemo 의존성은 배열이어야 합니다.');
  }

  const nextDependencies = dependencies?.slice();
  const changed =
    !hook.hasValue ||
    dependencies === undefined ||
    !sameDependencies(hook.dependencies, nextDependencies);
  if (!changed) return hook.value;

  const value = withoutHooks(factory);
  activeComponent.pendingMemos.push({
    hook,
    value,
    dependencies: nextDependencies,
  });
  return value;
}

export function commitEffects(component) {
  for (const pending of component.pendingMemos) {
    pending.hook.value = pending.value;
    pending.hook.dependencies = pending.dependencies;
    pending.hook.hasValue = true;
  }
  component.pendingMemos = [];
  for (const pending of component.pendingEffects) {
    pending.hook.dependencies = pending.dependencies;
    pending.hook.hasCommitted = true;
    component.effectQueue.push({
      ...pending,
      lifecycleId: component.lifecycleId,
    });
  }
  component.pendingEffects = [];
  if (component.effectQueue.length === 0 || component.effectFlushScheduled)
    return;

  component.effectFlushScheduled = true;
  queueMicrotask(() => {
    component.effectFlushScheduled = false;
    if (!component.mounted) {
      component.effectQueue.length = 0;
      return;
    }
    const effects = component.effectQueue.splice(0);
    const errors = [];
    for (const { hook, effect, lifecycleId } of effects) {
      if (!component.mounted || component.lifecycleId !== lifecycleId) break;
      const previousCleanup = hook.cleanup;
      hook.cleanup = null;
      if (typeof previousCleanup === 'function') {
        try {
          previousCleanup();
        } catch (error) {
          errors.push(error);
        }
      }
      if (!component.mounted || component.lifecycleId !== lifecycleId) break;
      try {
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          if (
            component.mounted &&
            component.lifecycleId === lifecycleId &&
            component.hooks.includes(hook)
          ) {
            hook.cleanup = cleanup;
          } else {
            cleanup();
          }
        }
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      console.error(
        new AggregateError(errors, 'useEffect 실행 중 오류가 발생했습니다.'),
      );
  });
}

export function cleanupEffects(component) {
  component.effectQueue.length = 0;
  const errors = [];
  for (const hook of component.hooks) {
    if (hook.kind !== 'effect') continue;
    const cleanup = hook.cleanup;
    hook.cleanup = null;
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length)
    throw new AggregateError(
      errors,
      'useEffect cleanup 중 오류가 발생했습니다.',
    );
}
