import React from "react";
import ReactDOM from "react-dom/client";
import { initAnalytics } from "./analytics.js";
import Article from "./pages/Article.jsx";

initAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Article />
  </React.StrictMode>,
);
