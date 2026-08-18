import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { spaceQueryClient } from "@hatch/space-sdk/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { PasswordGate } from "./PasswordGate";
import "./theme.css";

const rootEl = document.querySelector<HTMLElement>("[data-generated-space-root]");
if (!rootEl) {
  throw new Error("missing generated space root element");
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={spaceQueryClient}>
      <div className="hatch-space-root" data-hatch-space-root>
        <PasswordGate>
          <App />
        </PasswordGate>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
