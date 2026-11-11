import { describe, it, expect, vi } from 'vitest';
import { h } from '../src/runtime/index.js';
import { diff } from '../src/vdom/diff.js';
import { patch } from '../src/vdom/patch.js';
import { render } from '../src/vdom/render.js';

describe('keyed patch integration regressions', () => {
  it('moves nested keyed lists while updating descendants through old paths', () => {
    const tree = (groups, version) =>
      h(
        'main',
        {},
        groups.map(([key, items]) =>
          h(
            'section',
            { key, title: `${key}-${version}` },
            h('h2', {}, `${key}:${version}`),
            h(
              'ul',
              {},
              items.map((item) =>
                h(
                  'li',
                  { key: item },
                  h('span', { title: version }, `${item}:${version}`),
                ),
              ),
            ),
          ),
        ),
      );
    const before = tree(
      [
        ['a', ['x', 'y']],
        ['b', ['p', 'q']],
      ],
      'old',
    );
    const after = tree(
      [
        ['b', ['q', 'r', 'p']],
        ['a', ['y', 'x']],
      ],
      'new',
    );
    const root = render(before);
    const [a, b] = root.children;
    const x = a.querySelector('li');
    const q = b.querySelectorAll('li')[1];
    const qSpan = q.firstChild;

    expect(patch(root, diff(before, after))).toBe(root);
    expect(root.outerHTML).toBe(render(after).outerHTML);
    expect(root.children[0]).toBe(b);
    expect(root.children[1]).toBe(a);
    expect(b.querySelector('li')).toBe(q);
    expect(q.firstChild).toBe(qSpan);
    expect(qSpan.textContent).toBe('q:new');
    expect(a.querySelectorAll('li')[1]).toBe(x);
  });

  it('updates populated lists through empty states without retaining removed nodes', () => {
    const list = (keys) =>
      h(
        'ul',
        {},
        keys.map((key) => h('li', { key }, key)),
      );
    let previous = list(['a', 'b']);
    const root = render(previous);
    const removed = Array.from(root.children);
    for (const keys of [[], ['b', 'c'], [], [], ['a'], ['c', 'a']]) {
      const next = list(keys);
      const retained = new Map(
        previous.children.map((node, index) => [
          node.props.key,
          root.children[index],
        ]),
      );
      patch(root, diff(previous, next));
      expect(root.outerHTML).toBe(render(next).outerHTML);
      keys.forEach((key, index) => {
        if (retained.has(key))
          expect(root.children[index]).toBe(retained.get(key));
      });
      removed.forEach((node) => expect(root.contains(node)).toBe(false));
      previous = next;
    }
  });

  it('preserves moved controls and listeners while applying changed form properties', () => {
    const first = vi.fn();
    const replacement = vi.fn();
    const stable = vi.fn();
    const tree = (keys, changed) =>
      h(
        'form',
        {},
        keys.map((key) =>
          h(
            'fieldset',
            { key },
            h('input', {
              value: changed ? `${key}-new` : key,
              onInput: stable,
            }),
            h('input', {
              type: 'checkbox',
              checked: changed,
              disabled: changed,
            }),
            h(
              'button',
              {
                type: 'button',
                onClick: key === 'a' ? (changed ? replacement : first) : stable,
              },
              key,
            ),
          ),
        ),
      );
    const before = tree(['a', 'b'], false);
    const after = tree(['b', 'a'], true);
    const root = render(before);
    const [a, b] = root.children;
    const controls = Array.from(a.children);
    patch(root, diff(before, after));
    expect(root.children[0]).toBe(b);
    expect(root.children[1]).toBe(a);
    controls.forEach((control, index) =>
      expect(a.children[index]).toBe(control),
    );
    expect(controls[0].value).toBe('a-new');
    expect(controls[1].checked).toBe(true);
    expect(controls[1].disabled).toBe(true);
    controls[0].dispatchEvent(new Event('input'));
    controls[2].click();
    b.lastChild.click();
    expect(first).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(stable).toHaveBeenCalledTimes(2);

    patch(root, diff(after, before));
    expect(root.firstChild).toBe(a);
    expect(controls[0].value).toBe('a');
    expect(controls[1].checked).toBe(false);
    expect(controls[1].disabled).toBe(false);
    controls[2].click();
    expect(first).toHaveBeenCalledTimes(1);
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  it('matches every ordered subset transition for three keys and retains shared nodes', () => {
    const subsets = (keys) => [
      [],
      ...keys.flatMap((key, index) =>
        subsets(keys.filter((_, other) => other !== index)).map((tail) => [
          key,
          ...tail,
        ]),
      ),
    ];
    const states = subsets(['a', 'b', 'c']);
    const list = (keys) =>
      h(
        'ul',
        {},
        keys.map((key) => h('li', { key }, h('span', {}, key))),
      );
    expect(states).toHaveLength(16);
    for (const from of states)
      for (const to of states) {
        const before = list(from);
        const after = list(to);
        const root = render(before);
        const nodes = new Map(
          from.map((key, index) => [key, root.children[index]]),
        );
        patch(root, diff(before, after));
        expect(root.outerHTML, `${from} -> ${to}`).toBe(
          render(after).outerHTML,
        );
        to.forEach((key, index) => {
          if (nodes.has(key)) expect(root.children[index]).toBe(nodes.get(key));
        });
        from
          .filter((key) => !to.includes(key))
          .forEach((key) => expect(root.contains(nodes.get(key))).toBe(false));
      }
  });
});
