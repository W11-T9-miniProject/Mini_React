const allowedTags = new Set(
  'article section div p span h1 h2 h3 h4 h5 h6 ul ol li strong em b i u br hr button a pre code blockquote'.split(
    ' ',
  ),
);

export function setupEditor(container, status) {
  const editor = document.querySelector('#html-editor');
  const button = document.querySelector('#apply-html-button');
  const refresh = () => {
    editor.value =
      container.querySelector('[data-sample-root]')?.outerHTML ?? '';
  };

  refresh();
  container.addEventListener('input', refresh);
  container.addEventListener('paste', (event) => {
    event.preventDefault();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const text = document.createTextNode(
      event.clipboardData?.getData('text/plain') ?? '',
    );
    range.insertNode(text);
    range.setStartAfter(text);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    container.dispatchEvent(new Event('input', { bubbles: true }));
  });
  button.addEventListener('click', () => {
    try {
      const template = document.createElement('template');
      template.innerHTML = editor.value;
      const nodes = Array.from(template.content.childNodes).filter(
        (node) =>
          node.nodeType !== Node.COMMENT_NODE &&
          !(node.nodeType === Node.TEXT_NODE && node.textContent.trim() === ''),
      );
      if (nodes.length !== 1 || nodes[0].nodeType !== Node.ELEMENT_NODE) {
        throw new Error('전체를 감싸는 HTML 요소 하나가 필요합니다.');
      }

      const root = nodes[0];
      validateSample(root);

      root.setAttribute('data-sample-root', '');
      container.replaceChildren(root);
      refresh();
      status.textContent =
        '미리보기에 적용했습니다. Patch를 누르면 실제 영역에 반영됩니다.';
    } catch (error) {
      status.textContent = `HTML 편집 오류: ${error.message}`;
    }
  });

  return refresh;
}

export function validateSample(root) {
  const reservedIds = new Set([
    'app',
    'actual-root',
    'test-root',
    'html-editor',
    'patch-output',
    'patch-button',
    'undo-button',
    'redo-button',
    'apply-html-button',
  ]);
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (
      element.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
      !allowedTags.has(element.localName)
    ) {
      throw new Error(`현재 지원하지 않는 태그입니다: ${element.localName}`);
    }
    for (const attribute of element.attributes) {
      const name = attribute.name;
      const allowed =
        ['id', 'class', 'title', 'role', 'type', 'disabled'].includes(name) ||
        name.startsWith('data-') ||
        name.startsWith('aria-');
      if (!allowed) throw new Error(`현재 지원하지 않는 속성입니다: ${name}`);
      if (name === 'id' && reservedIds.has(attribute.value)) {
        throw new Error(
          `화면 제어용 id는 사용할 수 없습니다: ${attribute.value}`,
        );
      }
    }
  }
}
