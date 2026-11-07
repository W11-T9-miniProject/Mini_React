# Mini React 작업 규칙

- Mini React는 Vanilla JavaScript로 Virtual DOM, Diff/Patch, 함수형 컴포넌트와 Hooks를 구현하는 학습 프로젝트다.
- 구현 전에 변경할 모듈의 계약을 `docs/ARCHITECTURE.md`와 관련 테스트에서 확인한다.
- 현재 작업의 변경 범위를 확인하고 기존 작업자의 수정과 미추적 파일을 보존한다.
- Node.js 24를 사용한다. 관련 Vitest 테스트를 먼저 실행하고, 최종 자동 검증은 `npm run check`로 한다.
- DOM 포커스, 키보드, 한글 IME처럼 실제 브라우저 동작이 성공 조건이면 `docs/MANUAL_TESTS.md`를 참고해 확인하고 결과를 구분해 기록한다.
- 그래프 워크플로를 요청받으면 `docs/AI_WORKFLOW.md`를 따른다.
