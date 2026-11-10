# 선택 확장 설계 및 완료 계획

## 현재 상태

설계/구현 완료: Patch 대상 강조, 이력 타임라인 UI, key 기준 자식 재정렬, 편집 중/미적용 상태 표시, 상태 업데이트 batching. Diff는 key가 없거나 섞인 형제 목록에서 인덱스 기반 비교를 유지한다.

## 완료 조건과 규칙

### A. Patch 변경 노드 강조

- `patch(root, patches, options?)`는 기존처럼 갱신된 루트 `Node`를 반환하고, 선택적 `onPatched({ patch, node })` 콜백을 제공한다. 콜백은 전체 DOM 적용 뒤 실행한다. 하나가 실패해도 나머지 콜백은 실행하고 마지막에 `AggregateError`를 던진다.
- TEXT/PROPS 대상은 수정한 노드, REPLACE는 새 노드, INSERT는 삽입한 노드, REMOVE는 삭제된 노드의 부모를 콜백 대상으로 전달한다. 루트 REPLACE는 새 루트가 대상이다. 콜백의 TEXT 대상은 Text node 자체다.
- Controller는 Text node면 부모 Element, 그 외에는 대상 Element에 `patch-highlight` 클래스를 추가하고 800ms 뒤 제거한다. 같은 노드가 다시 강조되면 이전 타이머를 교체한다. 기존 class 토큰과 DOM 참조는 보존한다.
- 루트 참조를 교체해야 하면 기존과 동일하게 반환값을 보관한다.

### B. History 타임라인

- History는 `entries()`로 복사된 스냅샷 목록과 `index()`로 현재 위치를 읽고, `goTo(index)`로 유효한 정수 인덱스를 선택할 수 있다. 잘못된 인덱스는 `RangeError`; 기존 undo/redo의 경계 동작은 유지한다.
- 타임라인은 초기 상태부터 각 저장 상태를 `초기 상태`, `상태 1`, ... 버튼 목록으로 보여준다. 현재 항목은 `aria-current="step"`이며 비활성화한다. 클릭은 목표 스냅샷으로 이동한다.
- 이력 이동은 실제 영역을 현재 적용 상태에서 목표로 Patch하고, 테스트 영역은 목표 VNode를 Render한다. 이력 이동 뒤 미적용 편집은 사라진다. 새 push는 현재 위치 뒤의 미래 이력을 제거한다.
- 타임라인의 표시는 순서 라벨만 사용하며, 설명 텍스트/DOM은 History에 저장하지 않는다.

### C. key 기반 자식 재정렬

- 일반 VNode는 선택적인 최상위 `key` 필드를 갖는다. DOM 편집 Playground는 HTML의 `data-key` 값을 key로 읽으며 `data-key` 속성 자체도 그대로 보존한다. `h()`는 props의 `key`를 예약 키로 추출하여 VNode에 저장하고 DOM 일반 속성으로 쓰지 않는다.
- 한 부모의 모든 자식이 element이고 key가 있을 때에만 keyed reconciliation을 쓴다. 이외(텍스트 또는 key 없는 자식이 섞임)는 기존 인덱스 비교를 적용한다.
- sibling key는 빈 문자열이 아닌 문자열 또는 유한 숫자다. 비교할 때 `String(key)`로 정규화하므로 문자열 `"1"`과 숫자 `1`은 같은 key다. DOM `data-key`는 문자열로 읽는다. 같은 부모의 keyed 목록 중복 key는 모호성을 숨기지 않도록 `TypeError`로 거부한다. Positional fallback 목록에서는 key를 식별에 쓰지 않고 중복도 검사하지 않는다.
- 부모에 `REORDER` Patch 하나를 만든다. Patch에는 다음 자식 key 순서와 신규 자식 VNode가 포함된다. 적용기는 같은 key의 기존 DOM 노드를 이동시켜 참조를 유지하고, 사라진 키는 제거하며, 새 키는 Render한다. 모든 REORDER는 path 깊이 오름차순으로 적용해 조상 재정렬 뒤 하위 경로를 안정화한다. 그 뒤 일반 Patch와 하위 REORDER를 적용한다. 부모 REPLACE/REMOVE에는 하위 Patch를 만들지 않는다.
- key가 없는 자식의 기존 동작과 Patch 종류는 바꾸지 않는다. 배열 순회 기반 단순 reconciliation을 사용하며, key 목록/매핑 추가 공간은 O(n), 탐색/배치 시간은 평균 O(n + 변경 자식의 하위 Diff 비용)이다.

### D. 편집 감지 및 미적용 표시

- Controller는 테스트 컨테이너의 `childList`와 subtree를 관찰해 루트 삭제/교체를 감지하고, 샘플 루트 내부 `childList`, `characterData`, `attributes`를 관찰한다.
- 변경 레코드가 발생하면 편집 DOM을 VNode로 변환해 마지막 적용 VNode와 비교한다. 실제 내용이 다르면 `미적용 변경 있음`, 같으면 `적용된 상태`를 표시한다. 편집 후 원상복구하면 다시 적용 상태가 된다.
- Patch 성공 또는 undo/redo/timeline 이동이 끝난 뒤 상태를 재계산한다. 상태 표시 UI는 관찰 대상 바깥에 둔다. 루트 삭제 시에는 샘플 루트 누락 오류 상태를 보여 준다.
- 잘못되거나 중복된 key 등 변환/비교 오류는 비동기 예외로 던지지 않고 `편집 오류: ...`로 표시한다. Patch 버튼도 오류를 표시하고 실제 DOM/History를 변경하지 않는다.
- `MutationObserver` 미지원 환경에서는 `편집 감지 미지원`으로 표시하되 기존 Patch 기능은 동작해야 한다. `.value`/`.checked`처럼 HTML 속성 Mutation 없이 바뀌는 프로퍼티 변경은 이 감지 범위가 아니다.

### E. State batching

- 같은 JavaScript 작업(job)에서 호출된 setter는 한 번의 microtask flush에서 한 번만 컴포넌트를 재실행한다. 동기 코드는 setter 직후에도 최신 state 값을 슬롯에 기록한다.
- 함수형 updater는 호출 순서대로 직전 state를 받아 계산한다. 같은 값으로 끝나면 렌더를 생략한다.
- flush 전에 unmount하면 대기 update를 취소하고, 뒤늦은 setter는 기존처럼 무시한다. flush 전에 명시 `update()`가 성공하면 예약 flush를 흡수해 중복 렌더하지 않는다.
- updater 자체 오류는 setter 호출부로 동기 전달하고 그 결과는 저장하지 않는다. 예약 렌더 오류는 해당 batch의 state 슬롯을 batch 직전 값으로 되돌리고 DOM/VNode를 직전 성공 렌더 상태로 유지하며 콘솔에 기록한다.
- `flushSync`는 제공하지 않는다. batching 단위는 한 JS 작업의 동기 setter 묶음이며 서로 다른 이벤트 작업은 별도로 렌더된다.

## 파일 책임 및 계약 변화

| 파일                                              | 변경                                               |
| ------------------------------------------------- | -------------------------------------------------- |
| `src/vdom/types.js`                               | 선택 key와 REORDER Patch의 타입 설명               |
| `src/vdom/dom-to-vnode.js`                        | `data-key`를 VNode key로 읽기                      |
| `src/component/create-element.js`                 | `h()`에서 예약 `key` 추출                          |
| `src/vdom/diff.js`                                | 모든 형제에 유효 key가 있을 때 순서/추가/삭제 계산 |
| `src/vdom/patch.js`                               | REORDER 적용, patch 대상 콜백 제공                 |
| `src/history/history.js`                          | key를 포함한 복사 스냅샷/현재 인덱스/직접 이동 API |
| `src/playground/controller.js`                    | observer, 강조, Timeline 연결 및 상태 동기화       |
| `src/playground/editor.js`                        | 편집 루트 관찰기 helper                            |
| `src/playground/patch-view.js`                    | patch 목록의 REORDER 표시                          |
| `src/component/function-component.js`, `hooks.js` | 예약된 state flush와 단일 microtask 재렌더         |
| `index.html`, `src/styles/main.css`               | 미적용 상태, 이력 타임라인, 강조 UI                |
| `tests/`                                          | 모듈 단위와 UI/브라우저 DOM 통합 회귀 테스트       |

## 입력/출력과 호출 흐름

1. `domToVNode`는 일반 DOM Element/Text를 읽고 `{type, tag/value, props, key?, children}` VNode를 반환한다. 주석은 제외한다.
2. `diff(previous, next)`는 두 입력을 바꾸지 않고 Patch 목록을 반환한다. keyed 형제 집합에서는 `{type:'REORDER', path, children:[{key,node}]}`로 구조를 먼저 설명한다.
3. `patch(root, patches, {onPatched})`는 같은 key의 노드를 먼저 재배치하고 경로 기반 자식 Patch를 적용한 뒤 최신 루트를 반환한다.
4. Playground의 edit observer는 `domToVNode(editedRoot)`를 `diff(applied,next)`와 비교하여 dirty 상태를 갱신한다.
5. Patch 클릭은 diff → patch → applied/history 갱신 → Timeline/상태 갱신을 하고, History 이동은 history.goTo → diff(applied,target) → patch + 테스트 영역 render를 한다.
6. Timeline 렌더는 `history.entries()`와 `history.index()`에서 읽고, 버튼 클릭은 Controller로 돌아온다.
7. State setter는 Hook 슬롯 값 반영 → update 예약 → 한 microtask 내 `FunctionComponent.update()` 한 번 → 기존 Diff/Patch → effect commit 순서다.

## 예외 및 경계 조건

- 빈 key(`""`), null, 객체 key, 비유한 숫자 key, 중복 key는 keyed sibling set에서 TypeError다. DOM의 빈 `data-key`도 잘못된 key로 처리한다.
- key가 부분적으로만 존재하거나 텍스트 자식이 포함되면 전체 형제 목록에 대해 positional fallback한다.
- 빈 keyed children은 정상이며 모두 삭제/삽입되는 전이도 지원한다.
- 루트 노드는 자식 reconciliation 대상이 아니며 tag/type 변경은 기존 REPLACE 규칙을 따른다.
- History의 처음/끝 이동은 기존 undo/redo처럼 현재를 반환한다. goTo는 범위 밖/비정수면 오류다.
- 편집 root 제거는 상태에 오류를 보여주지만 Patch 적용은 명시적으로 샘플 root 필요 오류를 표시한다.
- 여러 Patch가 같은 노드를 가리켜도 Controller의 강조 클래스/타이머는 하나로 합친다. callback은 각 Patch의 대상 node를 제공한다. callback 오류는 DOM 적용 뒤 집계해 던진다. callback이 없으면 기존 API처럼 동작한다.
- setter 여러 번에서 updater 중 하나가 오류를 던지면 해당 호출은 오류를 전달하고 앞서 예약된 변경은 flush한다. 예약 렌더 오류는 batch state를 되돌리고 콘솔에 기록한다.

## 테스트 및 복잡도 기준

- key DOM 변환, h 예약 key, History clone key 보존, 중복/부분 key fallback, prepend/append/delete/여러 이동/중첩 변경, keyed node 참조 보존, 입력 불변성, reorder 후 텍스트 포함 경로를 검증한다.
- Patch 강조 callback의 타입별 node 참조와 루트 REPLACE 반환값을 검증한다. 타이머는 fake timer로 800ms 만료와 반복 강조를 확인한다.
- History 목록 복사 불변성, goTo 경계/오류, future 분기 및 Timeline 버튼/현재 표시/양 영역 동기화를 검증한다.
- MutationObserver 상태 전이, 되돌린 편집, history 이동 후 clean, root 삭제, API 미지원 환경을 검증한다.
- batch는 같은 작업의 N번 setter가 1회 렌더, 함수형 updater 순서, 값 불변 렌더 생략, 서로 다른 작업 분리, unmount 취소, 명시 update 흡수, updater 오류와 예약 렌더 오류 롤백을 확인한다.
- Positional Diff는 O(N + A)이며 keyed sibling reconciliation은 추가로 O(C) 평균 시간/공간(형제 수 C)과 key 문자열 생성 비용이 든다. Patch에는 keyed parent 아래의 기존 경로 탐색 비용이 추가되며 전체 O(P·D·S + C) 수준의 최악 항을 그대로 기록한다.
- Timeline은 `entries()`의 방어 복사본을 다시 그린다. 보관 중인 스냅샷 전체 크기 합을 T라 하면 한 갱신마다 O(T) 시간과 임시 O(T) 공간이 들며, H개 비슷한 N 노드 상태에서는 O(HN)이다.
- 전체 포맷/테스트/빌드는 `npm run check`; jsdom으로 observer와 DOM 이동 동작을 검증한다. 브라우저 UI는 실제 표시 및 클릭이 가능한 경우 별도로 확인한다.

## 구현 순서

1. 완료: 계약과 경계 조건 테스트를 구현 전에 추가하고 미구현 상태에서 실패를 확인했다.
2. 완료: History API 및 타임라인을 구현했다.
3. 완료: 예약 key 수집, keyed Diff, REORDER Patch와 노드 참조 테스트를 구현했다.
4. 완료: Patch 콜백, 강조 표시, 변경 목록 표시를 구현했다.
5. 완료: 편집 observer와 dirty 상태를 Controller에 연결했다.
6. 완료: batched state scheduler를 구현하고 Effect 실행 순서를 회귀 검증했다.
7. 완료: 통합 테스트와 `npm run check` 실행. 15개 파일, 112개 테스트 통과, Prettier 및 Vite 빌드 통과.
