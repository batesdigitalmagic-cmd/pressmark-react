import React from "react";
import ReactDOM from "react-dom/client";
import { initAnalytics } from "./analytics.js";
import Success from "./pages/Success.jsx";

initAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Success />
  </React.StrictMode>,
);
