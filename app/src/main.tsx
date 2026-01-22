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

// Disable right-click context menu in production app
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Initialize services (registers Tauri listeners once, outside React lifecycle)
// MVP0: Fixes #82 StrictMode race condition
// ADR-001: Service Pattern - Services register global listeners once at app startup
// ⚠️ ORDER MATTERS: Services may depend on each other during initialization
//    See analysis: networkMonitor → quotaService → captureService → autoSyncService → transactionSyncService
import { captureService } from "./02_modules/capture/services/captureService";
import { quotaService } from "./02_modules/capture/services/quotaService";
import { transactionSyncService } from "./02_modules/transaction/services/transactionSyncService";
import { networkMonitor, autoSyncService } from "./02_modules/sync";

// Step 1: Initialize networkMonitor (no dependencies)
// Used by: autoSyncService.init() - MUST be first
networkMonitor.initialize(); // Issue #86: Network monitoring for offline queue

// Step 2: Initialize quotaService (no dependencies)
quotaService.init();

// Step 3: Initialize captureService (calls uploadService.init() internally)
// uploadService depends on: quotaService ✓, networkMonitor events (not init-time)
captureService.init();

// Step 4: Initialize autoSyncService (calls networkMonitor.subscribe())
// MUST be after networkMonitor.initialize() ✓
autoSyncService.init(); // Issue #86: Auto-sync after local operations (confirm/edit/delete)

// Step 5: Initialize transactionSyncService (no dependencies on other services)
transactionSyncService.init(); // Issue #108: Auto-sync after upload

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
