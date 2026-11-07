# Mini React Lab

Vanilla JavaScript로 직접 구현한 Virtual DOM, Diff, Patch와 함수형 컴포넌트·Hooks 실습 프로젝트입니다. **React/Vue 등 UI 프레임워크를 사용하지 않습니다.**

브라우저에서 세 화면을 사용할 수 있습니다.

- **DOM Playground:** HTML 코드/화면 편집 → 변경 적용 → 이력 이동, Patch 목록과 VDOM 관찰
- **Component Studio:** 할 일 추가·검색·필터·완료·삭제, 타이머, 배칭과 Memo/Effect 관찰
- **코드 따라가기:** Top-down 학습 순서와 실제 DOM에서 실행하는 내장 엔진 검사 12개

## 실행

Node.js **24.x**와 npm을 준비합니다. 프로젝트 폴더에서:

```sh
npm ci
npm run dev
```

터미널에 출력된 로컬 주소를 여세요. 이미 의존성이 설치되어 있으면 `npm run dev`만 실행하면 됩니다. 별도 API 서버, DB, 환경변수, 전역 패키지 설치가 필요하지 않습니다. 모든 상태는 메모리에 있으며 새로고침하면 초기화됩니다.

| 명령                   | 용도                            |
| ---------------------- | ------------------------------- |
| `npm run dev`          | 개발 서버                       |
| `npm test`             | Vitest + jsdom 단위/기능 테스트 |
| `npm run test:watch`   | 변경 시 테스트 재실행           |
| `npm run build`        | dist에 배포용 정적 파일 생성    |
| `npm run preview`      | 빌드 결과 로컬 확인             |
| `npm run format`       | Prettier 포맷 적용              |
| `npm run format:check` | 포맷 검사                       |
| `npm run check`        | 포맷 검사 → 테스트 → 빌드       |

Vite는 개발/빌드 도구, Vitest와 jsdom은 테스트 도구, Prettier는 포맷 도구입니다. UI는 브라우저 API와 자체 엔진으로 구현합니다. 의존성 변경 시 `package.json`과 `package-lock.json`을 함께 커밋하세요. `node_modules`, `dist`, `coverage`, 로컬 환경변수는 Git에서 제외합니다.

이 PC처럼 npm에서 인증서 체인 오류가 나는 환경에서는, 조직에서 신뢰하는 시스템 인증서가 등록되어 있다면 PowerShell에서 `$env:NODE_USE_SYSTEM_CA = '1'`을 설정한 뒤 설치할 수 있습니다. 인증서 검증을 끄는 설정은 사용하지 않습니다.

## 바로 해볼 실험

### Phase 1

1. HTML 편집기의 `h3` 문장을 수정합니다. 테스트 영역만 바뀝니다.
2. **변경 적용 / Patch**를 누릅니다. 실제 영역의 텍스트가 바뀌고 TEXT Patch가 기록됩니다.
3. `class`나 `title`을 바꿔 PROPS를 확인합니다.
4. `h3`를 `h2`로 바꿔 REPLACE를 확인합니다.
5. 목록의 마지막 항목을 추가/삭제해 INSERT/REMOVE를 확인합니다.
6. 뒤로/앞으로 이동합니다. 실제 영역, 테스트 영역, HTML 편집기가 함께 복원됩니다.
7. 뒤로 간 뒤 새 변경을 Patch하면 기존 미래 이력은 제거됩니다.
8. 같은 상태에서 다시 Patch하면 새 이력을 저장하지 않습니다.

직접 편집은 텍스트 수정과 일반 텍스트 붙여넣기를 지원합니다. 태그와 속성 변경은 HTML 편집기를 사용하세요. 브라우저는 잘못 중첩된 HTML을 자동 보정할 수 있습니다. 샘플을 감싸는 루트 div는 유지되고 그 내부는 빈 내용까지 자유롭게 편집할 수 있습니다.

HTML 편집기는 일반 HTML 태그를 허용하며 script, iframe, 인라인 이벤트, style, 실행 가능한 URL 등은 거부합니다. CSS는 `class`로 적용합니다. SVG, file/password 입력, multiple select 등은 지원 범위 밖입니다. 오류가 있으면 기존 실제 DOM과 History는 보존됩니다. 이 편집 정책은 학습용이며, 불특정 외부 HTML을 저장·배포하는 서비스용 보안 경계를 대신하지 않습니다.

### Phase 2

1. 작업 추가: tasks와 draft 두 상태를 변경하지만 렌더 횟수는 한 번 증가합니다.
2. 검색/필터: useMemo의 의존성에 따라 표시 목록을 계산합니다.
3. 타이머 시작: tick만 바뀌므로 두 useMemo의 계산 횟수는 유지됩니다.
4. **+3 배칭 테스트:** 함수형 setter 세 번 → 값은 +3, 렌더는 한 번입니다.
5. 타이머 정지: Effect Cleanup에서 interval을 제거합니다.
6. Unmount: Effect 정리와 제목 복원을 확인합니다. 다시 Mount하면 초기 상태입니다.

렌더마다 새로 만들어지는 이벤트 함수도 PROPS Patch에 포함되므로 마지막 Patch 개수가 화면 텍스트 변경 개수보다 많을 수 있습니다.

### 브라우저 내장 검사

**코드 따라가기 → 12개 검사 실행**을 누르면 현재 브라우저의 DOM으로 변환·다섯 Diff·Patch·History·Hooks·할 일 앱 이벤트를 검사합니다. 별도 테스트 라이브러리 다운로드가 필요하지 않으며 실습 화면 상태는 유지합니다.

이 검사는 페이지 안에서 실제 DOM API를 사용하는 기능 검사입니다. 외부 브라우저 조작 도구로 포커스·키보드·레이아웃까지 검사하는 E2E 테스트와는 범위가 다릅니다. 이번 환경에서는 별도 브라우저 자동화 의존성을 추가하지 않았습니다.

## 구조

```text
src/
  main.js                         스타일 로드와 앱 시작
  bootstrap.js                    두 Phase와 화면 메뉴 연결/정리
  vdom/
    types.js                      JSDoc VNode/Patch 계약
    dom-to-vnode.js                현재 DOM → VDOM (폼 프로퍼티 포함)
    render.js                     VDOM → 새 DOM
    dom-properties.js             속성/폼 프로퍼티/이벤트 처리
    diff.js                       이전/다음 VDOM → Patch[]
    patch.js                      기존 DOM의 필요한 부분 수정
  history/
    history.js                    불변 스냅샷 + 커서
  runtime/
    context.js                    현재 렌더 중인 루트와 자식 호출 깊이
    create-element.js             h()와 순수 함수형 자식 실행
    hooks.js                      useState / useEffect / useMemo
    function-component.js         hooks 보존, mount/update/unmount, 배칭
    index.js                      런타임 공개 API
  playground/
    controller.js                 Phase 1 편집/적용/이력 흐름
    editor.js                     HTML 검증/파싱/폼 상태 직렬화
    sample.js                     초기 HTML
    patch-view.js                 변경 목록 표시
    self-test.js                  브라우저 내장 엔진 검사
  demo/
    app.js                        모든 Hook/State를 가진 루트 App
    components.js                 props만 사용하는 순수 자식들
    controller.js                 mount/unmount와 진단 정보 표시
  styles/main.css                 반응형 실습 화면

tests/                            단위·DOM 이벤트·전체 앱 통합 테스트
docs/TOP_DOWN.md                   화면 동작부터 코드까지 따라가는 학습 안내
docs/ARCHITECTURE.md               계약·자료 구조·설계 선택과 제한
docs/MANUAL_TESTS.md               실제 브라우저 수동 검증 시나리오
```

기존 Vite 예제의 `src/counter.js`, `src/style.css`, `src/assets/`, public 예제 파일은 앱에서 참조하지 않습니다.

## 데이터 흐름

```text
[Phase 1 최초 로드]
샘플 HTML → 실제 DOM → domToVNode → 초기 VDOM
                                  ├─ render → 테스트 DOM
                                  └─ History 초기화

[Phase 1 Patch]
테스트 DOM → domToVNode → diff(History 현재값, 새 VDOM)
                         ├─ patch → 실제 DOM
                         └─ 변경이 있으면 History.push

[Phase 2]
이벤트 → setState → microtask 배칭 → 루트 함수 재실행
       → 새 VDOM → 같은 diff / patch → DOM commit → Effect 정리/실행
```

History는 Phase 1용 직렬화 가능한 VDOM을 저장합니다. Phase 2의 함수형 이벤트가 있는 VDOM은 History에 넣지 않습니다. 각 Phase는 같은 Diff/Patch 엔진을 공유하지만 별도의 상태를 가집니다.

## 요구사항 대응

| 요구사항                              | 구현 위치 / 확인                      |
| ------------------------------------- | ------------------------------------- |
| DOM → Virtual DOM                     | vdom/dom-to-vnode.js                  |
| 다섯 가지 Diff와 부분 Patch           | vdom/diff.js, patch.js                |
| 실제/테스트 영역과 편집               | playground/controller.js, editor.js   |
| Patch/뒤로/앞으로                     | controller.js + history/history.js    |
| FunctionComponent 클래스와 hooks 배열 | runtime/function-component.js         |
| mount / update / 상태 보존            | FunctionComponent + hooks.js          |
| 루트 State와 순수 자식                | demo/app.js + components.js           |
| useState / useEffect / useMemo        | runtime/hooks.js                      |
| 같은 엔진 재사용                      | FunctionComponent.update의 diff/patch |
| 선택 과제 Batching                    | FunctionComponent.schedule            |
| 모듈/기능 테스트                      | tests/ + 브라우저 내장 검사           |

## 테스트와 한계

단위/통합 테스트는 공백·빈 요소·루트 교체·연속 삭제·중간 삽입·이벤트 교체·폼 프로퍼티·입력 포커스/커서·이력 분기·Hook 순서·Effect Cleanup·배칭 등을 검증합니다. 고정 seed로 만든 150개 VDOM 쌍의 왕복 성질도 검사합니다. TODO 테스트는 남기지 않았습니다.

실제 브라우저 조작 검증은 `docs/MANUAL_TESTS.md`를 따라 수행하세요. jsdom 테스트는 실제 레이아웃이나 한글 IME를 재현하지 않습니다.

이 엔진은 동기식 인덱스 비교와 루트 Hook만 지원합니다. Fiber/Concurrent Rendering, 자식별 Hook/State, key 기반 이동, Fragment, Portal, Error Boundary, SSR/Hydration 등은 구현하지 않았습니다. Hook은 최상위에서 항상 같은 순서로 사용하고 상태 객체/배열은 새 값으로 갱신하세요.

학습은 **[Top-down 안내](docs/TOP_DOWN.md)**부터 시작하세요.
