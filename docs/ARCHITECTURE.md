# 설계와 모듈 계약

## 노드 캐릭터 관찰

메인 진입점은 `characters/journey.js`입니다. `journey-view.js`가 만든 영구 DOM 마운트에 초기 화면을 구성하고, 사용자가 읽기를 누를 때 `domToVNode`로 기존 VDOM을 만듭니다. key는 DOM 속성이 아니므로 DOM 노드 참조별 WeakMap으로 보존합니다. 초안 변경은 신규 VDOM만 수정합니다. 실제 `diff()` 결과와 `diff-trace.js`의 대응 노드 순회를 함께 사용해 비교를 표시하며, Patch 캐릭터는 전체 비교 완료 후에만 활성화합니다. 클릭 후 배달 타이머가 끝날 때 실제 `patch(root, patches)`를 실행하고 신규 VDOM을 다음 기준으로 저장합니다. Reset·종료는 자동 비교와 배달을 취소합니다.

State +3은 별도 함수형 루트에서 실제 useState·useMemo·microtask 배칭으로 신규 VDOM을 생성합니다. 이 루트의 내부 DOM은 메인 화면의 대상 DOM과 독립적이며, 메인 DOM은 동일한 Patch 배달 게이트로만 변경됩니다. 메인 이야기는 아래 완료 기록 재생 관찰기와 독립적입니다.

`characters/scene.js`는 `record({source, stream, label, previous, next, patches, root, renderCount, memoRuns})`로 컨트롤러의 완료된 실행을 받습니다. source는 Phase 필터, stream은 실제 DOM 루트별 최신 기록 식별에 사용합니다. 함수 props를 설명 문자열로 바꾼 별도 스냅샷을 32개까지 보관하며, 실제 루트 참조는 stream별 최신 것만 보관합니다. VDOM/History/DOM 속성을 수정하지 않고 외부 overlay로 요소를 강조합니다. Patch 경로는 이전 트리 기준이며 고유 key 형제의 대응 관계를 시각화에 사용합니다.

`characters/world.js`는 같은 공개 엔진 API를 사용하는 작은 Phase 1 실험과 Phase 2 Hook 실험을 구성합니다. 기존 Playground와 Demo도 동일한 관찰기에 기록하지만 상태와 History는 독립적입니다. 런타임 onCommit은 기존 진단 값에 previous/next/root를 추가하며 Effect 실행 뒤에 호출됩니다. 캐릭터 단계 재생은 실행 후 설명이고 엔진의 중간 상태나 브라우저 paint 측정값이 아닙니다.

관찰 화면은 부모·자식을 가지로 연결한 하나의 트리 무대입니다. 새 VDOM 버전은 무대 밖에서 들어오고 이전 버전은 퇴장합니다. TEXT/PROPS의 버전 교대는 실제 DOM 교체를 뜻하지 않습니다. MOVE는 같은 캐릭터를 유지하며 좌표만 이동합니다. `follow: true` 기록은 사용자가 누른 Node World 실험을 즉시 보여주고, 다른 Phase의 자동 갱신은 현재 관찰 선택을 보존합니다.

`characters/comparison.js`는 이전/다음 VDOM 트리와 관찰용 실제 DOM을 나란히 보여줍니다. 원본 앱의 완료된 실행을 기록에서 재생하므로 원본 DOM을 되돌리거나 이벤트 함수를 다시 실행하지 않습니다. 비교 단계까지는 이전 DOM을 유지하고 적용 단계에서 공개 엔진으로 부분 갱신합니다. 표시용 스냅샷의 이벤트 props를 제외한 안전한 VDOM끼리 Diff하므로 이벤트 전용 Patch 개수와 관찰 DOM에 적용하는 Patch 개수는 다를 수 있습니다. 재사용·추가·제거 정보는 재생 전후 DOM 참조 비교에서 얻습니다.

Node World의 `direct-render.js`는 별도 비교군이다. 평범한 데이터 객체에서 `document.createElement`로 DOM을 만들고 매번 전체 하위 트리를 교체한다. 실제 Patch 대상 DOM을 건드리지 않으며, 같은 학습 조작에서 재생성되는 DOM 개수를 보여준다. 이 비교군은 Mini React 렌더러나 VDOM을 사용하지 않고, 성능 벤치마크라고 주장하지 않는다.

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

Patch는 TEXT / PROPS / REPLACE / INSERT / REMOVE / MOVE 여섯 종류다.

- path는 변경 전 트리의 요소/텍스트 자식 인덱스 배열이다.
- []는 루트다.
- INSERT만 path가 부모를 가리키며 index는 다음 트리에서의 자식 위치다.
- MOVE의 path는 이동할 기존 노드를 가리키며 index는 다음 트리에서의 자식 위치다.
- 부모를 교체하면 그 아래 Patch를 만들지 않는다.
- 인덱스 비교는 공통 길이까지 재귀 비교하고 초과 자식을 삭제하거나 추가한다.
- 삭제는 뒤에서부터, 추가는 다음 index 오름차순이다.
- Patch는 실행 전에 모든 대상 노드 참조를 찾아둔다.
- 구조/텍스트 변경 후 속성을 적용한다. 속성은 깊은 노드부터 적용하여 option이 바뀐 뒤 select.value를 반영한다.
- select 자식 변경 시 value가 같아도 선택 상태를 재동기화한다.

이전과 다음의 형제 목록에 모두 고유한 `props.key`가 있으면 key로 자식을 대응시킨다. 같은 key와 태그의 요소는 이전 경로를 기준으로 비교하고 필요한 경우 기존 DOM을 이동한다. key가 없거나 일부에만 있거나 중복되면 목록 전체를 인덱스로 비교한다. 이 경우 맨 앞에 항목을 추가하면 기존 항목의 내용을 바꾸고 끝에 새 노드를 삽입할 수 있다.

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

useEffect는 렌더 중 실행하지 않고 다음 commit 후보로 기록한다. VDOM 렌더나 Patch가 실패하면 후보를 버리고 의존성을 확정하지 않는다. DOM commit 뒤 이전 cleanup → 새 effect를 실행한다. cleanup/effect 오류는 모아 보고하되 나머지 effect와 commit 기록을 계속 처리한다. Unmount는 모든 cleanup을 시도하고 DOM과 인스턴스를 정리한 뒤 오류가 있으면 AggregateError를 던진다. 이 구현은 commit 직후 동기 실행하며 실제 React의 passive Effect 스케줄링과 다르다.

Effect에서 interval을 등록할 때 cleanup에서 clearInterval한다. JSX/useCallback/useRef 등은 구현하지 않는다. Effect 안에서 비동기 처리를 한다면 취소/무시 로직을 cleanup에 직접 작성해야 한다.

## 편집과 보안 범위

HTML 코드는 template에서 파싱해 허용 태그/속성/URL 정책을 확인한 뒤 테스트 DOM에 적용한다. 파싱 오류 시 실제 DOM과 이력은 건드리지 않는다. 직접 편집의 붙여넣기는 일반 텍스트만 삽입하고 HTML 드롭은 차단한다. 편집 영역 링크는 이동하지 않는다.

허용 태그는 editor.js에 명시되어 있다. style과 script/iframe/인라인 이벤트 등은 제한한다. 이 검사는 로컬 학습 도구의 동작 범위를 제한하는 것이며, 서비스용 HTML sanitizer를 대체한다는 보장은 없다.

Observer는 테스트 DOM의 구조/텍스트/속성 변화를 관찰해 진단 표시만 갱신한다. 실제 영역에 자동 commit하지 않으므로 관찰 → 렌더 → 관찰의 무한 루프를 만들지 않는다. input.value 같은 프로퍼티 변화는 MutationObserver가 전부 감지하지 못하므로 input 이벤트에서도 상태를 읽는다.
