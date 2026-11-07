import { describe, expect, it } from 'vitest';
import { diff } from '../src/vdom/diff.js';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';

function vnodeFromHTML(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return domToVNode(container.firstChild);
}

describe('diff', () => {
  it('텍스트가 같으면 변경 목록이 비어 있다', () => {
    const previous = { type: 'text', value: '제목' };
    const next = { type: 'text', value: '제목' };

    expect(diff(previous, next)).toEqual([]);
  });

  it('텍스트가 다르면 루트의 TEXT 변경 명령을 만든다', () => {
    const previous = { type: 'text', value: '제목' };
    const next = { type: 'text', value: '공지' };

    expect(diff(previous, next)).toEqual([
      { type: 'TEXT', path: [], value: '공지' },
    ]);
  });

  it('동일 트리이면 빈 목록을 반환한다', () => {
    const previous = vnodeFromHTML('<div><p class="greeting">안녕</p></div>');
    const next = vnodeFromHTML('<div><p class="greeting">안녕</p></div>');

    expect(diff(previous, next)).toEqual([]);
  });

  it('각 자식의 경로를 구분해 안쪽 텍스트 변경을 찾는다', () => {
    const previous = vnodeFromHTML('<div><h2>제목</h2><p>설명</p></div>');
    const next = vnodeFromHTML('<div><h2>공지</h2><p>새로운 설명</p></div>');

    expect(diff(previous, next)).toEqual([
      { type: 'TEXT', path: [0, 0], value: '공지' },
      { type: 'TEXT', path: [1, 0], value: '새로운 설명' },
    ]);
  });
  it('속성의 추가 변경 삭제만 하나의 PROPS 명령에 담는다', () => {
    const previous = vnodeFromHTML(
      '<p class="greeting" title="인사" data-stable="yes">안녕</p>',
    );
    const next = vnodeFromHTML(
      '<p class="welcome" id="message" data-stable="yes">안녕</p>',
    );

    expect(diff(previous, next)).toEqual([
      {
        type: 'PROPS',
        path: [],
        set: { class: 'welcome', id: 'message' },
        remove: ['title'],
      },
    ]);
  });

  it('자식의 속성과 텍스트 변경을 각 경로에 담는다', () => {
    const previous = vnodeFromHTML('<div><p class="greeting">안녕</p></div>');
    const next = vnodeFromHTML('<div><p class="welcome">반가워</p></div>');

    expect(diff(previous, next)).toEqual([
      {
        type: 'PROPS',
        path: [0],
        set: { class: 'welcome' },
        remove: [],
      },
      { type: 'TEXT', path: [0, 0], value: '반가워' },
    ]);
  });

  it('입력 VDOM을 수정하지 않는다', () => {
    const previous = vnodeFromHTML('<p class="greeting" title="인사">안녕</p>');
    const next = vnodeFromHTML('<p class="welcome">반가워</p>');
    const previousSnapshot = structuredClone(previous);
    const nextSnapshot = structuredClone(next);

    diff(previous, next);

    expect(previous).toEqual(previousSnapshot);
    expect(next).toEqual(nextSnapshot);
  });

  it('태그가 바뀌면 자식을 별도로 비교하지 않고 통째로 교체한다', () => {
    const previous = vnodeFromHTML('<p class="old">안녕</p>');
    const next = vnodeFromHTML(
      '<button class="new"><strong>클릭</strong></button>',
    );

    expect(diff(previous, next)).toEqual([
      { type: 'REPLACE', path: [], node: next },
    ]);
  });

  it('텍스트에서 요소로 바뀌면 교체한다', () => {
    const previous = { type: 'text', value: '안녕' };
    const next = vnodeFromHTML('<span>안녕</span>');

    expect(diff(previous, next)).toEqual([
      { type: 'REPLACE', path: [], node: next },
    ]);
  });

  it('자식 요소가 텍스트로 바뀌면 해당 자식 경로에 교체를 기록한다', () => {
    const previous = vnodeFromHTML('<div><span>안녕</span></div>');
    const next = vnodeFromHTML('<div>반가워</div>');

    expect(diff(previous, next)).toEqual([
      { type: 'REPLACE', path: [0], node: next.children[0] },
    ]);
  });

  it('뒤에 추가된 여러 자식을 부모 경로와 다음 index로 기록한다', () => {
    const previous = vnodeFromHTML('<ul><li>사과</li></ul>');
    const next = vnodeFromHTML(
      '<ul><li>사과</li><li>귤</li><li>바나나</li></ul>',
    );

    expect(diff(previous, next)).toEqual([
      { type: 'INSERT', path: [], index: 1, node: next.children[1] },
      { type: 'INSERT', path: [], index: 2, node: next.children[2] },
    ]);
  });

  it('자식이 없는 부모에도 자식을 추가한다', () => {
    const previous = vnodeFromHTML('<div></div>');
    const next = vnodeFromHTML('<div><p>안녕</p></div>');

    expect(diff(previous, next)).toEqual([
      { type: 'INSERT', path: [], index: 0, node: next.children[0] },
    ]);
  });

  it('모든 자식 삭제를 기존 자식 경로에 기록한다', () => {
    const previous = vnodeFromHTML('<ul><li>사과</li><li>귤</li></ul>');
    const next = vnodeFromHTML('<ul></ul>');

    expect(diff(previous, next)).toEqual([
      { type: 'REMOVE', path: [0] },
      { type: 'REMOVE', path: [1] },
    ]);
  });

  it('중간 항목 삭제 시 같은 위치의 값을 바꾸고 남는 끝 항목을 삭제한다', () => {
    const previous = vnodeFromHTML(
      '<ul><li>사과</li><li>귤</li><li>바나나</li></ul>',
    );
    const next = vnodeFromHTML('<ul><li>사과</li><li>바나나</li></ul>');

    expect(diff(previous, next)).toEqual([
      { type: 'TEXT', path: [1, 0], value: '바나나' },
      { type: 'REMOVE', path: [2] },
    ]);
  });

  it('추가 삭제 교체 텍스트 속성 변경을 구분한다', () => {
    const previous = vnodeFromHTML(
      '<div class="old">이전<p>교체 전</p><ul><li>사과</li></ul><ol><li>귤</li><li>바나나</li></ol></div>',
    );
    const next = vnodeFromHTML(
      '<div class="new">이후<button>교체 후</button><ul><li>사과</li><li>포도</li></ul><ol><li>귤</li></ol></div>',
    );
    const previousSnapshot = structuredClone(previous);
    const nextSnapshot = structuredClone(next);

    expect(diff(previous, next)).toEqual([
      { type: 'PROPS', path: [], set: { class: 'new' }, remove: [] },
      { type: 'TEXT', path: [0], value: '이후' },
      { type: 'REPLACE', path: [1], node: next.children[1] },
      {
        type: 'INSERT',
        path: [2],
        index: 1,
        node: next.children[2].children[1],
      },
      { type: 'REMOVE', path: [3, 1] },
    ]);
    expect(previous).toEqual(previousSnapshot);
    expect(next).toEqual(nextSnapshot);
  });
});
