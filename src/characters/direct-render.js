/** Render a small UI with DOM APIs only, replacing its entire subtree. */
export function renderDirectly(host, model) {
  const doc = host.ownerDocument;
  const root = doc.createElement('section');
  root.className = `jv-direct-root${model.accent ? ' accent' : ''}`;

  const heading = doc.createElement(model.headingTag);
  heading.textContent = model.greeting;
  root.append(heading);

  const list = doc.createElement('ul');
  for (const friend of model.friends) {
    const item = doc.createElement('li');
    item.textContent = friend;
    list.append(item);
  }
  root.append(list);

  const counter = doc.createElement('p');
  counter.className = 'journey-counter';
  counter.textContent = `State ${model.count} · Memo ×2 = ${model.memo}`;
  root.append(counter);

  const previousNodes = Array.from(host.childNodes).reduce(
    (total, child) => total + countNodes(child),
    0,
  );
  const createdNodes = countNodes(root);
  host.replaceChildren(root);
  return {
    created: createdNodes,
    removed: previousNodes,
    reused: 0,
    root,
  };
}

function countNodes(root) {
  if (!root) return 0;
  let total = 1;
  for (const child of root.childNodes) total += countNodes(child);
  return total;
}
