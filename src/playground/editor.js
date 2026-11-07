const allowed = new Set(
  'div article section header footer main aside nav h1 h2 h3 h4 h5 h6 p span strong em b i u s small mark code pre blockquote ul ol li dl dt dd a img br hr button input label textarea select option table thead tbody tfoot tr th td caption figure figcaption details summary time progress'.split(
    ' ',
  ),
);

/** 학습용 HTML 편집기는 허용 태그와 일반 속성만 받는다. 외부 HTML 실행을 막는다. */
export function parseHTML(source) {
  const template = document.createElement('template');
  template.innerHTML = source;
  for (const element of template.content.querySelectorAll('*')) {
    if (!allowed.has(element.localName))
      throw new Error('지원하지 않는 태그: ' + element.localName);
    for (const attribute of Array.from(element.attributes)) {
      if (
        /^on/i.test(attribute.name) ||
        ['srcdoc', 'is', 'formaction', 'contenteditable', 'autofocus'].includes(
          attribute.name,
        )
      ) {
        throw new Error(
          '실행/편집 제어 속성은 허용하지 않습니다: ' + attribute.name,
        );
      }
      if (
        ['href', 'src', 'action', 'poster', 'background'].includes(
          attribute.name,
        )
      ) {
        const url = new URL(attribute.value, location.href);
        if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol))
          throw new Error('허용되지 않는 URL 프로토콜입니다.');
      }
      if (['srcset', 'style'].includes(attribute.name))
        throw new Error(attribute.name + ' 대신 class 속성을 사용하세요.');
    }
    if (
      element.localName === 'input' &&
      ['file', 'password'].includes(element.type)
    )
      throw new Error('file/password 입력은 지원하지 않습니다.');
    if (element.localName === 'a') {
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_COMMENT,
  );
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((node) => node.remove());
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-sample-root', '');
  wrapper.append(template.content);
  return wrapper;
}

export function serializeContent(root) {
  const clone = root.cloneNode(true);
  const originals = root.querySelectorAll('input, textarea, select');
  clone
    .querySelectorAll('input, textarea, select')
    .forEach((element, index) => {
      const source = originals[index];
      if (element.localName === 'input') {
        element.setAttribute('value', source.value);
        element.toggleAttribute('checked', source.checked);
      } else if (element.localName === 'textarea')
        element.textContent = source.value;
      else
        Array.from(element.options).forEach((option) =>
          option.toggleAttribute('selected', option.value === source.value),
        );
    });
  return clone.innerHTML;
}
