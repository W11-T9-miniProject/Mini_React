import { describe, expect, it } from 'vitest';
import { patch } from '../src/vdom/patch.js';
import { vnodeToDom } from '../src/vdom/vnode-to-dom.js';
import { diff } from '../src/vdom/diff.js';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';

function vnodeFromHTML(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return domToVNode(container.firstChild);
}

describe('patch', () => {
  it('연속 삭제와 중간 삽입을 함께 적용한다', () => {
    const root = document.createElement('ul');
    root.innerHTML = '<li>A</li><!-- 메모 --><li>B</li><li>C</li><li>D</li>';
    const [a, b, c, d] = root.children;
    const comment = root.childNodes[1];
    const item = (value) => ({
      type: 'element',
      tag: 'li',
      props: {},
      children: [{ type: 'text', value }],
    });

    patch(root, [
      { type: 'INSERT', path: [], index: 2, node: item('Y') },
      { type: 'REMOVE', path: [1] },
      { type: 'INSERT', path: [], index: 1, node: item('X') },
      { type: 'REMOVE', path: [2] },
      { type: 'TEXT', path: [3, 0], value: 'D!' },
    ]);

    expect(Array.from(root.children, (node) => node.textContent)).toEqual([
      'A',
      'X',
      'Y',
      'D!',
    ]);
    expect(root.children[0]).toBe(a);
    expect(root.children[3]).toBe(d);
    expect(b.parentNode).toBeNull();
    expect(c.parentNode).toBeNull();
    expect(comment.parentNode).toBe(root);
  });
  it('루트를 교체하고 새 루트를 반환한다', () => {
    const root = document.createElement('p');
    root.textContent = '안녕';
    document.body.appendChild(root);

    const result = patch(root, [
      {
        type: 'REPLACE',
        path: [],
        node: {
          type: 'element',
          tag: 'button',
          props: { title: '실행' },
          children: [{ type: 'text', value: '클릭' }],
        },
      },
    ]);

    expect(result).not.toBe(root);
    expect(result.localName).toBe('button');
    expect(result.getAttribute('title')).toBe('실행');
    expect(result.textContent).toBe('클릭');
    expect(document.body.firstChild).toBe(result);
    expect(root.parentNode).toBeNull();
  });

  it('페이지에 붙지 않은 루트도 교체해 반환한다', () => {
    const root = document.createElement('p');

    const result = patch(root, [
      { type: 'REPLACE', path: [], node: { type: 'text', value: '새 글자' } },
    ]);

    expect(result).not.toBe(root);
    expect(result.nodeType).toBe(Node.TEXT_NODE);
    expect(result.textContent).toBe('새 글자');
    expect(result.parentNode).toBeNull();
  });

  it('자식만 교체하면 루트와 다른 형제는 유지한다', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>안녕</p><span>유지</span>';
    const oldParagraph = root.firstChild;
    const sibling = root.lastChild;

    const result = patch(root, [
      {
        type: 'REPLACE',
        path: [0],
        node: {
          type: 'element',
          tag: 'button',
          props: {},
          children: [{ type: 'text', value: '클릭' }],
        },
      },
      { type: 'TEXT', path: [1, 0], value: '수정' },
    ]);

    expect(result).toBe(root);
    expect(root.firstChild.localName).toBe('button');
    expect(root.firstChild.textContent).toBe('클릭');
    expect(oldParagraph.parentNode).toBeNull();
    expect(root.lastChild).toBe(sibling);
    expect(sibling.textContent).toBe('수정');
  });
  it('바뀌지 않은 DOM 참조를 유지한다', () => {
    const root = document.createElement('div');
    root.innerHTML = '<h2>제목</h2><!-- 메모 --><p>설명</p>';
    document.body.appendChild(root);
    const heading = root.querySelector('h2');
    const paragraph = root.querySelector('p');
    const text = paragraph.firstChild;

    const result = patch(root, [
      { type: 'TEXT', path: [1, 0], value: '새로운 설명' },
    ]);

    expect(result).toBe(root);
    expect(root.querySelector('h2')).toBe(heading);
    expect(heading.textContent).toBe('제목');
    expect(root.querySelector('p')).toBe(paragraph);
    expect(paragraph.firstChild).toBe(text);
    expect(text.textContent).toBe('새로운 설명');
    expect(root.childNodes[1].nodeType).toBe(Node.COMMENT_NODE);
  });

  it('루트가 텍스트이면 같은 노드의 내용만 변경한다', () => {
    const root = document.createTextNode('안녕');

    expect(patch(root, [{ type: 'TEXT', path: [], value: '반가워' }])).toBe(
      root,
    );
    expect(root.textContent).toBe('반가워');
  });

  it('변경 목록이 비어 있으면 기존 DOM을 그대로 반환한다', () => {
    const root = document.createElement('p');
    root.textContent = '안녕';
    const text = root.firstChild;

    expect(patch(root, [])).toBe(root);
    expect(root.firstChild).toBe(text);
    expect(root.textContent).toBe('안녕');
  });

  it('없는 경로가 있으면 변경을 시작하기 전에 오류를 낸다', () => {
    const root = document.createElement('p');
    root.textContent = '안녕';

    expect(() =>
      patch(root, [
        { type: 'TEXT', path: [0], value: '반가워' },
        { type: 'TEXT', path: [1], value: '없는 노드' },
      ]),
    ).toThrow('경로');
    expect(root.textContent).toBe('안녕');
  });
  it('기존 요소와 자식을 유지하며 속성만 추가 변경 삭제한다', () => {
    const root = document.createElement('p');
    root.setAttribute('class', 'greeting');
    root.setAttribute('title', '인사');
    root.setAttribute('data-stable', 'yes');
    root.textContent = '안녕';
    const text = root.firstChild;

    const result = patch(root, [
      {
        type: 'PROPS',
        path: [],
        set: { class: 'welcome', id: 'message' },
        remove: ['title'],
      },
    ]);

    expect(result).toBe(root);
    expect(root.getAttribute('class')).toBe('welcome');
    expect(root.getAttribute('id')).toBe('message');
    expect(root.hasAttribute('title')).toBe(false);
    expect(root.getAttribute('data-stable')).toBe('yes');
    expect(root.firstChild).toBe(text);
    expect(root.textContent).toBe('안녕');
  });

  it('자식 요소의 속성과 그 안의 글자를 함께 변경한다', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p class="greeting">안녕</p>';
    const paragraph = root.firstChild;
    const text = paragraph.firstChild;

    patch(root, [
      { type: 'PROPS', path: [0], set: { class: 'welcome' }, remove: [] },
      { type: 'TEXT', path: [0, 0], value: '반가워' },
    ]);

    expect(root.firstChild).toBe(paragraph);
    expect(paragraph.getAttribute('class')).toBe('welcome');
    expect(paragraph.firstChild).toBe(text);
    expect(text.textContent).toBe('반가워');
  });

  it.each([
    [
      '여러 자식 추가',
      '<ul><li>A</li></ul>',
      '<ul><li>A</li><li>B</li><li>C</li></ul>',
    ],
    ['모든 자식 삭제', '<ul><li>A</li><li>B</li></ul>', '<ul></ul>'],
    [
      '중간 추가',
      '<ul><li>A</li><li>B</li></ul>',
      '<ul><li>A</li><li>X</li><li>B</li></ul>',
    ],
    [
      '중간 삭제',
      '<ul><li>A</li><li>B</li><li>C</li></ul>',
      '<ul><li>A</li><li>C</li></ul>',
    ],
    [
      '공백 텍스트와 요소 추가',
      '<div> <span>A</span></div>',
      '<div> <span>A</span> <em>B</em></div>',
    ],
    ['루트 교체', '<p>A</p>', '<button><strong>B</strong></button>'],
    ['텍스트 루트에서 요소로 교체', '안녕', '<p>안녕</p>'],
    [
      '다섯 명령 함께 적용',
      '<div class="old">이전<p>교체 전</p><ul><li>A</li></ul><ol><li>B</li><li>C</li></ol></div>',
      '<div class="new">이후<button>교체 후</button><ul><li>A</li><li>D</li></ul><ol><li>B</li></ol></div>',
    ],
  ])(
    '렌더 Diff Patch 재변환 결과가 목표 VDOM과 같다: %s',
    (_, before, after) => {
      const previous = vnodeFromHTML(before);
      const next = vnodeFromHTML(after);
      const root = vnodeToDom(previous);

      const result = patch(root, diff(previous, next));

      expect(domToVNode(result)).toEqual(next);
    },
  );
});
