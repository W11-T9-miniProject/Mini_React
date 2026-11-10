const describe = (patch) => {
  const path = patch.path.length ? patch.path.join('.') : '루트';
  switch (patch.type) {
    case 'TEXT':
      return `TEXT ${path}: ${JSON.stringify(patch.value)}`;
    case 'PROPS':
      return `PROPS ${path}: 설정 ${Object.keys(patch.set).join(', ') || '없음'}, 삭제 ${patch.remove.join(', ') || '없음'}`;
    case 'REPLACE':
      return `REPLACE ${path} → <${patch.node.tag ?? '#text'}>`;
    case 'INSERT':
      return `INSERT ${path}[${patch.index}] → <${patch.node.tag ?? '#text'}>`;
    case 'REMOVE':
      return `REMOVE ${path}`;
    case 'REORDER':
      return `REORDER ${path}: ${patch.children.map(({ key }) => String(key)).join(' → ')}`;
    default:
      return '알 수 없는 변경';
  }
};

export function showPatches(output, patches) {
  output.textContent = patches.length
    ? patches.map(describe).join('\n')
    : '변경 사항이 없습니다.';
}
