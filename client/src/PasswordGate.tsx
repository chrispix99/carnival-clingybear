import { useState, useEffect, type ReactNode } from "react";

const PASSWORD = "clingy2026";
const STORAGE_KEY = "carnival_auth";

export function useAuth() {
  const [authed, setAuthed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === PASSWORD;
    } catch {
      return false;
    }
  });
  const login = (pw: string) => {
    if (pw === PASSWORD) {
      try { localStorage.setItem(STORAGE_KEY, pw); } catch {}
      setAuthed(true);
      // set cookie for server-side checks (Vercel functions)
      document.cookie = `carnival_auth=${pw}; path=/; max-age=31536000; SameSite=Lax`;
      return true;
    }
    return false;
  };
  const logout = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    document.cookie = "carnival_auth=; path=/; max-age=0";
    setAuthed(false);
  };
  // ensure cookie sync on mount
  useEffect(() => {
    if (authed) {
      document.cookie = `carnival_auth=${PASSWORD}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [authed]);
  return { authed, login, logout };
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const { authed, login } = useAuth();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  if (authed) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError("");
    setTimeout(() => {
      if (!login(input)) {
        setError("Wrong password. Try clingy2026");
      }
      setChecking(false);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="w-full max-w-md bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#d4af37] flex items-center justify-center">🛳️</div>
          <div>
            <h1 className="text-lg font-bold" style={{ fontFamily: "Playfair Display, serif" }}>Carnival Casino Finder</h1>
            <p className="text-xs text-[#888]">carnival.clingybear.com • private</p>
          </div>
        </div>
        <h2 className="text-sm font-semibold mb-2">Enter password to access</h2>
        <p className="text-xs text-[#666] mb-4">This site is password protected. Use the password you were given.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder:text-[#555] focus:outline-none focus:border-[#d4af37]"
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={checking || !input} className="w-full py-3 rounded-lg bg-[#d4af37] text-black font-semibold text-sm hover:bg-[#e5c35a] disabled:opacity-50 transition">
            {checking ? "Checking..." : "Unlock"}
          </button>
        </form>
        <p className="text-[11px] text-[#555] mt-4 text-center">Password: <span className="font-mono text-[#888]">clingy2026</span> • Cookie + localStorage auth</p>
      </div>
    </div>
  );
}
