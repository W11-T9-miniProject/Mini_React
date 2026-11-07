import { describe, it, expect } from 'vitest';
import { createScoreRunner } from '../src/playground/phase2-performance.js';

const modes = ['plain', 'manual-cache', 'memo'];
const data = Float64Array.from([100, 500, 700, 900]);
const create = (mode) =>
  createScoreRunner(mode, data, document.createElement('div'));

describe('실제 점수 계산 비교', () => {
  it('이름만 바꾸면 캐시 방식은 검사와 버퍼 생성을 생략하고 같은 결과를 낸다', () => {
    const runners = modes.map(create);
    for (const runner of runners) {
      runner.change('name');
      runner.change('name');
    }
    expect(runners.map((r) => r.result())).toEqual(
      Array(3).fill('정글 · 기준 500점 · 3명 · 평균 700.00점'),
    );
    expect(runners.map((r) => r.metrics().calculations)).toEqual([2, 0, 0]);
    expect(runners.map((r) => r.metrics().visits)).toEqual([8, 0, 0]);
    expect(runners.map((r) => r.metrics().allocatedBytes)).toEqual([64, 0, 0]);
    expect(runners.map((r) => r.metrics().retainedBytes)).toEqual([0, 32, 32]);
    for (const runner of runners) runner.dispose();
  });
  it('계산 조건을 바꾸면 세 방식 모두 같은 데이터 전체를 다시 검사한다', () => {
    const runners = modes.map(create);
    for (const runner of runners) runner.change('threshold');
    expect(runners.map((r) => r.result())).toEqual(
      Array(3).fill('정글 · 기준 501점 · 2명 · 평균 800.00점'),
    );
    for (const runner of runners) {
      expect(runner.metrics()).toMatchObject({
        calculations: 1,
        visits: 4,
        allocatedBytes: 32,
      });
      expect(runner.metrics().totalMs).toBeGreaterThanOrEqual(0);
      expect(runner.metrics().computeMs).toBeGreaterThanOrEqual(0);
      runner.dispose();
      expect(runner.metrics().retainedBytes).toBe(0);
    }
  });
  it('여러 변경 후에도 결과가 같고 측정 초기화는 캐시를 유지한다', () => {
    const runners = modes.map(create);
    for (const runner of runners) {
      runner.change('name');
      runner.change('threshold');
      runner.change('name');
      runner.resetMetrics();
      runner.change('name');
    }
    expect(new Set(runners.map((r) => r.result())).size).toBe(1);
    expect(runners.map((r) => r.metrics().visits)).toEqual([4, 0, 0]);
    for (const runner of runners) runner.dispose();
  });
});
