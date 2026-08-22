"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Send, LogOut } from "lucide-react";

type Me = { id: string; name: string; role: string; balanceHours: number };
type Req = { id: string; startDate: string; endDate: string; hours: number; status: string; createdAt: string };

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("el-GR");
};

const badge: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING: { label: "Εκκρεμεί", bg: "#C97A2E1A", fg: "#C97A2E" },
  APPROVED: { label: "Εγκρίθηκε", bg: "#2F6F5E1A", fg: "#2F6F5E" },
  REJECTED: { label: "Απορρίφθηκε", bg: "#A8453A1A", fg: "#A8453A" },
};

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [meRes, reqRes] = await Promise.all([fetch("/api/me"), fetch("/api/requests")]);
    if (meRes.ok) setMe(await meRes.json());
    if (reqRes.ok) setRequests(await reqRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: start, endDate: end }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setShowForm(false);
    setStart("");
    setEnd("");
    load();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!me) return <div className="p-8 text-ink/50">Φόρτωση...</div>;

  const days = me.balanceHours / 8;

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
      <header className="flex items-center justify-between">
        <span className="font-disp text-2xl">Κάλυψη</span>
        <button onClick={logout} className="text-sm text-ink/50 flex items-center gap-1.5 hover:text-ink">
          <LogOut size={14} /> Αποσύνδεση
        </button>
      </header>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-white rounded-xl border border-ink/10 p-5 flex items-center justify-between">
          <div>
            <div className="text-sm text-ink/50 mb-1">Γεια σου, {me.name.split(" ")[0]}</div>
            <div className="font-disp text-3xl">Το υπόλοιπό σου</div>
          </div>
          <div className="text-right">
            <div className="font-disp text-4xl font-mono">{days.toFixed(1)}</div>
            <div className="text-xs text-ink/50">ημέρες · {me.balanceHours} ώρες</div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-teal text-white rounded-xl p-5 flex flex-col items-start justify-between hover:opacity-90 transition"
        >
          <PlusCircle size={22} />
          <span className="text-left font-medium">Νέα αίτηση άδειας</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitRequest} className="bg-white rounded-xl border border-ink/10 p-5">
          <div className="font-disp text-lg mb-3">Αίτηση άδειας</div>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm">
              <div className="text-ink/50 mb-1">Από</div>
              <input type="date" required value={start} onChange={(e) => setStart(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <div className="text-ink/50 mb-1">Έως</div>
              <input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
            </label>
            <button type="submit" className="bg-ink text-white rounded-lg px-4 py-2 flex items-center gap-2">
              <Send size={15} /> Υποβολή
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-ink/50 px-3 py-2">
              Ακύρωση
            </button>
          </div>
          {error && <div className="text-sm text-brick mt-2">{error}</div>}
          <div className="text-xs text-ink/40 mt-2">
            Οι ώρες υπολογίζονται αυτόματα από τις εργάσιμες ημέρες (Δε–Πα, 8ω/ημέρα).
          </div>
        </form>
      )}

      <div>
        <div className="font-disp text-lg mb-2">Οι αιτήσεις μου</div>
        <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
          {requests.length === 0 && <div className="p-4 text-sm text-ink/40">Δεν υπάρχουν αιτήσεις ακόμα.</div>}
          {requests.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  {fmt(r.startDate)} – {fmt(r.endDate)}
                </div>
                <div className="text-xs text-ink/40 font-mono">{r.hours} ώρες</div>
              </div>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: badge[r.status].bg, color: badge[r.status].fg }}
              >
                {badge[r.status].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
