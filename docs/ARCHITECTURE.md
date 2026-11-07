# 설계와 모듈 계약

## 책임 경계

- vdom: DOM과 VDOM 변환 및 변경 계산/적용. 페이지 ID와 History를 모른다.
- history: 직렬화 가능한 Phase 1 VDOM의 스냅샷과 커서. DOM을 모른다.
- runtime: 함수형 루트를 실행하고 Hook 슬롯과 갱신 주기를 관리한다.
- playground/demo: 사용자 이벤트와 엔진을 연결한다.
- bootstrap: 화면 선택과 전체 정리. main은 시작만 담당한다.

의존 방향은 화면 → runtime/history/vdom이며, 핵심 엔진이 화면을 import하지 않는다.

## VNode

```js
// 텍스트
{ type: 'text', value: '안녕 ' }

// 요소
{
  type: 'element',
  tag: 'p',
  props: { class: 'note' },
  children: [{ type: 'text', value: '안녕 ' }]
}
```

Phase 1 props에는 HTML 속성과 value/checked 등 현재 폼 프로퍼티가 들어간다. Phase 2에서는 onClick/onInput 같은 함수도 포함한다. className도 적용할 수 있지만 DOM에서 역변환할 때는 실제 HTML 속성명 class로 읽는다. 왕복 테스트에는 정규 HTML 속성명을 사용한다.

Hook/runtime용 VDOM과 DOM에서 읽은 VDOM은 이벤트 함수 표현이 다르므로 Phase 2에서는 실제 DOM을 역변환하여 이전 VDOM으로 쓰지 않는다. 이전 렌더의 VDOM을 인스턴스가 보관한다.

## API

```js
domToVNode(node); // → VNode
render(vnode); // → 새 Node. 특정 컨테이너에 붙이지 않음
diff(previous, next); // → Patch[]. 입력 변경/DOM 접근 없음
patch(root, patches); // → 현재 root. 교체될 수 있어 반환값 보관
createHistory(initial); // → current/push/undo/redo/canUndo/canRedo + index/length
h(tagOrFunction, props, ...children); // → VNode
new FunctionComponent(App, props).mount(container);
```

VNode는 일반 HTML 요소/텍스트를 지원한다. SVG 네임스페이스, Fragment 등은 범위 밖이다. 주석은 변환과 Patch 경로 양쪽에서 제외하며 공백 텍스트는 보존한다.

## Diff와 Patch

Patch는 TEXT / PROPS / REPLACE / INSERT / REMOVE 다섯 종류다.

- path는 변경 전 트리의 요소/텍스트 자식 인덱스 배열이다.
- []는 루트다.
- INSERT만 path가 부모를 가리키며 index는 다음 트리에서의 자식 위치다.
- 부모를 교체하면 그 아래 Patch를 만들지 않는다.
- 공통 길이까지 인덱스로 재귀 비교하고 초과 자식은 삭제/추가한다.
- 삭제는 뒤에서부터, 추가는 다음 index 오름차순이다.
- Patch는 실행 전에 모든 대상 노드 참조를 찾아둔다.
- 구조/텍스트 변경 후 속성을 적용한다. 속성은 깊은 노드부터 적용하여 option이 바뀐 뒤 select.value를 반영한다.
- select 자식 변경 시 value가 같아도 선택 상태를 재동기화한다.

인덱스 기반 알고리즘이므로 앞에 항목을 추가하면 기존 항목 텍스트를 수정하고 끝에 추가할 수도 있다. 결과는 정확하지만 DOM 이동 횟수가 최소라는 보장은 없다. key를 정의해도 이 버전에서는 재정렬에 사용하지 않는다.

노드 방문과 속성 비교 자체는 대략 트리 크기에 비례하지만, 현재 구현은 경로 배열 복사와 Patch 대상 경로 재탐색, childNodes 배열 생성 비용도 있다. 따라서 전체 구현을 모든 트리 형태에서 엄밀히 O(n) 또는 항상 실제 DOM보다 빠르다고 주장하지 않는다.

## DOM 속성과 이벤트

- render와 patch는 applyProps를 공유한다.
- 이벤트는 노드별 WeakMap에 저장하고 이전 리스너를 제거한 뒤 등록한다.
- 같은 함수 참조면 Diff에서 이벤트 Patch가 생기지 않는다.
- 루트 렌더에서 만든 새 화살표 함수는 이전과 참조가 달라 PROPS 변경으로 기록된다.
- value는 실제 프로퍼티에 반영하며 같으면 재대입하지 않아 입력 커서를 보존한다.
- checkbox.checked, disabled 등 boolean은 프로퍼티와 속성을 동기화한다.
- 단일 select는 option이 준비된 뒤 value를 적용한다.
- 이벤트는 루트 위임 방식이 아니라 각 노드에 직접 등록한다.

VDOM은 값이 바뀔 때마다 DOM을 전체 생성하는 비용을 줄일 수 있지만, 그 자체도 계산/메모리 비용이 있다. 실제 Reflow/Repaint는 DOM 변경 종류, 스타일, 브라우저의 렌더링 일정에 따라 달라진다. 이 구현은 DOM 노드 참조 유지와 변경 목록으로 부분 업데이트를 증명하며 Reflow 횟수를 측정했다고 주장하지 않는다.

## History

states 배열과 cursor로 관리한다. 입력을 structuredClone하고 재귀 freeze하여 과거 상태를 보호한다. 현재 위치 뒤의 이력을 잘라낸 후 새 상태를 저장한다. 경계에서 undo/redo는 현재 상태를 반환한다.

변경이 없는 상태를 push하지 않는 책임은 Controller에 있다. undo/redo 전에 현재 VDOM을 보관한 뒤 목표를 선택한다. 실제 영역은 보관한 VDOM, 테스트 영역은 현재 DOM을 읽은 VDOM과 목표를 비교한다. 미적용 편집과 오류가 있어도 이동하면 목표 이력으로 덮어쓴다.

## FunctionComponent와 Hook 슬롯

인스턴스가 hooks 배열을 보관하고 매 렌더 시작 시 hookIndex만 0으로 초기화한다. 함수 실행은 끝나도 인스턴스와 배열이 살아 있으므로 상태가 유지된다.

```text
App 실행 → useState → hooks[0]
         → useState → hooks[1]
         → useMemo  → hooks[2]
         → useEffect→ hooks[3]
```

Hook은 root 함수 실행 중에만 호출할 수 있다. h(Child, props)가 자식을 호출할 때 childDepth를 늘려 자식의 Hook 사용을 거부한다. Hook 종류와 개수 변경은 오류지만 같은 종류의 Hook 순서 교환은 검출할 수 없다. 자식은 반드시 h(Child, props) 경로로 호출하며 직접 Child()를 호출해 검사를 우회하지 않는다.

useState setter는 슬롯의 값을 Object.is로 비교해 갱신하고 schedule을 호출한다. 함수형 setter는 직전 슬롯 값으로 실행한다. 이 구현은 setter 시점에 슬롯 값을 즉시 계산한다. 실제 React의 업데이트 큐를 완전히 복제한 것은 아니다.

schedule은 Promise microtask 하나를 예약한다. 같은 턴의 setter가 여러 번 호출되어도 한 번 update한다. 렌더링 도중 setter는 오류다. Unmount 후 예약 갱신과 setter는 무시한다.

useMemo는 의존성 길이와 각 원소를 Object.is로 비교한다. undefined이면 매번 계산하고 []이면 mount 시 한 번 계산한다. 의존성 배열 자체는 복사하지만 객체 원소를 깊은 복사하지 않는다.

useEffect는 렌더 중 실행하지 않고 pending 표시를 한다. DOM commit 뒤 이전 cleanup → 새 effect를 실행한다. Unmount에서 마지막 cleanup을 한 번 실행한다. 이 구현은 commit 직후 동기 실행하며 실제 React의 passive Effect 스케줄링과 다르다.

Effect에서 interval을 등록할 때 cleanup에서 clearInterval한다. JSX/useCallback/useRef 등은 구현하지 않는다. Effect 안에서 비동기 처리를 한다면 취소/무시 로직을 cleanup에 직접 작성해야 한다.

## 편집과 보안 범위

HTML 코드는 template에서 파싱해 허용 태그/속성/URL 정책을 확인한 뒤 테스트 DOM에 적용한다. 파싱 오류 시 실제 DOM과 이력은 건드리지 않는다. 직접 편집의 붙여넣기는 일반 텍스트만 삽입하고 HTML 드롭은 차단한다. 편집 영역 링크는 이동하지 않는다.

허용 태그는 editor.js에 명시되어 있다. style과 script/iframe/인라인 이벤트 등은 제한한다. 이 검사는 로컬 학습 도구의 동작 범위를 제한하는 것이며, 서비스용 HTML sanitizer를 대체한다는 보장은 없다.

Observer는 테스트 DOM의 구조/텍스트/속성 변화를 관찰해 진단 표시만 갱신한다. 실제 영역에 자동 commit하지 않으므로 관찰 → 렌더 → 관찰의 무한 루프를 만들지 않는다. input.value 같은 프로퍼티 변화는 MutationObserver가 전부 감지하지 못하므로 input 이벤트에서도 상태를 읽는다.
