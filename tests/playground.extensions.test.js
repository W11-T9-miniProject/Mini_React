import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupPlayground } from '../src/playground/controller.js';

function mountPlayground() {
  document.body.innerHTML = `
    <button id="patch-button"></button>
    <button id="undo-button"></button>
    <button id="redo-button"></button>
    <pre id="patch-output"></pre>
    <p id="edit-status"></p>
    <ol id="history-timeline"></ol>
    <div id="actual-root"></div>
    <div id="test-root" contenteditable="true"></div>
  `;
  setupPlayground();
}

const nextMutationFrame = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('Playground 선택 확장', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('편집 내용을 감지하고 원래대로 되돌리면 미적용 표시를 해제한다', async () => {
    mountPlayground();
    const paragraph = document.querySelector('#test-root p');
    const status = document.querySelector('#edit-status');

    expect(status.textContent).toBe('적용된 상태');
    paragraph.textContent = '아직 적용되지 않은 수정';
    await nextMutationFrame();
    expect(status.textContent).toBe('미적용 변경 있음');

    paragraph.textContent = '테스트 영역에서 이 문장을 수정해 보세요.';
    await nextMutationFrame();
    expect(status.textContent).toBe('적용된 상태');
  });

  it('속성과 자식 구조 편집도 미적용 상태로 감지한다', async () => {
    mountPlayground();
    const paragraph = document.querySelector('#test-root p');
    const status = document.querySelector('#edit-status');

    paragraph.setAttribute('title', 'new attribute');
    await nextMutationFrame();
    expect(status.textContent).toBe('미적용 변경 있음');

    document
      .querySelector('#test-root ul')
      .append(document.createElement('li'));
    await nextMutationFrame();
    expect(status.textContent).toBe('미적용 변경 있음');
  });

  it('루트 제거를 감지해 오류 상태를 보여주고 Patch도 안전히 거부한다', async () => {
    mountPlayground();
    document.querySelector('#test-root [data-sample-root]').remove();
    await nextMutationFrame();

    expect(document.querySelector('#edit-status').textContent).toBe(
      '샘플 루트 없음',
    );
    document.querySelector('#patch-button').click();
    expect(
      document.querySelector('#actual-root [data-sample-root]'),
    ).not.toBeNull();
    expect(document.querySelector('#patch-output').textContent).toContain(
      '샘플 루트',
    );
  });

  it('중복 key 편집은 미적용 오류로 표시하고 실제 영역을 바꾸지 않는다', async () => {
    mountPlayground();
    const actualBefore = document.querySelector('#actual-root').innerHTML;
    const root = document.querySelector('#test-root [data-sample-root]');
    root.innerHTML =
      '<ul><li data-key="same">A</li><li data-key="same">B</li></ul>';
    await nextMutationFrame();

    expect(document.querySelector('#edit-status').textContent).toContain(
      '편집 오류:',
    );
    document.querySelector('#patch-button').click();
    expect(document.querySelector('#actual-root').innerHTML).toBe(actualBefore);
    expect(document.querySelector('#patch-output').textContent).toContain(
      '중복된 형제 key',
    );
  });

  it('타임라인은 초기 및 변경 상태를 표시하고 선택한 이력으로 두 영역을 동기화한다', async () => {
    mountPlayground();
    const testParagraph = document.querySelector('#test-root p');
    const timeline = document.querySelector('#history-timeline');

    expect(
      [...timeline.querySelectorAll('button')].map(
        (button) => button.textContent,
      ),
    ).toEqual(['초기 상태']);
    expect(timeline.querySelector('[aria-current="step"]')).not.toBeNull();

    testParagraph.textContent = '변경 1';
    document.querySelector('#patch-button').click();
    testParagraph.textContent = '변경 2';
    document.querySelector('#patch-button').click();

    const entries = [...timeline.querySelectorAll('button')];
    expect(entries.map((button) => button.textContent)).toEqual([
      '초기 상태',
      '상태 1',
      '상태 2',
    ]);
    expect(entries[2].getAttribute('aria-current')).toBe('step');

    entries[0].click();
    expect(document.querySelector('#actual-root p').textContent).toBe(
      '테스트 영역에서 이 문장을 수정해 보세요.',
    );
    expect(document.querySelector('#test-root p').textContent).toBe(
      '테스트 영역에서 이 문장을 수정해 보세요.',
    );
    expect(document.querySelector('#edit-status').textContent).toBe(
      '적용된 상태',
    );
    expect(
      document
        .querySelector('[data-history-index="0"]')
        .getAttribute('aria-current'),
    ).toBe('step');

    document.querySelector('#test-root p').textContent = '새 branch';
    document.querySelector('#patch-button').click();
    await nextMutationFrame();
    expect(
      [...timeline.querySelectorAll('button')].map(
        (button) => button.textContent,
      ),
    ).toEqual(['초기 상태', '상태 1']);
  });

  it('MutationObserver가 없는 환경에서도 기본 Patch 버튼은 동작한다', () => {
    const observer = globalThis.MutationObserver;
    try {
      globalThis.MutationObserver = undefined;
      mountPlayground();
      expect(document.querySelector('#edit-status').textContent).toBe(
        '편집 감지 미지원',
      );
      document.querySelector('#test-root p').textContent = '무관찰 편집';
      document.querySelector('#patch-button').click();
      expect(document.querySelector('#actual-root p').textContent).toBe(
        '무관찰 편집',
      );
    } finally {
      globalThis.MutationObserver = observer;
    }
  });

  it('Patch 대상 요소를 800ms 강조한 뒤 클래스를 정리한다', () => {
    vi.useFakeTimers();
    mountPlayground();
    const paragraph = document.querySelector('#test-root p');
    paragraph.textContent = '강조 확인';
    document.querySelector('#patch-button').click();

    const patchedParagraph = document.querySelector('#actual-root p');
    expect(patchedParagraph.classList.contains('patch-highlight')).toBe(true);
    expect(patchedParagraph.textContent).toBe('강조 확인');

    vi.advanceTimersByTime(799);
    expect(patchedParagraph.classList.contains('patch-highlight')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(patchedParagraph.classList.contains('patch-highlight')).toBe(false);
  });

  it('다시 강조하면 타이머를 연장하고 기존 class 토큰을 보존한다', () => {
    vi.useFakeTimers();
    mountPlayground();
    const testParagraph = document.querySelector('#test-root p');
    testParagraph.classList.add('existing-class');
    document.querySelector('#patch-button').click();
    const actualParagraph = document.querySelector('#actual-root p');
    expect(actualParagraph.classList.contains('existing-class')).toBe(true);
    expect(actualParagraph.classList.contains('patch-highlight')).toBe(true);

    vi.advanceTimersByTime(500);
    testParagraph.textContent = '두 번째 변경';
    document.querySelector('#patch-button').click();
    vi.advanceTimersByTime(500);
    expect(actualParagraph.classList.contains('patch-highlight')).toBe(true);
    vi.advanceTimersByTime(300);
    expect(actualParagraph.classList.contains('patch-highlight')).toBe(false);
    expect(actualParagraph.classList.contains('existing-class')).toBe(true);
  });
});
