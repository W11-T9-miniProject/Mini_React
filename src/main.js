import './styles/main.css';
import { setupApplication } from './bootstrap.js';

const application = setupApplication();
// 개발 중 HMR에서도 Observer와 interval이 중복 등록되지 않게 정리한다.
if (import.meta.hot) import.meta.hot.dispose(() => application.destroy());
