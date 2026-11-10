# Mini React — Phase 1 + Phase 2

Vanilla JavaScript로 DOM → Virtual DOM → Diff → Patch와 상태 이력을 구현하는 팀 프로젝트입니다.

## 현재 구현 상태

Phase 1의 DOM↔VNode 변환, Render, 속성 처리, Diff, Patch, History와 편집 Playground가 구현되었습니다. Phase 2의 함수형 컴포넌트, `useState`, `useEffect`, `useMemo`도 구현했고, 페이지 아래의 카운터 데모에서 동작을 확인할 수 있습니다. 설계와 한계는 `docs/phase2-design.md` 및 `docs/codesight-architecture.md`를 참고하세요.

## 환경 설정

- Node.js 24.x LTS와 npm을 사용합니다. `.nvmrc`는 버전 안내 파일이며 Node를 자동 설치하지 않습니다.
- 기존 Vite + JavaScript(ES Modules)를 유지합니다. TypeScript 설정은 필요하지 않습니다.
- Vite는 개발 서버/빌드 도구이며 React 같은 UI 프레임워크가 아닙니다.
- Vitest는 테스트 실행, jsdom은 테스트에서 `document`/`Node` 등 DOM API 제공, Prettier는 포맷 통일을 담당합니다.
- 현재 API 서버, 데이터베이스, 환경변수, 별도 전역 패키지 설치는 필요하지 않습니다.

처음 받은 팀원은 프로젝트 폴더에서 실행합니다.

```sh
cd Mini_React
npm ci
npm run dev
```

이미 Mini_React 폴더라면 `cd`는 생략합니다. 터미널에 출력된 로컬 주소를 브라우저에서 엽니다. 종료는 Ctrl+C입니다. 의존성을 추가/변경할 때는 `npm install`을 사용하고 `package.json`과 `package-lock.json`을 함께 커밋합니다.

| 명령                   | 용도                       |
| ---------------------- | -------------------------- |
| `npm run dev`          | 개발 서버                  |
| `npm run build`        | dist에 배포용 빌드 생성    |
| `npm run preview`      | 빌드 결과 로컬 확인        |
| `npm test`             | 테스트 한 번 실행          |
| `npm run test:watch`   | 파일 변경 시 테스트 재실행 |
| `npm run format`       | 코드 포맷 적용             |
| `npm run format:check` | 포맷 검사                  |
| `npm run check`        | 포맷 → 테스트 → 빌드 검사  |

에디터에 EditorConfig와 Prettier 확장을 설치하면 편리하지만 필수는 아닙니다. Git에는 소스/설정/lockfile을 올리고 node_modules, dist, coverage, 로컬 환경변수는 `.gitignore`로 제외합니다.

## 디렉터리와 책임

```text
src/
  main.js                    앱 진입점
  vdom/
    types.js                 JSDoc VNode/Patch 공통 계약
    dom-to-vnode.js           실제 DOM → VDOM
    render.js                VDOM → 새로운 DOM
    dom-properties.js        Render/Patch 공통 속성 처리
    diff.js                  이전/다음 VDOM → 변경 목록
    patch.js                 변경 목록을 기존 DOM에 적용
  history/
    history.js               VDOM 스냅샷과 현재 커서 관리
  playground/
    controller.js            초기화 및 버튼 동작 조율
    editor.js                태그/속성 편집 기능
    sample.js                초기 샘플
    patch-view.js            변경 목록 표시
  styles/
    main.css                 페이지 스타일
 tests/                      모듈별 테스트와 통합 테스트
 public/                     정적 파일
index.html                   두 영역과 도구 버튼
vitest.config.js             jsdom 테스트 설정
```

기존 Vite 템플릿의 `src/counter.js`, `src/style.css`, `src/assets/`, public의 예제 파일은 현재 진입점에서 사용하지 않습니다. 팀에서 필요 여부를 확인한 뒤 정리할 수 있습니다.

## 모듈 계약과 설계 규칙

- `domToVNode(node) → VNode`
- `render(vnode) → Node`
- `diff(previous, next) → Patch[]`
- `patch(root, patches) → Node` — 루트 교체가 있으므로 반환값을 반드시 보관합니다.
- `createHistory(initial) → { current, push, undo, redo, canUndo, canRedo }`

VDOM은 텍스트 `{ type: 'text', value }` 또는 요소 `{ type: 'element', tag, props, children }`입니다. 구체적인 Patch 계약은 `src/vdom/types.js`를 따릅니다.

1. vdom 모듈은 버튼/영역 ID/History를 모릅니다. History는 DOM을 모릅니다. 연결은 Controller에서 합니다.
2. 처음에는 일반 HTML 요소/텍스트/문자열 속성을 지원합니다. 공백 텍스트를 보존하고 주석은 제외합니다. 경로는 주석을 제외한 VDOM 자식에 대응하도록 Patch에서도 동일한 필터를 적용합니다. 태그 이름은 소문자로 통일합니다.
3. 추가/삭제/교체/텍스트/속성 변경을 지원합니다. 기본 자식은 인덱스로 비교하며, 모든 형제에게 key를 준 목록은 key 기반 재정렬을 지원합니다. Playground HTML에서는 `data-key`를 사용합니다.
4. 경로 계산은 `children`이 아니라 텍스트를 포함하는 `childNodes`를 기반으로 합니다. 수정 전 대상 노드 참조를 확보합니다. 자식 삭제 후 다음 트리의 index 오름차순으로 삽입합니다. 교체/삭제되는 부모 아래에는 추가 Patch를 만들지 않습니다.
5. History는 초기 상태를 포함합니다. 저장된 VDOM은 변경하지 않습니다. 경계 이동은 현재 상태를 반환합니다. 뒤로 이동 후 push하면 이후 이력을 제거합니다. 변경이 없는 Patch는 Controller에서 저장하지 않습니다.
6. 이력 이동은 미적용 테스트 편집을 목표 이력으로 덮어씁니다. 테스트 영역은 현재 DOM을 다시 읽어 목표와 비교합니다.
7. 영역 외곽의 제목과 contenteditable 속성은 비교하지 않습니다. 각 컨테이너의 `[data-sample-root]`를 비교 루트로 사용하고 해당 샘플 루트는 편집 중 유지합니다.
8. 이벤트 handler prop은 Phase 2의 `h()`에서 지원합니다. `input.value`/`checked` 현재 프로퍼티와 HTML 속성의 차이, SVG는 아직 지원 정책을 정하지 않았습니다.

## 구현 순서와 분담

1. 모두 함께 VNode/Patch 계약과 작은 변경 예제 하나를 합의합니다.
2. A: DOM 변환 + Render + 속성 처리, 왕복 테스트를 구현합니다.
3. B: Diff의 다섯 케이스와 입력 불변성 테스트를 구현합니다.
4. C: Patch와 연속 삭제/중간 삽입/루트 교체/DOM 참조 유지 테스트를 구현합니다.
5. D: History + Controller + 편집 UI + 버튼 연결을 구현합니다.
6. 모듈을 연결한 뒤 초기화 → 편집 → Patch → 뒤로 → 앞으로를 검증합니다.

## 테스트 기준

Vitest는 변환, 렌더링, Diff 불변성, Patch 구조 변경과 참조 유지, History 분기, Playground 이력 이동을 검사합니다. 남은 TODO 테스트는 통과한 것으로 간주하지 않습니다.

핵심 통합 성질:

```text
domToVNode(patch(render(previous), diff(previous, next))) ≈ next
```

동일한 HTML 결과 외에도 변경되지 않은 DOM 노드의 참조가 유지되는지 확인합니다. 공백, 빈 요소, 속성 삭제, 여러 자식 연속 삭제, 중간 삽입, 루트 교체, 변경 없는 Patch, 이력 경계, 뒤로 이동 후 새 저장을 다룹니다.

jsdom은 실제 브라우저의 레이아웃과 contenteditable 동작을 완전히 재현하지 않습니다. 기능 연결 후 브라우저에서 텍스트 수정/태그 추가/속성 수정/Patch/이력 이동과 모바일 폭을 직접 확인합니다. 필요하면 Playwright 기반 브라우저 테스트를 후속으로 추가합니다.

## 선택 확장

변경 목록 시각화, 변경 노드 강조, History 타임라인, key 기반 재정렬, MutationObserver 편집 감지와 미적용 표시, Phase 2 상태 업데이트 batching을 구현했습니다. 규칙과 테스트 범위는 `docs/optional-extensions-plan.md`에 기록합니다.

## 공식 참고 자료

- [Vite 시작하기](https://vite.dev/guide/)
- [Vitest 시작하기](https://vitest.dev/guide/)
- [Vitest 테스트 환경](https://vitest.dev/guide/environment.html)
