import { setupJourney } from './characters/journey.js';

export function setupApplication(scope = document) {
  const journey = setupJourney(scope.querySelector('#node-journey'));
  return {
    journey,
    destroy() {
      journey.destroy();
    },
  };
}
