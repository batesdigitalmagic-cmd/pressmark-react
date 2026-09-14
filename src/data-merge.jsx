import React from "react";
import ReactDOM from "react-dom/client";
import { initAnalytics } from "./analytics.js";
import DataMerge from "./pages/DataMerge.jsx";

initAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DataMerge />
  </React.StrictMode>,
);
