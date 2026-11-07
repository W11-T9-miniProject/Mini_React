import { beforeEach, describe, expect, it } from 'vitest';
import { setupPlayground } from '../src/playground/controller.js';
import { domToVNode } from '../src/vdom/dom-to-vnode.js';

describe('playground', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<p role="status"></p><button id="patch-button" disabled>Patch</button>' +
      '<button id="undo-button" disabled>뒤로가기</button><button id="redo-button" disabled>앞으로가기</button>' +
      '<div id="actual-root"></div><div id="test-root"></div>' +
      '<pre id="patch-output"></pre>' +
      '<textarea id="html-editor"></textarea>' +
      '<button id="apply-html-button">미리보기 적용</button>';
  });

  it('초기 샘플을 독립된 두 영역에 배치한다', () => {
    setupPlayground();
    const actual = document.querySelector('#actual-root > article');
    const test = document.querySelector('#test-root > article');
    expect(actual).not.toBeNull();
    expect(test).not.toBeNull();
    expect(domToVNode(actual)).toEqual(domToVNode(test));
    test.querySelector('p').textContent = '수정';
    expect(actual.querySelector('p').textContent).not.toBe('수정');
  });
  it('테스트 영역은 VDOM에서 생성해 샘플 주석을 포함하지 않는다', () => {
    setupPlayground();
    const actual = document.querySelector('#actual-root > article');
    const test = document.querySelector('#test-root > article');
    const hasComment = (element) =>
      Array.from(element.childNodes).some(
        (node) => node.nodeType === Node.COMMENT_NODE,
      );

    expect(hasComment(actual)).toBe(true);
    expect(hasComment(test)).toBe(false);
  });

  it('Patch 클릭 시 부분 갱신하고 다음 클릭에서는 직전 결과와 비교한다', () => {
    setupPlayground();
    const button = document.querySelector('#patch-button');
    const actual = document.querySelector('#actual-root > article');
    const heading = actual.querySelector('h3');
    const paragraph = actual.querySelector('p');
    const test = document.querySelector('#test-root > article');
    expect(button.disabled).toBe(false);

    test.querySelector('p').textContent = '첫 수정';
    expect(paragraph.textContent).not.toBe('첫 수정');
    button.click();
    expect(actual.querySelector('p')).toBe(paragraph);
    expect(actual.querySelector('h3')).toBe(heading);
    expect(paragraph.textContent).toBe('첫 수정');

    test.querySelector('p').textContent = '다음 수정';
    button.click();
    expect(paragraph.textContent).toBe('다음 수정');
    expect(domToVNode(actual)).toEqual(domToVNode(test));

    button.click();
    expect(document.querySelector('#patch-output').textContent).toBe('[]');
  });

  it('테스트 샘플 루트가 없어지면 실제 영역을 변경하지 않고 안내한다', () => {
    setupPlayground();
    const actual = document.querySelector('#actual-root > article');
    const before = actual.innerHTML;
    document.querySelector('#test-root').replaceChildren();

    document.querySelector('#patch-button').click();

    expect(actual.innerHTML).toBe(before);
    expect(document.querySelector('[role="status"]').textContent).toContain(
      '샘플',
    );
  });

  it('HTML 편집은 미리보기에 먼저 적용되고 Patch 후 실제 영역에 반영된다', () => {
    setupPlayground();
    const actual = document.querySelector('#actual-root > article');
    const previous = actual.innerHTML;
    const editor = document.querySelector('#html-editor');
    expect(editor.value).toContain('data-sample-root');

    editor.value =
      '<article><p class="welcome">반가워</p><button>클릭</button></article>';
    document.querySelector('#apply-html-button').click();
    const test = document.querySelector('#test-root > article');
    expect(test.querySelector('button').textContent).toBe('클릭');
    expect(actual.innerHTML).toBe(previous);

    document.querySelector('#patch-button').click();
    expect(domToVNode(actual)).toEqual(domToVNode(test));
  });

  it.each([
    '<p>하나</p><p>둘</p>',
    '<article><script>alert(1)</script></article>',
    '<article><button onclick="alert(1)">클릭</button></article>',
  ])('지원하지 않는 HTML은 미리보기를 유지하고 안내한다: %s', (html) => {
    setupPlayground();
    const container = document.querySelector('#test-root');
    const previous = container.firstChild;
    document.querySelector('#html-editor').value = html;

    document.querySelector('#apply-html-button').click();

    expect(container.firstChild).toBe(previous);
    expect(document.querySelector('[role="status"]').textContent).toContain(
      '오류',
    );
  });

  it('화면에서 직접 편집한 내용도 HTML 입력창에 동기화한다', () => {
    setupPlayground();
    const container = document.querySelector('#test-root');
    container.querySelector('p').textContent = '직접 수정';
    container.dispatchEvent(new Event('input', { bubbles: true }));

    expect(document.querySelector('#html-editor').value).toContain('직접 수정');
  });

  it.each(['<buton>오타</buton>', '<p onclick="alert(1)">위험</p>'])(
    '직접 편집으로 들어온 미지원 HTML도 Patch에서 거부한다: %s',
    (html) => {
      setupPlayground();
      const actual = document.querySelector('#actual-root > article');
      const before = actual.innerHTML;
      document.querySelector('#test-root > article').innerHTML = html;
      document.querySelector('#patch-button').click();
      expect(actual.innerHTML).toBe(before);
      expect(document.querySelector('[role="status"]').textContent).toContain(
        '지원하지',
      );
      expect(document.querySelector('#undo-button').disabled).toBe(true);
    },
  );

  it('미리보기에 붙여넣은 HTML은 실행하지 않고 글자로 삽입한다', () => {
    setupPlayground();
    const paragraph = document.querySelector('#test-root p');
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: { getData: () => '<button>클릭</button>' },
    });
    paragraph.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(paragraph.textContent).toBe('<button>클릭</button>');
    expect(paragraph.querySelector('button')).toBeNull();
  });

  it('미적용 편집에서 샘플이 삭제돼도 이력 이동으로 복구한다', () => {
    setupPlayground();
    const initial = document.querySelector('#actual-root p').textContent;
    document.querySelector('#test-root p').textContent = '저장';
    document.querySelector('#patch-button').click();
    document.querySelector('#test-root').replaceChildren();
    document.querySelector('#undo-button').click();
    expect(document.querySelector('#test-root p').textContent).toBe(initial);
    expect(document.querySelector('#actual-root p').textContent).toBe(initial);
  });

  it('샘플 루트의 태그를 교체한 뒤에도 이력과 다음 Patch가 동작한다', () => {
    setupPlayground();
    document.querySelector('#html-editor').value =
      '<section><p>새 루트</p></section>';
    document.querySelector('#apply-html-button').click();
    document.querySelector('#patch-button').click();
    expect(document.querySelector('#actual-root > section')).not.toBeNull();
    document.querySelector('#undo-button').click();
    expect(document.querySelector('#actual-root > article')).not.toBeNull();
    document.querySelector('#redo-button').click();
    document.querySelector('#test-root p').textContent = '다음 변경';
    document.querySelector('#patch-button').click();
    expect(document.querySelector('#actual-root p').textContent).toBe(
      '다음 변경',
    );
  });

  it('편집 → Patch → 뒤로 → 앞으로 이동한다', () => {
    setupPlayground();
    const undo = document.querySelector('#undo-button');
    const redo = document.querySelector('#redo-button');
    const initial = document.querySelector('#actual-root p').textContent;
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);
    for (const value of ['B', 'C']) {
      document.querySelector('#test-root p').textContent = value;
      document.querySelector('#patch-button').click();
    }
    undo.click();
    expect(document.querySelector('#actual-root p').textContent).toBe('B');
    expect(document.querySelector('#test-root p').textContent).toBe('B');
    expect(document.querySelector('#html-editor').value).toContain('>B</p>');
    expect(redo.disabled).toBe(false);
    undo.click();
    expect(document.querySelector('#actual-root p').textContent).toBe(initial);
    expect(undo.disabled).toBe(true);
    redo.click();
    expect(document.querySelector('#actual-root p').textContent).toBe('B');
    redo.click();
    expect(document.querySelector('#test-root p').textContent).toBe('C');
    expect(redo.disabled).toBe(true);
  });

  it('미적용 편집 후 이력 이동 시 두 영역을 목표 상태로 맞춘다', () => {
    setupPlayground();
    const initial = document.querySelector('#actual-root p').textContent;
    document.querySelector('#test-root p').textContent = '저장';
    document.querySelector('#patch-button').click();
    document.querySelector('#test-root p').textContent = '미저장';

    document.querySelector('#undo-button').click();

    expect(document.querySelector('#actual-root p').textContent).toBe(initial);
    expect(document.querySelector('#test-root p').textContent).toBe(initial);
    expect(document.querySelector('#html-editor').value).not.toContain(
      '미저장',
    );
  });

  it('변경 없는 Patch는 저장하지 않고 새 저장은 미래 이력을 제거한다', () => {
    setupPlayground();
    const patchButton = document.querySelector('#patch-button');
    patchButton.click();
    expect(document.querySelector('#undo-button').disabled).toBe(true);
    for (const value of ['B', 'C']) {
      document.querySelector('#test-root p').textContent = value;
      patchButton.click();
    }
    document.querySelector('#undo-button').click();
    patchButton.click();
    expect(document.querySelector('#redo-button').disabled).toBe(false);
    document.querySelector('#test-root p').textContent = 'D';
    patchButton.click();
    expect(document.querySelector('#redo-button').disabled).toBe(true);
    document.querySelector('#undo-button').click();
    expect(document.querySelector('#actual-root p').textContent).toBe('B');
  });
});
