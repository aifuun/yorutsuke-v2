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

// ==================== Bootstrap ====================
// Initialize all services BEFORE rendering React
// Ensures no "flashing" of uninitialized state
// See: app/src/00_kernel/bootstrap.ts
import { bootstrapServices } from "./00_kernel/bootstrap";

bootstrapServices().then(() => {
  const rootElement = document.getElementById("root");

  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  }
}).catch((error) => {
  console.error("Failed to bootstrap app:", error);
  // Show error message to user
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = '<div style="padding: 20px; color: red;">Failed to initialize app. Please refresh the page.</div>';
  }
});
