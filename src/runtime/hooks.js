import { context } from './context.js';
function slot(kind, initialize) {
  const component = context.current;
  if (!component || context.childDepth)
    throw new Error('Hook은 루트 함수형 컴포넌트의 최상위에서만 호출하세요.');
  const index = component.hookIndex++;
  if (!component.hooks[index]) {
    const created = initialize(component);
    created.kind = kind;
    component.hooks[index] = created;
  }
  const hook = component.hooks[index];
  if (hook.kind !== kind) throw new Error('Hook 호출 순서가 변경되었습니다.');
  return [component, hook];
}
function equal(a, b) {
  return (
    a !== undefined &&
    b !== undefined &&
    a.length === b.length &&
    a.every((v, i) => Object.is(v, b[i]))
  );
}
function dependencies(deps) {
  if (deps !== undefined && !Array.isArray(deps))
    throw new TypeError('의존성은 배열이어야 합니다.');
  return deps?.slice();
}

export function useState(initial) {
  const [, hook] = slot('state', (component) => {
    const state = {
      value: typeof initial === 'function' ? initial() : initial,
    };
    state.set = (next) => {
      if (component.disposed) return;
      if (context.current)
        throw new Error('렌더링 중 setState를 호출할 수 없습니다.');
      const value = typeof next === 'function' ? next(state.value) : next;
      if (!Object.is(value, state.value)) {
        state.value = value;
        component.schedule();
      }
    };
    return state;
  });
  return [hook.value, hook.set];
}
export function useMemo(factory, deps) {
  const [component, hook] = slot('memo', () => ({ initialized: false }));
  const next = dependencies(deps);
  if (!hook.initialized || !equal(hook.deps, next)) {
    hook.value = factory();
    hook.deps = next;
    hook.initialized = true;
    component.memoRuns++;
  }
  return hook.value;
}
export function useEffect(effect, deps) {
  if (typeof effect !== 'function')
    throw new TypeError('useEffect의 첫 번째 인자는 함수여야 합니다.');
  const [component, hook] = slot('effect', () => ({
    initialized: false,
    deps: undefined,
    cleanup: undefined,
  }));
  const next = dependencies(deps);
  const changed =
    !hook.initialized || next === undefined || !equal(hook.deps, next);
  if (changed) component.pendingEffects.push({ hook, effect, deps: next });
}
