import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const page = readFileSync('index.html', 'utf8');

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = page.match(/<body>([\s\S]*)<\/body>/)[1];
  await import('../src/main.js');
});

describe('Phase 2 상태 실습', () => {
  it('이름 변경 시 Memo 계산만 재사용하며 숫자 변경 시 두 방식의 결과가 같다', () => {
    expect(document.querySelector('#state-memo-count')).not.toBeNull();
    expect(document.querySelector('#state-plain-count').textContent).toBe('1');
    expect(document.querySelector('#state-memo-count').textContent).toBe('1');
    document.querySelector('[data-state-action="rename"]').click();
    expect(document.querySelector('#state-plain-count').textContent).toBe('2');
    expect(document.querySelector('#state-memo-count').textContent).toBe('1');
    expect(document.querySelector('#state-memo-last').textContent).toContain(
      '재사용',
    );
    document.querySelector('[data-state-action="increment"]').click();
    expect(document.querySelector('#state-plain-count').textContent).toBe('3');
    expect(document.querySelector('#state-memo-count').textContent).toBe('2');
    expect(document.querySelector('#state-plain-result').textContent).toBe('2');
    expect(document.querySelector('#state-memo-result').textContent).toBe('2');
    expect(document.querySelector('#state-memo-last').textContent).toContain(
      '새로 계산',
    );
  });

  it('숫자 변경만 Effect를 실행하며 이름 변경은 탭 제목 작업을 반복하지 않는다', () => {
    expect(document.querySelector('#state-effect-count')).not.toBeNull();
    expect(document.querySelector('#state-effect-count').textContent).toBe('1');
    document.querySelector('[data-state-action="rename"]').click();
    expect(document.querySelector('#state-effect-count').textContent).toBe('1');
    document.querySelector('[data-state-action="increment"]').click();
    expect(document.title).toBe('Mini React · 현재 숫자: 1');
    expect(document.querySelector('#state-effect-count').textContent).toBe('2');
    expect(document.querySelector('#state-effect-deps').textContent).toBe(
      '[1]',
    );
    expect(document.querySelector('#state-effect-last').textContent).toContain(
      '화면 숫자 1',
    );
  });

  it('Phase별 실습·실험 순서대로 키보드로 이동한다', () => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    expect(
      tabs.map((tab) => tab.textContent.trim().replace(/\s+/g, ' ')),
    ).toEqual([
      '기본 실습 · Phase 1',
      '비교 실험 · Phase 1',
      '상태 실습 · Phase 2',
      '비교 실험 · Phase 2',
    ]);
    tabs[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.querySelector('#comparison-panel').hidden).toBe(false);
    expect(document.activeElement).toBe(tabs[1]);
    tabs[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.querySelector('#state-panel').hidden).toBe(false);
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs[3].disabled).toBe(false);
    tabs[2].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.activeElement).toBe(tabs[3]);
    expect(document.querySelector('#state-comparison-panel').hidden).toBe(
      false,
    );
    tabs[3].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('상태 탭을 열고 클릭하면 상태와 여러 표시가 함께 갱신된다', () => {
    const tab = document.querySelector('#state-tab');
    expect(tab).not.toBeNull();
    tab.click();
    expect(document.querySelector('#state-panel').hidden).toBe(false);
    expect(document.querySelector('#practice-panel').hidden).toBe(true);
    const root = document.querySelector('#state-root article');
    const count = root.querySelector('[data-count]');
    const button = root.querySelector('[data-state-action="increment"]');
    button.click();
    button.click();
    expect(count.textContent).toBe('2');
    expect(root.querySelector('[data-double]').textContent).toBe('4');
    expect(root.querySelector('[data-summary]').textContent).toBe(
      '정글님의 현재 숫자는 2입니다.',
    );
    expect(
      JSON.parse(document.querySelector('#state-hooks').textContent),
    ).toEqual([2, '정글']);
    expect(document.querySelector('#state-root article')).toBe(root);
    expect(root.querySelector('[data-state-action="increment"]')).toBe(button);
    expect(
      JSON.parse(document.querySelector('#state-patches').textContent).every(
        (change) => change.type === 'TEXT',
      ),
    ).toBe(true);
  });

  it('두 상태가 서로 다른 칸을 사용하며 탭 이동 후에도 유지된다', () => {
    const tab = document.querySelector('#state-tab');
    expect(tab).not.toBeNull();
    tab.click();
    document.querySelector('[data-state-action="increment"]').click();
    document.querySelector('[data-state-action="rename"]').click();
    expect(
      JSON.parse(document.querySelector('#state-hooks').textContent),
    ).toEqual([1, '학습자']);
    document.querySelector('[data-state-action="increment"]').click();
    expect(
      JSON.parse(document.querySelector('#state-hooks').textContent),
    ).toEqual([2, '학습자']);
    document.querySelector('#comparison-tab').click();
    document.querySelector('#state-tab').click();
    expect(document.querySelector('[data-count]').textContent).toBe('2');
    expect(document.querySelector('[data-summary]').textContent).toContain(
      '학습자',
    );
  });
});
