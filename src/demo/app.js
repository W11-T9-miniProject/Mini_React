import { h, useState, useEffect, useMemo } from '../runtime/index.js';
import { StatCard, TaskItem } from './components.js';

const initialTasks = [
  { id: 1, text: 'Phase 1에서 문장 바꾸고 Patch 눌러보기', done: true },
  { id: 2, text: '상태 변경과 부분 업데이트 추적하기', done: false },
  { id: 3, text: 'Effect 정리와 useMemo 계산 확인하기', done: false },
];

/** 모든 상태와 Hook은 이 루트 함수에만 존재한다. */
export function App({ logEffect, idPrefix = '' }) {
  const [tasks, setTasks] = useState(() =>
    initialTasks.map((task) => ({ ...task })),
  );
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [ticks, setTicks] = useState(0);
  const [running, setRunning] = useState(false);

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.done).length;
    return {
      total: tasks.length,
      completed,
      percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    };
  }, [tasks]);
  const visible = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (filter === 'all' || (filter === 'done' ? task.done : !task.done)) &&
          task.text.toLowerCase().includes(query.toLowerCase()),
      ),
    [tasks, filter, query],
  );

  useEffect(() => {
    logEffect('Effect: 완료 수 ' + stats.completed + ' → 문서 제목 업데이트');
    const before = document.title;
    document.title =
      'Mini React · ' + stats.completed + '/' + stats.total + ' 완료';
    return () => {
      document.title = before;
      logEffect('Cleanup: 이전 문서 제목 복원');
    };
  }, [stats.completed, stats.total]);

  useEffect(() => {
    if (!running) {
      logEffect('Effect: 타이머 정지 상태');
      return;
    }
    logEffect('Effect: interval 등록');
    const timer = setInterval(() => setTicks((value) => value + 1), 1000);
    return () => {
      clearInterval(timer);
      logEffect('Cleanup: interval 해제');
    };
  }, [running]);

  function add(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setTasks((previous) => [
      ...previous,
      { id: Math.max(0, ...previous.map((t) => t.id)) + 1, text, done: false },
    ]);
    setDraft(''); // 같은 이벤트의 두 setter는 한 번의 update로 배칭된다.
  }
  const toggle = (id) =>
    setTasks((previous) =>
      previous.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
  const remove = (id) =>
    setTasks((previous) => previous.filter((task) => task.id !== id));
  return h(
    'div',
    { class: 'task-app' },
    h(
      'div',
      { class: 'stats-grid' },
      h(StatCard, {
        label: '전체 작업',
        value: stats.total,
        detail: '루트의 useState',
      }),
      h(StatCard, {
        label: '완료율',
        value: stats.percent + '%',
        detail: 'useMemo([tasks])',
      }),
      h(StatCard, {
        label: '집중 타이머',
        value: ticks + 's',
        detail: 'useEffect([running])',
      }),
    ),
    h(
      'form',
      { class: 'task-form', onSubmit: add },
      h('input', {
        id: idPrefix + 'task-draft',
        value: draft,
        onInput: (event) => setDraft(event.target.value),
        placeholder: '새로 할 일을 입력하세요',
        'aria-label': '새 할 일',
        maxlength: '120',
      }),
      h(
        'button',
        { type: 'submit', class: 'primary', disabled: !draft.trim() },
        '추가',
      ),
    ),
    h(
      'div',
      { class: 'task-tools' },
      h('input', {
        id: idPrefix + 'task-search',
        value: query,
        onInput: (event) => setQuery(event.target.value),
        placeholder: '작업 검색',
        'aria-label': '작업 검색',
      }),
      h(
        'select',
        {
          id: idPrefix + 'task-filter',
          value: filter,
          onChange: (event) => setFilter(event.target.value),
          'aria-label': '작업 필터',
        },
        h('option', { value: 'all' }, '전체'),
        h('option', { value: 'active' }, '진행 중'),
        h('option', { value: 'done' }, '완료'),
      ),
    ),
    h(
      'ul',
      { class: 'task-list', id: idPrefix + 'task-list' },
      visible.length
        ? visible.map((task) =>
            h(TaskItem, { task, onToggle: toggle, onDelete: remove }),
          )
        : h('li', { class: 'empty-state' }, '표시할 작업이 없습니다.'),
    ),
    h(
      'div',
      { class: 'task-footer' },
      h(
        'button',
        {
          type: 'button',
          id: idPrefix + 'timer-toggle',
          onClick: () => setRunning((value) => !value),
        },
        running ? '타이머 정지' : '타이머 시작',
      ),
      h(
        'button',
        { type: 'button', onClick: () => setTicks(0), disabled: ticks === 0 },
        '시간 초기화',
      ),
      h(
        'button',
        {
          type: 'button',
          id: idPrefix + 'batch-demo',
          onClick: () => {
            setTicks((v) => v + 1);
            setTicks((v) => v + 1);
            setTicks((v) => v + 1);
          },
        },
        '+3 배칭 테스트',
      ),
      h(
        'button',
        {
          type: 'button',
          onClick: () =>
            setTasks((previous) => previous.filter((task) => !task.done)),
          disabled: !stats.completed,
        },
        '완료 작업 삭제',
      ),
    ),
    h(
      'p',
      { class: 'hint' },
      '타이머가 흐를 때 memo 계산 횟수는 유지됩니다. +3은 상태를 세 번 변경하지만 한 번 렌더링합니다.',
    ),
  );
}
