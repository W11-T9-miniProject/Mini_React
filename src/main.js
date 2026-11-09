import './styles/main.css';
import { setupPlayground } from './playground/controller.js';
import { setupComparison } from './playground/comparison.js';
import { setupStatePlayground } from './playground/state.js';
import { setupPhase2Comparison } from './playground/phase2-comparison.js';
import { setupPhase2Performance } from './playground/phase2-performance.js';
import { setupBatchComparison } from './playground/batch-comparison.js';
setupPlayground();
setupComparison();
setupStatePlayground();
setupPhase2Comparison();

setupPhase2Performance();
setupBatchComparison();
