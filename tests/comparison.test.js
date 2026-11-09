import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const page = readFileSync('index.html', 'utf8');

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = page.match(/<body>([\s\S]*)<\/body>/)[1];
  await import('../src/main.js');
  const operation = document.querySelector('#compare-operation');
  operation.value = 'text';
  operation.dispatchEvent(new Event('change'));
  document.querySelector('#compare-index').value = '50';
  document.querySelector('#compare-text').value = '수정한 상품 표시 50';
});

describe('Phase 1 비교 화면', () => {
  it('실습을 유지하면서 비교 탭으로 전환한다', () => {
    const tab = document.querySelector('#comparison-tab');
    expect(tab).not.toBeNull();
    tab.click();
    expect(document.querySelector('#comparison-panel').hidden).toBe(false);
    expect(document.querySelector('#practice-panel').hidden).toBe(true);
    document.querySelector('#practice-tab').click();
    expect(document.querySelector('#practice-panel').hidden).toBe(false);
    expect(document.querySelector('#actual-root article')).not.toBeNull();
  });

  it('상품 표시 문구 수정 시 두 결과는 같고 추가 실행 없이 처리 시간을 표시한다', () => {
    const button = document.querySelector('#compare-run');
    expect(button).not.toBeNull();
    const full = document.querySelector('#full-result');
    const partial = document.querySelector('#partial-result');
    const oldFull = [...full.querySelectorAll('li')];
    const oldPartial = [...partial.querySelectorAll('li')];
    button.click();
    expect(full.innerHTML).toBe(partial.innerHTML);
    expect(partial.querySelectorAll('li')).toHaveLength(100);
    expect(partial.querySelectorAll('li')[49].textContent).toBe(
      '수정한 상품 표시 50',
    );
    expect(partial.querySelectorAll('li')[48].textContent).toBe(
      '무선 마우스 49 · 수량 1개 · 상품 금액 12,000원',
    );
    expect(oldFull.every((li) => !full.contains(li))).toBe(true);
    expect(oldPartial.every((li) => partial.contains(li))).toBe(true);
    expect(document.querySelector('#full-kept').textContent).toBe('0');
    expect(document.querySelector('#partial-kept').textContent).toBe('100');
    expect(
      JSON.parse(document.querySelector('#comparison-patches').textContent),
    ).toEqual([{ type: 'TEXT', path: [49, 0], value: '수정한 상품 표시 50' }]);
    expect(
      document.querySelectorAll('#full-map [data-operation="created"]'),
    ).toHaveLength(100);
    expect(
      document.querySelectorAll('#partial-map [data-operation="text"]'),
    ).toHaveLength(1);
    expect(
      document.querySelectorAll('#partial-map [data-operation="kept"]'),
    ).toHaveLength(99);
    expect(
      document
        .querySelector('#partial-map [data-operation="text"]')
        .getAttribute('title'),
    ).toContain('50');
    expect(document.querySelector('#compare-measure')).toBeNull();
    expect(document.querySelector('#full-time').textContent).toMatch(
      /\d+\.\d{3} ms/,
    );
    expect(document.querySelector('#partial-time').textContent).toMatch(
      /\d+\.\d{3} ms/,
    );
  });

  it('같은 값 재적용은 Patch 명령이 없으며 다른 항목 수정과 초기화도 가능하다', () => {
    const button = document.querySelector('#compare-run');
    expect(button).not.toBeNull();
    button.click();
    button.click();
    expect(document.querySelector('#comparison-patches').textContent).toBe(
      '[]',
    );
    expect(
      document.querySelectorAll('#partial-map [data-operation="text"]'),
    ).toHaveLength(0);
    document.querySelector('#compare-index').value = '1';
    document.querySelector('#compare-text').value = '첫 문장 변경';
    button.click();
    expect(document.querySelector('#partial-result li').textContent).toBe(
      '첫 문장 변경',
    );
    expect(document.querySelector('#full-result').innerHTML).toBe(
      document.querySelector('#partial-result').innerHTML,
    );
    document.querySelector('#compare-reset').click();
    expect(document.querySelector('#partial-result li').textContent).toBe(
      '무선 마우스 1 · 수량 1개 · 상품 금액 12,000원',
    );
    expect(document.querySelectorAll('#partial-result li')).toHaveLength(100);
    expect(document.querySelector('#full-time').textContent).toBe('—');
    expect(
      document.querySelectorAll('#full-map [data-operation="created"]'),
    ).toHaveLength(0);
  });

  it('잘못된 번호를 거절하고 입력 문구를 HTML로 실행하지 않는다', () => {
    const button = document.querySelector('#compare-run');
    expect(button).not.toBeNull();
    const full = document.querySelector('#full-result');
    const before = full.innerHTML;
    for (const value of ['0', '101', '1.5', '']) {
      document.querySelector('#compare-index').value = value;
      button.click();
      expect(full.innerHTML).toBe(before);
      expect(
        document.querySelector('#comparison-status').textContent,
      ).toContain('1~100');
    }
    document.querySelector('#compare-index').value = '100';
    document.querySelector('#compare-text').value =
      '<img src=x onerror=alert(1)>';
    button.click();
    expect(full.querySelector('img')).toBeNull();
    expect(full.querySelectorAll('li')[99].textContent).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });

  it('데이터 규모를 바꾸면 두 목록과 입력 범위가 함께 바뀐다', () => {
    const size = document.querySelector('#compare-size');
    expect(size).not.toBeNull();
    size.value = '1000';
    size.dispatchEvent(new Event('change'));
    expect(document.querySelectorAll('#full-result li')).toHaveLength(1000);
    expect(document.querySelectorAll('#partial-result li')).toHaveLength(1000);
    const operation = document.querySelector('#compare-operation');
    operation.value = 'text';
    operation.dispatchEvent(new Event('change'));
    document.querySelector('#compare-index').value = '1000';
    document.querySelector('#compare-text').value = '마지막 변경';
    const createElement = vi.spyOn(document, 'createElement');
    document.querySelector('#compare-run').click();
    expect(
      createElement.mock.calls.filter(([tag]) => tag === 'li'),
    ).toHaveLength(1000);
    createElement.mockRestore();
    expect(
      document.querySelector('#partial-result li:last-child').textContent,
    ).toBe('마지막 변경');
    expect(document.querySelector('#full-created').textContent).toBe('1000');
    expect(document.querySelector('#partial-kept').textContent).toBe('1000');
    expect(document.querySelectorAll('#partial-map span')).toHaveLength(100);
    expect(document.querySelector('#full-map-unit').textContent).toContain(
      '한 칸 = 10개 상품',
    );
    expect(document.querySelector('#partial-map-unit').textContent).toContain(
      '한 칸 = 10개 상품',
    );
    expect([...size.options].map((option) => option.value)).toEqual([
      '100',
      '1000',
    ]);
  });

  it('목록에 직접 입력한 메모는 전체 교체 시 사라지고 Patch 시 보존된다', () => {
    const fullMemo = document.querySelector('#full-result input');
    const partialMemo = document.querySelector('#partial-result input');
    expect(fullMemo).not.toBeNull();
    expect(partialMemo).not.toBeNull();
    fullMemo.value = partialMemo.value = '작성하던 메모';
    document.querySelector('#compare-run').click();
    expect(document.querySelector('#full-result input')).not.toBe(fullMemo);
    expect(document.querySelector('#full-result input').value).toBe('');
    expect(document.querySelector('#partial-result input')).toBe(partialMemo);
    expect(partialMemo.value).toBe('작성하던 메모');
    expect(document.querySelector('#full-result').innerHTML).toBe(
      document.querySelector('#partial-result').innerHTML,
    );
  });

  it('끝에 항목을 추가하고 삭제해도 기존 항목은 재사용한다', () => {
    const operation = document.querySelector('#compare-operation');
    expect(operation).not.toBeNull();
    const original = [...document.querySelectorAll('#partial-result li')];
    operation.value = 'append';
    operation.dispatchEvent(new Event('change'));
    document.querySelector('#compare-text').value = '추가한 항목';
    document.querySelector('#compare-run').click();
    expect(document.querySelectorAll('#partial-result li')).toHaveLength(101);
    expect(document.querySelector('#partial-created').textContent).toBe('1');
    expect(
      document.querySelector('#partial-elements-created').textContent,
    ).toBe('1');
    expect(
      original.every((node) =>
        document.querySelector('#partial-result').contains(node),
      ),
    ).toBe(true);
    operation.value = 'remove';
    operation.dispatchEvent(new Event('change'));
    document.querySelector('#compare-run').click();
    expect(document.querySelectorAll('#partial-result li')).toHaveLength(100);
    expect(document.querySelector('#partial-removed').textContent).toBe('1');
    expect(
      document.querySelector('#partial-elements-removed').textContent,
    ).toBe('1');
    expect(
      document.querySelectorAll('#partial-map [data-operation="removed"]'),
    ).toHaveLength(1);
    expect(document.querySelector('#full-result').innerHTML).toBe(
      document.querySelector('#partial-result').innerHTML,
    );
  });

  it('태그를 strong에서 p와 div로 바꾸며 내부 요소의 교체를 집계한다', () => {
    const operation = document.querySelector('#compare-operation');
    expect(operation).not.toBeNull();
    operation.value = 'tag';
    operation.dispatchEvent(new Event('change'));
    const item = document.querySelectorAll('#partial-result li')[49];
    for (const tag of ['strong', 'p', 'div']) {
      document.querySelector('#compare-tag').value = tag;
      document.querySelector('#compare-run').click();
      expect(document.querySelectorAll('#partial-result li')[49]).toBe(item);
      expect(item.firstElementChild.localName).toBe(tag);
      expect(document.querySelector('#partial-created').textContent).toBe('0');
      expect(
        document.querySelector('#partial-elements-created').textContent,
      ).toBe('1');
      expect(
        document.querySelectorAll('#partial-map [data-operation="element"]'),
      ).toHaveLength(1);
    }
    operation.value = 'text';
    operation.dispatchEvent(new Event('change'));
    document.querySelector('#compare-text').value = '태그 안의 글자 변경';
    const child = item.firstElementChild;
    document.querySelector('#compare-run').click();
    expect(item.firstElementChild).toBe(child);
    expect(child.textContent).toBe('태그 안의 글자 변경');
    expect(document.querySelector('#full-result').innerHTML).toBe(
      document.querySelector('#partial-result').innerHTML,
    );
  });

  it('항목 수 상한을 지키고 첫 항목의 태그 변경에서도 메모를 보존한다', () => {
    const operation = document.querySelector('#compare-operation');
    expect(operation).not.toBeNull();
    operation.value = 'tag';
    operation.dispatchEvent(new Event('change'));
    document.querySelector('#compare-index').value = '1';
    const memo = document.querySelector('#partial-result input');
    memo.value = '보존할 값';
    document.querySelector('#compare-run').click();
    expect(document.querySelector('#partial-result input')).toBe(memo);
    expect(memo.value).toBe('보존할 값');
    const size = document.querySelector('#compare-size');
    size.value = '1000';
    size.dispatchEvent(new Event('change'));
    operation.value = 'append';
    operation.dispatchEvent(new Event('change'));
    document.querySelector('#compare-run').click();
    expect(document.querySelectorAll('#partial-result li')).toHaveLength(1000);
    expect(document.querySelector('#comparison-status').textContent).toContain(
      '최대 1,000',
    );
  });

  it('끝 항목을 반복 삭제해도 마지막 메모 항목은 남긴다', () => {
    const operation = document.querySelector('#compare-operation');
    operation.value = 'remove';
    operation.dispatchEvent(new Event('change'));
    const run = document.querySelector('#compare-run');
    for (let index = 0; index < 99; index += 1) run.click();
    expect(document.querySelectorAll('#partial-result li')).toHaveLength(1);
    const item = document.querySelector('#partial-result li');
    run.click();
    expect(document.querySelector('#partial-result li')).toBe(item);
    expect(document.querySelector('#comparison-status').textContent).toContain(
      '마지막 항목',
    );
    expect(document.querySelector('#full-result').innerHTML).toBe(
      document.querySelector('#partial-result').innerHTML,
    );
  });
});

it('상품 수량 변경은 금액을 함께 바꾸며 배송 요청 입력값과 기존 DOM을 보존한다', () => {
  document.querySelector('#compare-reset').click();
  expect(document.querySelector('#compare-operation').value).toBe('quantity');
  document.querySelector('#compare-index').value = '1';
  document.querySelector('#compare-quantity').value = '2';
  const item = document.querySelector('#partial-result li');
  const note = document.querySelector('#partial-result input');
  note.value = '경비실에 맡겨주세요';
  document.querySelector('#compare-run').click();
  expect(document.querySelector('#partial-result li')).toBe(item);
  expect(item.textContent).toContain('수량 2개 · 상품 금액 24,000원');
  expect(document.querySelector('#full-result').innerHTML).toBe(
    document.querySelector('#partial-result').innerHTML,
  );
  expect(document.querySelector('#full-result input').value).toBe('');
  expect(note.value).toBe('경비실에 맡겨주세요');
  expect(document.querySelector('#partial-kept').textContent).toBe('100');
  expect(document.querySelector('#partial-elements-created').textContent).toBe(
    '0',
  );
  for (const value of ['0', '1.5', '100', '']) {
    const before = item.outerHTML;
    document.querySelector('#compare-quantity').value = value;
    document.querySelector('#compare-run').click();
    expect(item.outerHTML).toBe(before);
    expect(document.querySelector('#comparison-status').textContent).toContain(
      '1~99',
    );
  }
});
