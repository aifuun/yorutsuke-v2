import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Initialize i18n before rendering
import "./i18n";

// Initialize capture service (registers Tauri listeners once, outside React lifecycle)
// MVP0: Fixes #82 StrictMode race condition
import { captureService } from "./02_modules/capture/services/captureService";
captureService.init();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
