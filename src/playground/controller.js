import { sampleHTML } from './sample.js';

export function setupPlayground() {
  const actualContainer = document.querySelector('#actual-root');
  const testContainer = document.querySelector('#test-root');
  // 초기 화면 배치만 수행한다. VDOM 구현 후 아래 초기화를 교체한다.
  actualContainer.innerHTML = sampleHTML;
  testContainer.innerHTML = sampleHTML;
  // TODO: 실제 샘플 → VDOM → render로 테스트 영역 생성 → History 초기화.
  // TODO: Patch 클릭 → 테스트 DOM 변환 → diff → patch → 변경 시 history.push.
  // TODO: undo/redo 전 이전 VDOM 보관. 두 영역을 목표 이력으로 동기화.
  // TODO: 연결한 버튼의 disabled 해제 및 이동 가능 여부 갱신.
}
