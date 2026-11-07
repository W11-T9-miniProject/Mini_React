import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const page = readFileSync('index.html', 'utf8');
beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = page.match(/<body>([\s\S]*)<\/body>/)[1];
  await import('../src/main.js');
});
const value = (id) => document.getElementById(id).textContent;
const fields = (id) =>
  ['[data-count]', '[data-double]', '[data-summary]'].map(
    (selector) =>
      document.getElementById(id).querySelector(selector).textContent,
  );

describe('Phase 2 직접 관리와 Mini React 비교', () => {
  it('실습과 동일한 화면을 양쪽에 배치하고 같은 클릭의 결과를 맞춘다', () => {
    document.querySelector('#state-comparison-tab').click();
    const sample = document.querySelector('#state-root article');
    for (const id of ['phase2-manual-root', 'phase2-hook-root']) {
      expect(
        document
          .getElementById(id)
          .firstChild.outerHTML.replace(/ id="[^"]*"/g, ''),
      ).toBe(sample.outerHTML.replace(/ id="[^"]*"/g, ''));
    }
    document.querySelector('#phase2-count-button').click();
    expect(fields('phase2-manual-root')).toEqual([
      '1',
      '2',
      '정글님의 현재 숫자는 1입니다.',
    ]);
    expect(fields('phase2-hook-root')).toEqual(fields('phase2-manual-root'));
    document.querySelector('#phase2-name-button').click();
    expect(fields('phase2-manual-root')).toEqual([
      '1',
      '2',
      '학습자님의 현재 숫자는 1입니다.',
    ]);
    expect(fields('phase2-hook-root')).toEqual(fields('phase2-manual-root'));
    expect(value('phase2-comparison-status')).toContain('일치');
  });
  it('이름 변경은 일반 계산을 다시 실행하고 Memo는 재사용한다', () => {
    document.querySelector('#phase2-name-button').click();
    expect(value('phase2-plain-count')).toBe('2');
    expect(value('phase2-memo-count')).toBe('1');
    expect(value('phase2-manual-title-runs')).toBe('1');
    expect(value('phase2-hook-title-runs')).toBe('1');
    expect(value('phase2-manual-trace')).toContain('요약');
    expect(value('phase2-hook-trace')).toContain('재사용');
    document.querySelector('#phase2-count-button').click();
    expect(value('phase2-plain-count')).toBe('3');
    expect(value('phase2-memo-count')).toBe('2');
    expect(value('phase2-manual-title-runs')).toBe('2');
    expect(value('phase2-hook-title-runs')).toBe('2');
  });
  it('양쪽 버튼 모두 같은 입력을 적용하고 기존 DOM과 실습 상태를 유지한다', () => {
    const left = document.querySelector('#phase2-manual-root article');
    const right = document.querySelector('#phase2-hook-root article');
    right.querySelector('[data-state-action="increment"]').click();
    expect(document.querySelector('#phase2-manual-root article')).toBe(left);
    expect(document.querySelector('#phase2-hook-root article')).toBe(right);
    expect(fields('phase2-hook-root')).toEqual(fields('phase2-manual-root'));
    expect(fields('phase2-hook-root')[0]).toBe('1');
    expect(JSON.parse(value('state-hooks'))).toEqual([0, '정글']);
  });
  it('명시적으로 선택한 갱신 누락 실수만 재현하고 끄면 정상 복원한다', () => {
    const omit = document.querySelector('#phase2-omit-summary');
    expect(omit.checked).toBe(false);
    omit.checked = true;
    omit.dispatchEvent(new Event('change'));
    document.querySelector('#phase2-count-button').click();
    expect(fields('phase2-manual-root')).toEqual([
      '1',
      '2',
      '정글님의 현재 숫자는 0입니다.',
    ]);
    expect(fields('phase2-hook-root')).toEqual([
      '1',
      '2',
      '정글님의 현재 숫자는 1입니다.',
    ]);
    expect(value('phase2-comparison-status')).toContain('불일치');
    omit.checked = false;
    omit.dispatchEvent(new Event('change'));
    expect(fields('phase2-hook-root')).toEqual(fields('phase2-manual-root'));
    expect(value('phase2-comparison-status')).toContain('일치');
  });
  it('직접 해제와 Effect cleanup 모두 실제 외부 구독을 정리한다', () => {
    const notify = document.querySelector('#phase2-notify-button');
    const toggle = document.querySelector('#phase2-toggle-button');
    expect(value('phase2-manual-active')).toBe('1');
    expect(value('phase2-hook-active')).toBe('1');
    notify.click();
    expect(value('phase2-manual-received')).toBe('1');
    expect(value('phase2-hook-received')).toBe('1');
    toggle.click();
    expect(document.querySelector('#phase2-manual-root').children).toHaveLength(
      0,
    );
    expect(document.querySelector('#phase2-hook-root').children).toHaveLength(
      0,
    );
    expect(value('phase2-manual-active')).toBe('0');
    expect(value('phase2-hook-active')).toBe('0');
    notify.click();
    expect(value('phase2-manual-received')).toBe('1');
    expect(value('phase2-hook-received')).toBe('1');
    expect(value('phase2-hook-trace')).toContain('정리');
    toggle.click();
    notify.click();
    expect(value('phase2-manual-received')).toBe('1');
    expect(value('phase2-hook-received')).toBe('1');
    expect(value('phase2-hook-active')).toBe('1');
  });
  it('반복 초기화가 클릭과 구독을 중복 등록하지 않는다', () => {
    const reset = document.querySelector('#phase2-reset-button');
    reset.click();
    reset.click();
    document.querySelector('#phase2-count-button').click();
    expect(fields('phase2-hook-root')[0]).toBe('1');
    expect(value('phase2-plain-count')).toBe('2');
    expect(value('phase2-memo-count')).toBe('2');
    document.querySelector('#phase2-notify-button').click();
    expect(value('phase2-hook-received')).toBe('1');
  });
});

it('성능 실험은 세 방식의 결과와 검사량을 비교하고 조건 변경 시 캐시도 다시 계산한다', async () => {
  document.querySelector('#phase2-perf-size').value = '1000';
  const run = document.querySelector('#phase2-perf-run');
  run.click();
  expect(run.disabled).toBe(true);
  await vi.waitFor(() =>
    expect(document.querySelector('#phase2-perf-status').textContent).toContain(
      '측정 완료',
    ),
  );
  expect(value('perf-plain-visits')).toBe('20,000개');
  expect(value('perf-manual-cache-visits')).toBe('0개');
  expect(value('perf-memo-visits')).toBe('0개');
  expect(value('perf-memo-retained')).toBe('8,000 B');
  expect(value('perf-plain-retained')).toBe('0 B');
  expect(
    new Set(
      ['plain', 'manual-cache', 'memo'].map((mode) =>
        value(`perf-${mode}-result`),
      ),
    ).size,
  ).toBe(1);
  expect(run.disabled).toBe(false);
  document.querySelector('#phase2-perf-action').value = 'threshold';
  run.click();
  await vi.waitFor(() => expect(run.disabled).toBe(false));
  for (const mode of ['plain', 'manual-cache', 'memo'])
    expect(value(`perf-${mode}-visits`)).toBe('20,000개');
  expect(value('phase2-perf-context')).toContain('기준 점수');
});
