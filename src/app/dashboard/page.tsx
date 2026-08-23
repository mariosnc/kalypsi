"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Send, LogOut, AlertTriangle, KeyRound } from "lucide-react";

type Me = { id: string; name: string; role: string; department: string | null; balanceHours: number };
type Req = {
  id: string;
  startDate: string;
  endDate: string;
  hours: number;
  status: string;
  createdAt: string;
  rejectionReason?: string | null;
};
type CoverageDay = { date: string; byDept: Record<string, number> };
type RuleRow = { department: string; minStaff: number };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("el-GR");

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
  const [coverageWarning, setCoverageWarning] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");

  const load = useCallback(async () => {
    const [meRes, reqRes] = await Promise.all([fetch("/api/me"), fetch("/api/requests")]);
    if (meRes.ok) setMe(await meRes.json());
    if (reqRes.ok) setRequests(await reqRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // live check: αν το επιλεγμένο εύρος ρίχνει την κάλυψη του τμήματός μου κάτω από το ελάχιστο
  useEffect(() => {
    async function check() {
      setCoverageWarning("");
      if (!me?.department || !start || !end || end < start) return;

      const months = new Set<string>();
      months.add(start.slice(0, 7));
      months.add(end.slice(0, 7));

      const [ruleRes, ...covResArr] = await Promise.all([
        fetch("/api/staffing-rule"),
        ...Array.from(months).map((m) => fetch(`/api/coverage?month=${m}`)),
      ]);
      if (!ruleRes.ok) return;
      const rules: RuleRow[] = await ruleRes.json();
      const minStaff = rules.find((r) => r.department === me.department)?.minStaff;
      if (minStaff === undefined) return;

      let days: CoverageDay[] = [];
      for (const res of covResArr) {
        if (res.ok) days = days.concat((await res.json()).days);
      }

      const conflictDays: string[] = [];
      const cur = new Date(start + "T00:00:00Z");
      const endD = new Date(end + "T00:00:00Z");
      while (cur <= endD) {
        const dow = cur.getUTCDay();
        if (dow !== 0 && dow !== 6) {
          const iso = cur.toISOString().slice(0, 10);
          const avail = days.find((d) => d.date === iso)?.byDept?.[me.department!];
          if (avail !== undefined && avail - 1 < minStaff) conflictDays.push(fmt(iso));
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      if (conflictDays.length > 0) {
        setCoverageWarning(
          `Στις παρακάτω ημέρες το τμήμα σου είναι ήδη στο (ή κοντά στο) ελάχιστο προσωπικό — η αίτηση μπορεί να χρειαστεί ιδιαίτερη έγκριση: ${conflictDays.join(", ")}`
        );
      }
    }
    check();
  }, [start, end, me]);

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
    setCoverageWarning("");
    load();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassError("");
    setPassMsg("");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: curPass, newPassword: newPass }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPassError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setPassMsg("Ο κωδικός άλλαξε επιτυχώς.");
    setCurPass("");
    setNewPass("");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!me) return <div className="p-8 text-ink/50">Φόρτωση...</div>;

  const approxDays = me.balanceHours / 8;

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
      <header className="flex items-center justify-between">
        <span className="font-disp text-2xl">Κάλυψη</span>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowPassword((s) => !s)} className="text-sm text-ink/50 flex items-center gap-1.5 hover:text-ink">
            <KeyRound size={14} /> Αλλαγή κωδικού
          </button>
          <button onClick={logout} className="text-sm text-ink/50 flex items-center gap-1.5 hover:text-ink">
            <LogOut size={14} /> Αποσύνδεση
          </button>
        </div>
      </header>

      {showPassword && (
        <form onSubmit={changePassword} className="bg-white rounded-xl border border-ink/10 p-5 space-y-3 max-w-sm">
          <div className="font-disp text-lg">Αλλαγή κωδικού</div>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Τρέχων κωδικός</div>
            <input type="password" required value={curPass} onChange={(e) => setCurPass(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Νέος κωδικός</div>
            <input type="password" required value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
          </label>
          {passError && <div className="text-sm text-brick">{passError}</div>}
          {passMsg && <div className="text-sm text-teal">{passMsg}</div>}
          <button type="submit" className="bg-ink text-white rounded-lg px-4 py-2 text-sm">Αποθήκευση</button>
        </form>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-white rounded-xl border border-ink/10 p-5 flex items-center justify-between">
          <div>
            <div className="text-sm text-ink/50 mb-1">Γεια σου, {me.name.split(" ")[0]}</div>
            <div className="font-disp text-3xl">Το υπόλοιπό σου</div>
          </div>
          <div className="text-right">
            <div className="font-disp text-4xl font-mono">{me.balanceHours}</div>
            <div className="text-xs text-ink/50">ώρες · ≈{approxDays.toFixed(1)} ημέρες</div>
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
          {coverageWarning && (
            <div className="mt-3 flex items-start gap-2 text-xs bg-amber/10 text-[#8f5620] rounded-lg p-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{coverageWarning}</span>
            </div>
          )}
          <div className="text-xs text-ink/40 mt-2">
            Οι ώρες υπολογίζονται αυτόματα: 10 ώρες τη Δευτέρα, 11 ώρες Τρίτη–Παρασκευή, χωρίς Σαββατοκύριακα.
          </div>
        </form>
      )}

      <div>
        <div className="font-disp text-lg mb-2">Οι αιτήσεις μου</div>
        <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
          {requests.length === 0 && <div className="p-4 text-sm text-ink/40">Δεν υπάρχουν αιτήσεις ακόμα.</div>}
          {requests.map((r) => (
            <div key={r.id} className="p-4">
              <div className="flex items-center justify-between">
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
              {r.status === "REJECTED" && r.rejectionReason && (
                <div className="mt-2 text-xs text-brick bg-brick/5 rounded-lg p-2">
                  Αιτιολόγηση: {r.rejectionReason}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
