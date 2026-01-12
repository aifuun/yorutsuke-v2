import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./components/Spinner.css";
import "./components/Skeleton.css";
import "./components/Toast/Toast.css";
import "./components/Button/Button.css";
import "./components/Modal/Modal.css";
import "./components/Input/Input.css";
import "./components/Select/Select.css";
import "./components/Textarea/Textarea.css";
import "./components/Checkbox/Checkbox.css";
import "./components/Radio/Radio.css";
import "./components/EmptyState/EmptyState.css";
import "./components/ErrorState/ErrorState.css";
import "./components/Progress/Progress.css";

// Initialize i18n before rendering
import "./i18n";

console.log('[MAIN] Starting initialization...');

// Disable right-click context menu in production app
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Initialize services (registers Tauri listeners once, outside React lifecycle)
// MVP0: Fixes #82 StrictMode race condition
// ADR-001: Service Pattern - Services register global listeners once at app startup
import { captureService } from "./02_modules/capture/services/captureService";
import { quotaService } from "./02_modules/capture/services/quotaService";
import { transactionSyncService } from "./02_modules/transaction/services/transactionSyncService";
import { networkMonitor } from "./02_modules/sync";

console.log('[MAIN] Initializing services...');
captureService.init();
quotaService.init();
transactionSyncService.init(); // Issue #108: Auto-sync after upload
networkMonitor.initialize(); // Issue #86: Network monitoring for offline queue

console.log('[MAIN] Services initialized, mounting React...');
const rootElement = document.getElementById("root");
console.log('[MAIN] Root element:', rootElement);

if (!rootElement) {
  console.error('[MAIN] ERROR: Root element not found!');
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    console.log('[MAIN] React mounted successfully');
  } catch (error) {
    console.error('[MAIN] ERROR: Failed to mount React:', error);
  }
}
