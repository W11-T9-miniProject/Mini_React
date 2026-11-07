import { h } from '../runtime/index.js';

// 자식 컴포넌트는 Hook/State 없이 props만 읽는 순수 함수다.
export function StatCard({ label, value, detail }) {
  return h(
    'div',
    { class: 'stat-card' },
    h('span', {}, label),
    h('strong', {}, value),
    h('small', {}, detail),
  );
}
export function TaskItem({ task, onToggle, onDelete }) {
  return h(
    'li',
    {
      class: 'task-item' + (task.done ? ' done' : ''),
      'data-task-id': task.id,
    },
    h(
      'label',
      {},
      h('input', {
        type: 'checkbox',
        checked: task.done,
        onChange: () => onToggle(task.id),
        'aria-label': task.text + ' 완료',
      }),
      h('span', {}, task.text),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'icon-button',
        onClick: () => onDelete(task.id),
        'aria-label': task.text + ' 삭제',
      },
      '삭제',
    ),
  );
}
