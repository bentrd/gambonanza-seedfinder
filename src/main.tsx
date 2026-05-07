import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { initRng } from "./rng";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

await initRng();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
