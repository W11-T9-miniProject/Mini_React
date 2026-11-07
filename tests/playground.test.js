import { beforeEach, describe, it, expect } from 'vitest';
import html from '../index.html?raw';
import { setupPlayground } from '../src/playground/controller.js';
import { parseHTML } from '../src/playground/editor.js';

function edit(value) {
  const source = document.querySelector('#html-source');
  source.value = value;
  source.dispatchEvent(new Event('input', { bubbles: true }));
}
describe('Phase 1 통합', () => {
  let app;
  beforeEach(() => {
    document.body.innerHTML = html.match(
      /<body>([\s\S]*)<script type="module"/,
    )[1];
    app = setupPlayground();
  });
  it('실제 DOM에서 초기 VDOM을 만들어 독립된 테스트 DOM을 생성한다', () => {
    const actual = document.querySelector('#actual-root > div'),
      test = document.querySelector('#test-root > div');
    expect(actual.isEqualNode(test)).toBe(true);
    expect(actual).not.toBe(test);
    app.destroy();
  });
  it('편집 → Patch → 뒤로 → 앞으로 이동하고 기존 실제 루트는 유지한다', () => {
    const actual = document.querySelector('#actual-root > div');
    edit('<p title="new">바뀐 문장</p>');
    expect(actual.querySelector('article')).not.toBeNull();
    app.commit();
    expect(actual.textContent).toBe('바뀐 문장');
    expect(app.history.length).toBe(2);
    app.travel('undo');
    expect(actual.querySelector('article')).not.toBeNull();
    app.travel('redo');
    expect(actual.textContent).toBe('바뀐 문장');
    expect(document.querySelector('#actual-root > div')).toBe(actual);
    app.destroy();
  });
  it('변경 없음은 이력을 추가하지 않는다', () => {
    app.commit();
    expect(app.history.length).toBe(1);
    expect(document.querySelector('#patch-count').textContent).toBe('0');
    app.destroy();
  });
  it('미적용 편집과 오류가 있어도 이력 이동 시 양쪽을 복원한다', () => {
    edit('<p>B</p>');
    app.commit();
    edit('<p>미적용</p>');
    app.travel('undo');
    expect(document.querySelector('#actual-root').textContent).toBe(
      document.querySelector('#test-root').textContent,
    );
    edit('<script>alert(1)</script>');
    app.commit();
    expect(app.history.length).toBe(2);
    app.travel('redo');
    expect(document.querySelector('#html-source').value).toContain('<p>B</p>');
    app.destroy();
  });
  it('입력 요소의 현재 value와 checked를 Patch한다', () => {
    edit('<input type="checkbox" value="a">');
    app.commit();
    const input = document.querySelector('#test-root input');
    input.checked = true;
    input.value = 'b';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    app.commit();
    const actual = document.querySelector('#actual-root input');
    expect(actual.checked).toBe(true);
    expect(actual.value).toBe('b');
    app.destroy();
  });
  it('뒤로 이동 후 새 변경은 미래 이력을 없앤다', () => {
    edit('<p>B</p>');
    app.commit();
    edit('<p>C</p>');
    app.commit();
    app.travel('undo');
    edit('<p>D</p>');
    app.commit();
    expect(app.history.canRedo()).toBe(false);
    expect(app.history.length).toBe(3);
    app.destroy();
  });
  it('브라우저가 보정한 HTML과 빈 내용도 처리한다', () => {
    edit('<p>중첩<div>자동 보정</div>');
    app.commit();
    expect(document.querySelector('#actual-root').textContent).toContain(
      '자동 보정',
    );
    edit('');
    app.commit();
    expect(
      document.querySelector('#actual-root > div').childNodes,
    ).toHaveLength(0);
    app.destroy();
  });
});
describe('HTML 편집 정책', () => {
  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(1)">',
    '<a href="javascript:alert(1)">x</a>',
    '<iframe></iframe>',
    '<div style="color:red">x</div>',
  ])('실행 가능한 HTML을 거부한다: %s', (value) => {
    expect(() => parseHTML(value)).toThrow();
  });
  it('일반 태그와 URL은 허용하고 주석을 제거한다', () => {
    const root = parseHTML(
      '<a href="/hello">링크</a><!-- comment --><p>문장</p>',
    );
    expect(root.querySelector('a').getAttribute('rel')).toBe(
      'noopener noreferrer',
    );
    expect(root.childNodes).toHaveLength(2);
  });
});
