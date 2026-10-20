import React from "react";
import ReactDOM from "react-dom/client";
import { initAnalytics } from "./analytics.js";
import EnhanceCutout from "./pages/EnhanceCutout.jsx";

initAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <EnhanceCutout />
  </React.StrictMode>,
);
