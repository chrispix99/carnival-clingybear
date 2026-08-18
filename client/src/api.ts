// Typed RPC client. Types come straight from `server/src/actions.ts` — no
// codegen. `createActionClient` returns a proxy that POSTs `{action, args}`
// to `./actions` and returns the typed response.
//
// `import type { Actions }` is type-only by design: the client bundle never
// pulls in any server runtime (bun:sqlite, file APIs, etc.). With
// `verbatimModuleSyntax: true`, dropping `type` is a compile error.

import type { Actions } from "../../server/src/actions";
import { createActionClient } from "@hatch/space-sdk/client";

// Password header injection: all actions require clingy2026
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url.includes("/actions") || url.includes("actions")) {
      const password = (() => {
        try { return localStorage.getItem("carnival_auth") || ""; } catch { return ""; }
      })();
      const cookiePass = (() => {
        try {
          const m = document.cookie.match(/(?:^|; )carnival_auth=([^;]*)/);
          return m ? decodeURIComponent(m[1]!) : "";
        } catch { return ""; }
      })();
      const pw = password || cookiePass || "clingy2026";
      init = init || {};
      const headers = new Headers(init.headers || {});
      if (pw) headers.set("x-carnival-password", pw);
      // also set Authorization as fallback for basic auth
      if (pw) headers.set("Authorization", `Bearer ${pw}`);
      init.headers = headers;
    }
  } catch {}
  return originalFetch(input as any, init);
};

export const api = createActionClient<typeof Actions>();

// Re-exported for convenience so client code can do
//
//     import { api, type ApiResponse } from "./api";
//     type Article = ApiResponse<typeof api, "listArticles">["articles"][number];
//
// They are also available directly from "@hatch/space-sdk/client".
export type { ApiRequest, ApiResponse } from "@hatch/space-sdk/client";
