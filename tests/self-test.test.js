import { it, expect } from 'vitest';
import { runBrowserChecks } from '../src/playground/self-test.js';
it('브라우저 내장 엔진 검사 12개를 모두 통과한다', async () => {
  const results = await runBrowserChecks();
  expect(results).toHaveLength(12);
  expect(results.filter((result) => !result.passed)).toEqual([]);
  expect(document.querySelector('[data-test-sandbox]')).toBeNull();
});
