import React from "react";
import ReactDOM from "react-dom/client";
import { initAnalytics } from "./analytics.js";
import Privacy from "./pages/Privacy.jsx";

initAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Privacy />
  </React.StrictMode>,
);
