import React from "react";
import ReactDOM from "react-dom/client";
import Portal from "./pages/Portal.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Portal apiBase="/api/sandbox/portal" sandbox />
  </React.StrictMode>,
);
