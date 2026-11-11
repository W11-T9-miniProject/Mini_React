import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Windows에서 자식 프로세스 시작 비용을 피하고 리소스 사용을 제한한다.
    pool: 'threads',
    maxWorkers: 1,
    testTimeout: 15000,
    environmentOptions: { jsdom: { url: 'http://localhost:5173' } },
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
  },
});
