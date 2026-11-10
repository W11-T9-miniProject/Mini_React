# Mini React 아키텍처 설계도

> CodeSight 연동 도구가 현재 세션에 노출되지 않아 이 문서는 저장소 내 정적 설계도다. 실제 그래프 표시/연동은 확인되지 않았으며 완료로 간주하지 않는다.

## 모듈 구조와 계약

```text
main.js
└─ playground/controller.js
   ├─ sample.js → 초기 HTML
   ├─ editor.js → [data-sample-root] 조회 / MutationObserver 편집 감지
   ├─ vdom/dom-to-vnode.js → VNode
   ├─ vdom/render.js → Node (dom-properties.js 공유)
   ├─ vdom/diff.js → Patch[] (positional + key 기반 REORDER)
   ├─ vdom/patch.js → 갱신된 루트 Node + 변경 대상 콜백
   ├─ history/history.js → 불변 VNode 스냅샷 / 커서 / entries / goTo
   └─ playground/patch-view.js → 변경 목록 텍스트
```

VNode는 텍스트 `{ type: 'text', value }` 또는 요소 `{ type: 'element', tag, key?, props, children }`다. HTML 편집 영역에서 `data-key`가 key로 쓰이며 일반 속성 값도 보존한다. Patch는 TEXT, PROPS, REPLACE, INSERT, REMOVE, REORDER다. 모든 경로는 주석을 제외한 `childNodes` 인덱스를 따른다. INSERT 경로는 부모이고 index는 다음 자식 위치다. keyed 형제는 기존 DOM 참조를 옮긴다.

## 흐름

초기화: 샘플 HTML을 실제 영역에 설정 → `[data-sample-root]`를 domToVNode → 이력을 초기화 → render 결과를 테스트 영역에 설치.

Patch 버튼: 테스트 샘플 루트를 domToVNode → 직전 적용 VNode와 diff → 실제 루트에 patch → 반환 루트 참조 저장 → 변경이 있을 때만 applied 상태와 History 갱신 → Patch 목록/버튼 갱신.

편집 감지: MutationObserver가 테스트 컨테이너의 구조/문자/속성 변화를 받음 → 샘플 루트를 VNode로 읽음 → applied 상태와 diff → `적용된 상태`, `미적용 변경 있음`, 편집 오류 중 하나로 표시.

뒤로/앞으로/타임라인: 이동 전 applied 상태와 History 목표 VNode를 확보 → `diff(applied, target)`을 실제 DOM에 적용 → 적용된 노드는 잠깐 강조 → applied/루트 참조 갱신 → 테스트 영역은 target을 다시 render → 이력 목록/버튼 갱신. 편집 중 내용은 목표 상태로 덮어쓴다.

Phase 2 state: setter는 슬롯 값을 즉시 갱신하고 현재 JavaScript 작업의 한 번의 microtask 렌더를 예약 → `FunctionComponent.update()` → Diff/Patch → Effect commit. 같은 작업에서의 여러 setter는 마지막 상태로 한 번 렌더한다.

## 책임 경계와 개념 연결

VDOM 모듈은 UI/History를 알지 못한다. Diff는 DOM에 접근하거나 입력을 수정하지 않는다. Patch는 실제 DOM만 수정하고 새 루트 참조를 반환한다. History는 VNode를 복사하며 DOM을 보관하지 않는다. Controller만 화면과 모듈을 조율한다. Render와 Patch는 같은 속성 적용 함수를 사용한다. 실제 DOM은 브라우저가 관리하는 노드이며 VNode는 비교를 위해 만든 일반 JavaScript 데이터다. Diff는 두 데이터 트리의 차이를 Patch 명령으로 표현한다.

## 복잡도

노드 수를 N, 속성 키 총수를 A, Patch 수를 P, 경로 최대 깊이를 D, 해당 형제 수를 S, keyed 목록 길이를 C라 둔다. Diff의 key 검증과 비교는 O(N + A), 출력 Patch 공간은 O(P), 경로 복사 누적 비용은 최대 O(ND)다. Key 목록의 Map 생성/조회는 평균 O(C)와 O(C) 공간, key 길이 문자열 변환 비용이 추가된다. Patch 경로 탐색은 O(P·D·S)이며 REORDER 자체는 평균 O(C)와 O(C) 임시 공간이다. 일반 INSERT 목록은 현재 적용 과정에서 형제 배열을 다시 읽으므로 최악 O(KS), K개 삽입이다. History 스냅샷 하나는 O(N + A) 복사 시간/공간이며 H개 저장 상태는 O(H(N + A))다. 타임라인의 방어 복사 렌더는 보관 중 전체 상태 크기를 T라 할 때 O(T) 시간/임시 공간이다.

## 구현 진행 상태

정적 문서는 작성됨. CodeSight 확장 설치/연결 및 실제 그래프 표시는 이 세션에서 확인할 수 없으므로 별도 미완료 항목이다.
