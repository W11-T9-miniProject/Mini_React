import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = readFileSync('index.html', 'utf8').match(
    /<body>([\s\S]*)<\/body>/,
  )[1];
  await import('../src/main.js');
});

it('앞에 상품을 추가해도 key 쪽의 마우스 DOM과 사용자가 쓴 메모를 유지한다', () => {
  const mouse = document.querySelector(
    '#key-stable-root [data-product="mouse"]',
  );
  mouse.querySelector('input').value = '내가 쓴 메모';
  document.querySelector('#key-prepend').click();
  expect(
    document.querySelector('#key-stable-root').children[0].children[1],
  ).toBe(mouse);
  expect(mouse.querySelector('input').value).toBe('내가 쓴 메모');
  expect(document.querySelector('#key-stable-memo').textContent).toBe(
    '내가 쓴 메모',
  );
  expect(document.querySelector('#key-position-memo').textContent).toBe(
    '업무용',
  );
  expect(document.querySelector('#key-status').textContent).toContain('일치');
  expect(document.querySelector('#key-stable-commands').textContent).toBe(
    'INSERT 1개',
  );
});

it('순서 뒤집기는 기존 요소를 이동하며 삭제·초기화·빈 목록 이후에도 정상 작동한다', () => {
  const mouse = document.querySelector(
    '#key-stable-root [data-product="mouse"]',
  );
  document.querySelector('#key-reverse').click();
  expect(document.querySelector('#key-stable-root ul').lastChild).toBe(mouse);
  expect(document.querySelector('#key-stable-commands').textContent).toContain(
    'MOVE',
  );
  document.querySelector('#key-remove').click();
  document.querySelector('#key-remove').click();
  expect(document.querySelector('#key-stable-root ul').children).toHaveLength(
    0,
  );
  expect(document.querySelector('#key-remove').disabled).toBe(true);
  document.querySelector('#key-prepend').click();
  expect(document.querySelector('#key-stable-root ul').children).toHaveLength(
    1,
  );
  document.querySelector('#key-reset').click();
  document.querySelector('#key-reset').click();
  document.querySelector('#key-prepend').click();
  expect(document.querySelector('#key-stable-root ul').children).toHaveLength(
    3,
  );
});
