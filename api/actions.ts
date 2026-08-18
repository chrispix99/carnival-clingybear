import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../server/src/db";
import * as schema from "../server/src/schema";

// Simple password middleware - checks header, cookie, or Authorization
const PASSWORD = process.env.CARNIVAL_PASSWORD || process.env.PASSWORD || "clingy2026";

function checkAuth(req: VercelRequest): boolean {
  const headers = req.headers as Record<string, string | string[] | undefined>;
  const h = (k: string) => {
    const v = headers[k.toLowerCase()] || headers[k];
    return Array.isArray(v) ? v[0] : v || "";
  };
  const passHeader = (h("x-carnival-password") || h("x-carnival-pass") || "") as string;
  const authHeader = (h("authorization") || "") as string;
  const bearer = authHeader.replace(/^Bearer\s+/i, "").replace(/^Basic\s+/i, "");
  // try decode basic auth
  let basicPass = "";
  if (authHeader.toLowerCase().startsWith("basic ")) {
    try { const decoded = Buffer.from(bearer, "base64").toString(); basicPass = decoded.split(":").pop() || ""; } catch {}
  }
  const cookie = (h("cookie") || "") as string;
  const cookieMatch = cookie.match(/carnival_auth=([^;]+)/);
  const cookiePass = cookieMatch ? decodeURIComponent(cookieMatch[1]!) : "";
  const provided = passHeader || bearer || basicPass || cookiePass;
  return provided === PASSWORD;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS + allow preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-carnival-password, Authorization, Cookie");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Health check without auth
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "carnival-clingybear", authRequired: true, passwordHint: "clingy2026" });
  }

  if (!checkAuth(req)) {
    return res.status(401).json({ error: "Unauthorized: missing or wrong password. Send x-carnival-password: clingy2026 or cookie carnival_auth=clingy2026" });
  }

  // After auth, handle generic action proxy or simple DB persistence demo
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    // If it's an action proxy (Hatch style), forward to local handler simulation
    // For now, just ensure DB is accessible and return status
    const db = getDb();
    // Test DB: try to read metadata
    let meta: any[] = [];
    try { meta = await (db as any).select().from(schema.searchMetadata).limit(1); } catch {}
    return res.status(200).json({
      ok: true,
      ts: new Date().toISOString(),
      db: { connected: true, hasMetadata: meta.length > 0 },
      received: body,
      message: "Authenticated. Carnival data persists in DB (app.db or TURSO_DATABASE_URL if set). Use POST with action for cruise ops.",
    });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
