import { afterEach, describe, it, expect } from 'vitest';
import html from '../index.html?raw';
import { setupApplication } from '../src/bootstrap.js';

let application;
afterEach(() => application?.destroy());

describe('단일 Node World 화면', () => {
  it('메뉴 없이 Node World와 두 렌더 비교기를 초기화한다', () => {
    document.body.innerHTML = html.match(
      /<body>([\s\S]*)<script type="module"/,
    )[1];
    application = setupApplication();

    expect(document.querySelector('.sidebar')).toBeNull();
    expect(document.querySelectorAll('[data-view]')).toHaveLength(0);
    expect(document.querySelector('#node-journey.jv-journey')).not.toBeNull();
    expect(
      document.querySelector('[data-journey="direct-dom"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-journey="instant-mode"]'),
    ).not.toBeNull();
  });
});
