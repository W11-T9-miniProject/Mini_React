# Top-down으로 미니 리액트 공부하기

코드를 처음부터 끝까지 읽기보다 **사용자 행동 하나 → 호출 경로 → 데이터 변화 → 실제 DOM 수정** 순서로 확인하세요.

## 0. 실행하고 구조 보기

1. npm run dev로 실행한다.
2. 세 화면을 모두 눌러본다.
3. 코드 따라가기의 브라우저 검사 버튼을 실행한다.
4. npm test로 모듈/기능 테스트도 실행한다.
5. main.js → bootstrap.js → 각 Controller 순서로 시작점을 읽는다.

각 단계에서 “이 함수의 입력은 무엇인가, 반환값은 무엇인가, 실제 DOM을 바꾸는가?”를 말로 답해보세요.

## 1. TEXT 변경 한 번을 끝까지 추적

Phase 1 HTML 편집기를 다음 내용으로 바꾸고 Patch합니다.

```html
<p>안녕</p>
```

다시 “반가워”로 바꿉니다. Patch 전에는 실제 영역이 그대로임을 확인하세요. 개발자 도구 Sources에서 controller.js의 commit에 중단점을 걸고 Patch를 누릅니다.

```text
commit
  previous = history.current()
  next = domToVNode(testRoot)
  patches = diff(previous, next)
  actualRoot = patch(actualRoot, patches)
  history.push(next)
```

샘플 루트는 고정 div이므로 변경 목록의 텍스트 경로는 [0, 0]입니다.

- [0]: 루트 div의 첫 자식 p
- [0, 0]: p의 첫 자식 텍스트

domToVNode.js에서 nodeType 확인 → 재귀 변환을 읽습니다. diff.js에서 두 노드가 같은 element면 자식을 비교하는 부분을 따라갑니다. patch.js에서 TEXT의 nodeValue 대입을 찾습니다.

**이해 확인:** p 자체를 새로 만들지 않아도 문장을 바꿀 수 있는 이유는 무엇인가?

## 2. 나머지 네 케이스 만들기

각 변경 뒤 Patch 목록에서 타입과 path를 확인합니다.

| 행동                     | 기대    |
| ------------------------ | ------- |
| p에 title 추가/수정/삭제 | PROPS   |
| p를 h2로 변경            | REPLACE |
| 맨 뒤에 span 추가        | INSERT  |
| 맨 뒤 span 삭제          | REMOVE  |

목록 앞에 항목을 삽입해 보세요. 이 엔진은 key 기반 비교를 하지 않기 때문에 하나의 INSERT 외에 TEXT 변경도 생길 수 있습니다.

**이해 확인:** 결과가 정확한 것과 변경 횟수가 최소인 것은 왜 다른가?

patch.test.js의 연속 삭제와 참조 유지 테스트를 읽습니다. 대상 참조를 먼저 확보하는 이유를 손으로 세 자식의 인덱스를 그리며 설명해 보세요.

## 3. History 따라가기

A → B → C 상태를 차례로 저장합니다. B로 돌아간 뒤 D를 저장합니다.

```text
이전: [A, B, C], cursor = 1
이후: [A, B, D], cursor = 2
```

history.js에서 slice와 snapshot을 확인합니다. 그 다음 Controller의 travel을 읽습니다.

테스트 영역을 수정하되 Patch하지 않은 채 뒤로 이동해 보세요. 테스트 영역은 현재 DOM을 다시 읽어 목표 상태로 맞춥니다.

**이해 확인:** DOM 노드 대신 VDOM을 저장하는 이유와, freeze 없이 과거 객체를 수정했을 때의 문제는?

## 4. 작업 추가로 State와 Batching 추적

Phase 2에서 새 작업을 입력합니다. app.js의 add에 중단점을 겁니다.

```text
submit
→ setTasks(previous => 새 배열)
→ setDraft('')
→ schedule()에서 microtask 하나 예약
→ FunctionComponent.update()
→ App(props) 재실행
→ diff(previousVNode, nextVNode)
→ patch(root, patches)
→ Effect 정리/실행
```

hooks.js의 useState와 slot을 읽습니다. 렌더마다 함수의 지역변수는 새로 만들어져도 FunctionComponent 인스턴스의 hooks 배열은 남습니다.

상태를 직접 push하지 않고 새 배열을 만드는 이유도 확인하세요. Object.is가 같은 배열 참조를 받으면 갱신을 생략합니다.

**이해 확인:** setState의 역할은 값 저장 외에 무엇인가? +3 버튼은 왜 화면을 한 번만 갱신하는가?

## 5. useMemo 확인

App에는 두 Memo가 있습니다.

- stats: [tasks]
- visible: [tasks, filter, query]

타이머를 시작하면 ticks는 바뀌지만 의존성이 그대로이므로 Memo 계산 횟수는 유지됩니다. 새 작업을 추가하면 tasks 배열이 바뀌어 둘 다 다시 계산합니다.

**이해 확인:** useMemo 의존성에 tasks를 빼면 무엇이 잘못될까? 객체를 같은 참조로 수정하면 어떤 문제가 생길까?

## 6. useEffect와 Cleanup 확인

타이머 시작 → 정지 → 시작 → Unmount를 실행하고 로그를 봅니다.

```text
running false → true: interval 등록
running true → false: 이전 interval 해제 → 정지 Effect
Unmount: 남은 cleanup 실행
```

hooks.js는 pending을 표시하고 FunctionComponent.update가 DOM commit 뒤 실행합니다. unmount에서는 마지막 cleanup을 실행합니다.

**이해 확인:** cleanup 없이 재시작할 때마다 interval을 추가하면 어떤 일이 생길까?

## 7. 자식 컴포넌트 보기

components.js의 TaskItem과 StatCard를 읽습니다. 이 함수들은 Hook 없이 props만 사용합니다.

완료 클릭 시 TaskItem이 직접 상태를 갖는 대신 props의 onToggle(task.id)을 호출합니다. 실제 상태 변경은 App에서 수행합니다.

```text
TaskItem 이벤트 → 부모가 전달한 callback → App의 setTasks → 전체 루트 함수 재실행
```

**이해 확인:** 루트를 다시 실행하는 것과 실제 DOM을 전부 교체하는 것은 어떻게 다른가?

## 8. 직접 수정해보기

AI 설명을 읽은 뒤 작은 기능 하나를 직접 바꾸고 테스트를 추가해 보세요.

1. 완료율 옆에 남은 작업 수 표시
2. 작업을 역순으로 표시하는 필터 추가
3. Phase 1에 마지막 Patch 타입별 개수 표시
4. 타이머에 10초 단위 진행 메시지 Effect 추가
5. [] / 의존성 생략 Effect를 추가하고 로그 비교

변경 전에 담당 파일과 데이터 흐름을 먼저 예상하세요. 변경 후 npm run check와 브라우저 내장 검사를 실행합니다.

## 발표할 때 꼭 구분하기

- Virtual DOM은 실제 DOM의 참조가 아니라 UI를 표현한 데이터다.
- Diff는 변경을 계산하고 Patch가 브라우저 API로 실제 변경한다.
- 루트 함수가 재실행되어도 실제 DOM은 변경된 부분만 수정된다.
- Hook은 함수 지역변수가 아니라 인스턴스의 슬롯 배열에 값을 저장한다.
- 인덱스 기반 비교는 올바른 결과를 만들지만 key 기반 이동 최적화는 없다.
- DOM 작업/레이아웃 읽기를 줄이는 설계와 “항상 더 빠르다”는 주장은 다르다.
- 실제 React는 Fiber/스케줄링/자식별 상태 등 훨씬 많은 기능을 제공한다.
