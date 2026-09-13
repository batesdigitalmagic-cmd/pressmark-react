import React from "react";
import ReactDOM from "react-dom/client";
import { initAnalytics } from "./analytics.js";
import DirectoryDesigns from "./pages/DirectoryDesigns.jsx";

initAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DirectoryDesigns />
  </React.StrictMode>,
);
