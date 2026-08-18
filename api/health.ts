import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({
    ok: true,
    service: "carnival-clingybear",
    domain: "carnival.clingybear.com",
    password: "clingy2026 (send as x-carnival-password header or cookie carnival_auth)",
    db: "SQLite app.db + Turso/libSQL if TURSO_DATABASE_URL set",
    live: "https://carnival.clingybear.com",
    vercel: "https://carnival-clingybear.vercel.app",
  });
}
