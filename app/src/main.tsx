import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Initialize i18n before rendering
import "./i18n";

// Disable right-click context menu in production app
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Initialize services (registers Tauri listeners once, outside React lifecycle)
// MVP0: Fixes #82 StrictMode race condition
import { captureService } from "./02_modules/capture/services/captureService";
import { quotaService } from "./02_modules/capture/services/quotaService";
captureService.init();
quotaService.init();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
