import React from "react";
import ReactDOM from "react-dom/client";
import { initAnalytics } from "./analytics.js";
import Blog from "./pages/Blog.jsx";

initAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Blog />
  </React.StrictMode>,
);
