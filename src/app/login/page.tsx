"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Η σύνδεση απέτυχε.");
      return;
    }
    const user = await res.json();
    router.push(user.role === "ADMIN" ? "/admin" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-disp text-3xl">Κάλυψη</span>
          <p className="text-sm text-ink/50 mt-1">Σύνδεση στο σύστημα αδειών</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-xl border border-ink/10 p-6 space-y-4">
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Όνομα χρήστη</div>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-ink/15 rounded-lg px-3 py-2"
              placeholder="π.χ. eleni"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Κωδικός</div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-ink/15 rounded-lg px-3 py-2"
            />
          </label>
          {error && <div className="text-sm text-brick">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
          >
            {loading ? "Σύνδεση..." : "Σύνδεση"}
          </button>
        </form>
        <p className="text-xs text-ink/40 text-center mt-4">
          Demo: admin@company.gr / eleni@company.gr — κωδικός: password123
        </p>
      </div>
    </div>
  );
}
