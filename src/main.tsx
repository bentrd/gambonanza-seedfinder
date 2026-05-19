import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { initAnalytics } from "./analytics";
import { initRng, loadGambits } from "./rng";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

initAnalytics();
await Promise.all([initRng(), loadGambits()]);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
