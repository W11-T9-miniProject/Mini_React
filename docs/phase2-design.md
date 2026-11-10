# Phase 2 설계: Function Component, State, Hooks

상태: Phase 2 구현 완료. 설계와 구현 결과를 함께 기록한다.

## 진행 기록

- 완료: `h()`와 `renderChild()` — 자식 정규화/검증, 함수 이벤트 prop, 안전한 listener 교체·삭제.
- 완료: `FunctionComponent` 기본 수명주기 — mount/update/unmount, props 갱신, Diff/Patch 연결, 루트 교체.
- 완료: `useState` — 인스턴스 슬롯 저장, 값/함수형 setter, batching을 통한 microtask 재렌더, Hook 호출 문맥/순서 확인.
- 완료: `useEffect` — 커밋 후 microtask 실행, 의존성 비교, 재실행 전 cleanup, unmount cleanup.
- 완료: `useMemo` — 의존성 비교, 계산 결과 슬롯 캐시, 렌더 실패 시 커밋 보류.
- 완료: 페이지에 카운터 데모 연결. 증가/감소/초기화, 파생 값, props 기반 자식, effect와 cleanup 상태를 확인할 수 있다.
- 완료: 상태 업데이트 batching — 같은 JavaScript 작업의 setter를 하나의 microtask 렌더로 합친다.
- 확인: 선택 확장 포함 전체 112개 테스트, 포맷 검사와 Vite 빌드 통과.

## 현재 구현 상태

Phase 1에는 DOM↔VNode 변환, VNode 렌더, 속성 처리, 기본 인덱스 및 keyed Diff/Patch, VNode History와 Playground Controller가 있다. Phase 2는 `h()`/이벤트 prop, `FunctionComponent` mount/update/unmount, `useState`, `useEffect`, `useMemo`와 상태 batching까지 구현했다. `src/vdom`은 UI와 History를 모르며 Controller/컴포넌트가 VDOM 모듈을 연결한다.

Phase 2의 목표는 단일 최상위 함수형 컴포넌트에 Hooks 배열을 연결하고 상태 변경이 새 VNode를 계산해 실제 DOM에 반영되게 하는 것이다. 자식 함수형 뷰는 props를 받아 VNode를 반환하는 순수 함수로만 사용하며 자체 Hooks를 갖지 않는다.

## 구현 완료 조건

- `FunctionComponent` 인스턴스가 컴포넌트 함수, props, Hook 슬롯, 이전 VNode, 현재 실제 루트 노드와 mount 컨테이너를 관리한다.
- `mount(container)`가 첫 실행과 최초 DOM 생성을 한다. `update(nextProps)`와 상태 setter가 컴포넌트를 다시 실행하고 Diff/Patch로 기존 DOM을 갱신한다.
- Hook 호출 위치가 매 렌더마다 같은 순서여야 한다. 잘못된 컴포넌트 밖 호출, Hook 종류/순서 변경은 설명 가능한 오류를 낸다.
- `useState`, `useEffect`, `useMemo`가 최상위 컴포넌트에서 동작한다.
- 여러 개의 상태가 서로 다른 슬롯에 저장되고, 상태 setter는 값과 함수형 갱신을 받는다. `Object.is`상태 변화가 없으면 불필요한 렌더를 건너뛴다.
- 상태가 바뀌어도 변경되지 않은 DOM 노드 참조를 유지한다.
- effect는 커밋 이후 실행되고, 의존성 변경 전 cleanup, 재실행, unmount cleanup 규칙을 테스트한다.
- memo는 의존성이 같을 때 계산을 재사용하고, 바뀌면 다시 계산한다.
- 기존 Phase 1 테스트/빌드가 통과한다.

## 파일과 책임

```text
src/
  component/
    function-component.js   루트 컴포넌트 인스턴스, 렌더 주기, mount/update/unmount
    hooks.js                활성 렌더 문맥, Hook 슬롯과 useState/useEffect/useMemo
    create-element.js       요소 VNode 생성 및 순수 자식 함수 호출 경계
  vdom/
    types.js                이벤트 핸들러를 포함할 VNode props 타입 확장
    dom-properties.js       일반 속성과 이벤트 리스너의 공통 설정/삭제
    diff.js                 함수 props의 동일성 비교와 이벤트 props Patch
    render.js / patch.js    확장된 props를 기존 렌더/갱신에 반영
tests/
  function-component.test.js 컴포넌트 수명주기와 자동 갱신
  hooks.test.js             Hook 슬롯, 의존성, cleanup, 오류 경계
  component.integration.test.js 실제 DOM 이벤트부터 상태 갱신까지 연결
```

Phase 1 Playground와 Phase 2 카운터 데모는 한 페이지에 함께 배치한다. 데모 초기화는 `main.js`가 담당하고 컴포넌트 구현은 `src/component/demo.js`에 둔다.

## 자료 계약과 함수 서명 초안

루트 컴포넌트는 `props → VNode` 함수다. 요소 VNode는 현재 `{ type, tag, props, children }` 형태를 유지하되 일반 속성은 문자열, `onClick` 등 이벤트 prop 값은 함수가 될 수 있도록 타입을 넓힌다. DOM에서 변환한 VNode는 기존처럼 HTML 문자열 속성만 가진다. 이벤트 함수는 DOM 속성 문자열로 변환하지 않고 `addEventListener`/`removeEventListener`로 연결한다.

```js
new FunctionComponent(Component, initialProps);
instance.mount(container); // 실제 DOM 루트 Node
instance.update(nextProps); // 갱신된 실제 DOM 루트 Node
instance.unmount(); // effect cleanup 및 루트 제거

useState(initialValue); // [value, setValue]
useEffect(effect, dependencies);
useMemo(factory, dependencies);

h(tag, props, ...children); // Element VNode
renderChild(pureFunction, props); // Hook 사용을 막고 자식 VNode 계산
```

`setValue(valueOrUpdater)`는 해당 슬롯의 현재 값으로 새 값을 계산한다. `setValue(current => next)` 형태를 지원한다. setter는 생성 시 슬롯 번호를 고정해 렌더 후에도 같은 상태 슬롯을 갱신한다.

Hook 저장 슬롯은 종류별 레코드다. 예: state `{ kind, value, setter }`, effect `{ kind, deps, cleanup, pendingEffect }`, memo `{ kind, deps, value }`. 의존성 비교는 길이가 같고 각 항목이 `Object.is`일 때 동일하다고 판단한다. 의존성 배열 생략은 매 렌더, 빈 배열은 최초 mount 한 번을 뜻한다.

## 호출 관계와 렌더 주기

초기 mount:

```text
instance.mount(container)
  → Hook cursor 초기화 / 현재 Hook 문맥 등록
  → Component(props) 실행
  → h()/renderChild()가 VNode 생성
  → Hook 문맥 해제
  → render(vnode) → container에 실제 DOM 설치
  → 커밋 후 대기 중 effect 실행
```

상태 변경:

```text
이벤트 핸들러
  → setValue(next)
  → 상태 슬롯 변경 (Object.is가 같으면 종료)
  → instance.update()
  → Component 재실행 / 다음 VNode 계산
  → diff(previousVNode, nextVNode)
  → patch(currentRoot, patches)
  → 반환 루트 참조와 previousVNode 갱신
  → 커밋 후 바뀐 effect 실행
```

props 변경도 `instance.update(nextProps)`를 통해 같은 재렌더 경로를 탄다. 자식 함수 호출은 `renderChild` 경계에서 Hook 문맥을 일시 중지하여 자식 Hook 사용을 오류로 처리한다. 호출자는 `unmount()`를 통해 effect cleanup과 루트 DOM 제거를 수행한다.

## 경계, 예외와 구현 결정

- Hook은 활성화된 최상위 컴포넌트 렌더 중에만 호출할 수 있다. 컴포넌트 함수 바깥이나 renderChild 내부 호출은 오류다.
- `useMemo` 계산 함수는 Hook 문맥 밖에서 실행하므로, 계산 함수 안에서 다른 Hook을 호출하면 오류다.
- Hook 종류와 호출 수/순서는 첫 렌더와 같아야 한다. 렌더 완료 시 Hook 수를 확인하고 슬롯 종류가 달라지면 오류를 던진다. Hook 문맥은 컴포넌트 함수가 예외를 던져도 `finally`에서 복구한다.
- 렌더 도중 setter를 호출하는 것은 금지한다. 렌더 중 재진입/무한 반복을 예방한다.
- setter는 unmount 이후 호출되면 무시한다. 중첩 mount 또는 동일 인스턴스 중복 mount는 명확한 오류로 처리한다.
- 컴포넌트가 mount한 루트와 그 자손은 컴포넌트가 소유한다. 외부 코드가 자손 DOM을 직접 수정하는 것은 지원하지 않는다. 루트를 다른 부모로 옮기면 update는 거부하고 unmount는 이동된 루트도 제거한다.
- 상태 업데이트는 같은 JavaScript 작업에서 한 번의 microtask flush로 묶인다. 명시 update가 먼저 완료되면 예약 update를 흡수한다.
- effect는 DOM 커밋 뒤 microtask에서 실행한다. 의존성이 바뀐 effect는 이전 cleanup을 먼저 수행한 뒤 최신 effect를 실행한다. unmount는 모든 cleanup을 실행한다. 테스트는 microtask를 명시적으로 flush한다.
- microtask가 실행되기 전에 update가 동기적으로 여러 번 커밋되더라도 각 커밋의 effect를 순서대로 실행한다. effect 또는 cleanup 콜백이 오류를 내면 나머지 대기 작업/cleanup을 계속하고 오류를 콘솔에 기록한다. unmount cleanup 오류는 모든 teardown을 마친 뒤 AggregateError로 호출자에게 전달한다.
- 일반 속성 문자열과 이벤트 함수 prop을 구분한다. 이벤트 핸들러 교체 시 이전 listener를 제거한다. `domToVNode`는 런타임 이벤트 listener를 읽지 않는다.
- `h`는 배열 자식 인자를 평탄화하고 문자열/숫자를 Text VNode로 바꾼다. `null`, `undefined`, boolean 자식은 생략하는 규칙을 테스트로 고정한다. 임의 객체 자식은 TypeError로 거부한다.
- SVG, Context, Fragment, 에러 바운더리, 서버 렌더링은 범위에서 제외한다. key 기반 재정렬 규칙은 `docs/optional-extensions-plan.md`에 둔다.

## 테스트 계획

1. FunctionComponent mount가 컴포넌트를 한 번 실행하고 VNode DOM을 삽입한다.
2. update(props)가 새 props로 다시 실행하고 Patch를 적용한다. 변경 없는 update는 같은 DOM 참조를 유지한다.
3. 두 useState 슬롯이 분리되고, setter가 값/함수형 갱신을 반영하며, 같은 값은 재렌더하지 않는다.
4. 여러 렌더 사이 Hook 슬롯 번호가 유지된다. Hook 종류/순서 변경, 렌더 외 호출, renderChild 내부 Hook, render 중 setter가 오류다.
5. 실제 버튼 이벤트 → setter → 자동 렌더 → 텍스트 갱신까지 통합 동작을 검증한다.
6. effect 최초 실행, 같은 deps에서 보류, deps 변경 시 cleanup 선행, 배열 생략, 빈 배열, unmount cleanup을 검사한다.
7. memo 최초 계산, 같은 deps 캐시, 변경 deps 재계산, 배열 생략 동작을 검사한다.
8. 이벤트 listener 추가, 핸들러 교체(이전 핸들러 미호출), 제거, 일반 속성 업데이트를 검증한다.
9. Phase 1 DOM 변환/Diff/Patch/History/Playground 회귀 검사를 함께 실행한다.

## 복잡도

렌더되는 VNode 수를 N, 속성 수를 A, 현재 컴포넌트의 Hook 슬롯 수를 H, Patch 수를 P, 실행할 effect 수를 E로 둔다. 컴포넌트 함수는 사용자가 실행하는 계산 비용을 제외하면 Hook 커서 설정 O(1), Hook 접근/의존성 비교 합계는 O(H + 비교한 deps 수)다. `h()`는 props와 자식 입력을 순회하고 VNode 구조를 검증한다. 외부에서 이미 구성한 깊은 VNode를 다른 요소에 반복 포함하면 검증 중복 때문에 최악 O(ND)가 될 수 있으며, D는 트리 깊이다. 새 VNode 생성 공간은 O(N + A), 검증 재귀 스택은 O(D)다. `renderChild()`의 반환 트리 검증은 O(N + A)다. 매 update는 새 VNode 생성과 검증 비용에 Diff O(N + A), Patch 경로 탐색 비용을 더한다. 상태 갱신 한 번의 Hook 저장 공간은 O(H)이며 setter 호출 자체의 추가 공간은 O(1)이다. effect cleanup과 memo 값은 슬롯에 포함되어 O(H)다. effect 큐는 대기 커밋 수에 비례하는 O(E) 공간과 실행 시간이 필요하며 effect 함수 자체의 비용은 별도다. Hook 업데이트 한 번이 전체 화면 업데이트보다 O(1)이라고 표현하지 않는다.

## 순차 구현 계획

1. 이 설계와 이벤트 prop/VNode 계약 확정, 이전 테스트 기준 기록.
2. `h`와 이벤트 prop 지원부터 구현 전 테스트 작성 → 구현 → 독립 검토.
3. FunctionComponent의 mount/update/unmount와 VNode Patch 연결 테스트 작성 → 구현 → 검증.
4. useState의 슬롯 규칙과 이벤트 기반 자동 렌더 테스트 작성 → 구현 → 검증.
5. 학습 설명과 객관식 10문제로 이해 확인. 답변 확인 후 다음 단위로 진행.
6. useEffect와 useMemo는 각각 별도 설계 보충/테스트/구현/이해 확인 단위로 추가.
7. Phase 2 모듈을 통합하고 카운터 데모를 페이지에 연결한 뒤 회귀 테스트 및 `npm run check`를 실행한다.
