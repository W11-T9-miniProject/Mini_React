import { afterEach, expect, it, vi } from 'vitest';
import {
  FunctionComponent,
  h,
  useEffect,
  useState,
} from '../src/runtime/index.js';

let app;
let container;

afterEach(() => {
  app?.unmount();
  container?.remove();
});

it('새 effect가 cleanup을 반환하지 않으면 이전 cleanup을 unmount에서 반복하지 않는다', async () => {
  container = document.createElement('div');
  document.body.append(container);
  const cleanup = vi.fn();
  const effects = [];
  let set;
  app = new FunctionComponent(() => {
    const [value, setter] = useState(0);
    set = setter;
    useEffect(() => {
      effects.push(container.textContent);
      return value === 0 ? cleanup : undefined;
    }, [value]);
    return h('p', {}, value);
  }).mount(container);

  expect(effects).toEqual(['0']);
  expect(cleanup).not.toHaveBeenCalled();
  set(1);
  await app.settled();
  expect(effects).toEqual(['0', '1']);
  expect(cleanup).toHaveBeenCalledTimes(1);

  app.unmount();
  app.unmount();
  expect(container.childNodes).toHaveLength(0);
  expect(cleanup).toHaveBeenCalledTimes(1);
});
