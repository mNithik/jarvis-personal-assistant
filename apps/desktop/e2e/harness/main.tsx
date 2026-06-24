import React from "react";
import ReactDOM from "react-dom/client";
import { installTauriMock } from "../fixtures/tauri-mock";
import HarnessApp from "./HarnessApp";
import "@desktop/styles.css";

installTauriMock();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HarnessApp />
  </React.StrictMode>,
);
