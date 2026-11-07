function element(tag, props, children) {
  return {
    type: 'element',
    tag,
    props,
    children: children.map((child) =>
      typeof child === 'object'
        ? child
        : { type: 'text', value: String(child) },
    ),
  };
}

export const summaryText = (count, name) =>
  `${name}님의 현재 숫자는 ${count}입니다.`;

// 자식은 상태 없이 props로 전달받은 값만 화면 구조로 만든다.
function Summary({ count, name }) {
  return element('p', { 'data-summary': '' }, [summaryText(count, name)]);
}

export function createCounterView({ count, name, doubled, buttonPrefix = '' }) {
  const buttonProps = (action, suffix) => ({
    type: 'button',
    'data-state-action': action,
    ...(buttonPrefix ? { id: `${buttonPrefix}-${suffix}-button` } : {}),
  });
  return element('article', {}, [
    element('h3', {}, ['숫자와 이름']),
    element('p', {}, [
      '현재 숫자: ',
      element('strong', { 'data-count': '' }, [count]),
    ]),
    element('p', {}, [
      '숫자의 두 배: ',
      element('strong', { 'data-double': '' }, [doubled]),
    ]),
    Summary({ count, name }),
    element('div', { class: 'state-actions' }, [
      element('button', buttonProps('increment', 'count'), ['숫자 +1']),
      element('button', buttonProps('rename', 'name'), ['이름 바꾸기']),
    ]),
  ]);
}
