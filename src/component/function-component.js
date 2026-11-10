import { diff } from '../vdom/diff.js';
import { patch } from '../vdom/patch.js';
import { render } from '../vdom/render.js';
import { assertVNode } from './create-element.js';
import { cleanupEffects, commitEffects, withHooks } from './hooks.js';

function normalizeProps(props) {
  if (props === null || props === undefined) return {};
  if (typeof props !== 'object' || Array.isArray(props)) {
    throw new TypeError('컴포넌트 props는 객체여야 합니다.');
  }
  return props;
}

export class FunctionComponent {
  constructor(component, initialProps = {}) {
    if (typeof component !== 'function') {
      throw new TypeError('FunctionComponent에는 함수가 필요합니다.');
    }
    this.component = component;
    this.props = normalizeProps(initialProps);
    this.container = null;
    this.vnode = null;
    this.root = null;
    this.mounted = false;
    this.isRendering = false;
    this.hooks = [];
    this.hookCursor = 0;
    this.hookCount = null;
    this.lifecycleId = 0;
    this.pendingEffects = [];
    this.pendingMemos = [];
    this.effectQueue = [];
    this.effectFlushScheduled = false;
    this.updateScheduled = false;
    this.pendingStateValues = new Map();
  }

  renderVNode() {
    if (this.isRendering) {
      throw new Error('컴포넌트를 렌더링하는 중에는 다시 실행할 수 없습니다.');
    }
    this.isRendering = true;
    try {
      return withHooks(this, () => assertVNode(this.component(this.props)));
    } finally {
      this.isRendering = false;
    }
  }

  mount(container) {
    if (this.mounted) {
      throw new Error('컴포넌트 인스턴스는 이미 mount되어 있습니다.');
    }
    if (
      !container ||
      container.nodeType !== Node.ELEMENT_NODE ||
      typeof container.appendChild !== 'function'
    ) {
      throw new TypeError('mount 대상은 DOM Element여야 합니다.');
    }

    let vnode;
    let root;
    try {
      vnode = this.renderVNode();
      root = render(vnode);
      container.appendChild(root);
    } catch (error) {
      this.hooks = [];
      this.hookCursor = 0;
      this.hookCount = null;
      this.pendingMemos = [];
      throw error;
    }
    this.container = container;
    this.vnode = vnode;
    this.root = root;
    this.mounted = true;
    commitEffects(this);
    return root;
  }

  update(nextProps = this.props) {
    if (!this.mounted) {
      throw new Error('mount된 컴포넌트만 update할 수 있습니다.');
    }
    if (this.root.parentNode !== this.container) {
      throw new Error(
        '컴포넌트의 실제 DOM 루트가 mount 위치에서 이동했습니다.',
      );
    }

    const props = normalizeProps(nextProps);
    // A direct update consumes a queued state update so it cannot render twice.
    this.updateScheduled = false;
    const previousProps = this.props;
    this.props = props;
    let nextVNode;
    try {
      nextVNode = this.renderVNode();
    } catch (error) {
      this.props = previousProps;
      this.restorePendingState();
      throw error;
    }

    try {
      this.root = patch(this.root, diff(this.vnode, nextVNode));
    } catch (error) {
      this.props = previousProps;
      this.restorePendingState();
      throw error;
    }
    this.vnode = nextVNode;
    this.pendingStateValues.clear();
    commitEffects(this);
    return this.root;
  }

  scheduleUpdate() {
    if (!this.mounted || this.updateScheduled) return;
    this.updateScheduled = true;
    queueMicrotask(() => {
      if (!this.updateScheduled) return;
      this.updateScheduled = false;
      if (!this.mounted) {
        this.pendingStateValues.clear();
        return;
      }
      if (
        [...this.pendingStateValues].every(([hook, previous]) =>
          Object.is(hook.value, previous),
        )
      ) {
        this.pendingStateValues.clear();
        return;
      }
      try {
        this.update();
      } catch (error) {
        console.error(error);
      }
    });
  }

  restorePendingState() {
    for (const [hook, previous] of this.pendingStateValues) {
      hook.value = previous;
    }
    this.pendingStateValues.clear();
  }

  unmount() {
    if (!this.mounted) return;
    this.mounted = false;
    this.updateScheduled = false;
    this.pendingStateValues.clear();
    this.lifecycleId += 1;
    let cleanupError;
    try {
      cleanupEffects(this);
    } catch (error) {
      cleanupError = error;
    }
    this.root.parentNode?.removeChild(this.root);
    this.container = null;
    this.vnode = null;
    this.root = null;
    this.hooks = [];
    this.hookCount = null;
    this.pendingEffects = [];
    this.pendingMemos = [];
    if (cleanupError) throw cleanupError;
  }
}
