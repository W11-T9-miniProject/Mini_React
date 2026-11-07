import { afterEach, describe, it, expect, vi } from 'vitest';
import html from '../index.html?raw';
import { setupApplication } from '../src/bootstrap.js';

let application;
afterEach(() => application?.destroy());
describe('페이지 전체 기능', () => {
  it('메뉴 전환, 컴포넌트 unmount/remount, 브라우저 검사 버튼이 동작한다', async () => {
    document.body.innerHTML = html.match(
      /<body>([\s\S]*)<script type="module"/,
    )[1];
    application = setupApplication();
    document.querySelector('[data-view="phase2"]').click();
    expect(document.getElementById('phase1').hidden).toBe(true);
    expect(document.getElementById('phase2').hidden).toBe(false);
    document.getElementById('mount-toggle').click();
    expect(document.getElementById('component-root').childNodes).toHaveLength(
      0,
    );
    document.getElementById('mount-toggle').click();
    expect(
      document.querySelectorAll('#component-root .task-item'),
    ).toHaveLength(3);
    document.querySelector('[data-view="guide"]').click();
    expect(document.getElementById('guide').hidden).toBe(false);
    document.getElementById('run-self-tests').click();
    await vi.waitFor(() =>
      expect(document.getElementById('self-test-output').textContent).toContain(
        '12 / 12 통과',
      ),
    );
    expect(document.getElementById('run-self-tests').disabled).toBe(false);
    expect(
      document.querySelectorAll('#component-root .task-item'),
    ).toHaveLength(3);
  });
});
