"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Printer, AlertTriangle, Users, LogOut, CalendarDays, UserPlus } from "lucide-react";

type PendingReq = {
  id: string;
  startDate: string;
  endDate: string;
  hours: number;
  status: string;
  user: { id: string; name: string; department: string | null; balanceHours: number };
};
type RosterRow = { id: string; name: string; department: string | null; onLeave: boolean };
type CoverageDay = { date: string; available: number };
type EmployeeRow = { id: string; name: string; email: string; department: string | null; balanceHours: number };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("el-GR");
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "roster" | "balances" | "new">("pending");
  const [pending, setPending] = useState<PendingReq[]>([]);
  const [minStaff, setMinStaff] = useState(1);
  const [coverage, setCoverage] = useState<CoverageDay[]>([]);
  const [rosterDate, setRosterDate] = useState(todayISO());
  const [roster, setRoster] = useState<{ working: number; total: number; roster: RosterRow[] } | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [adjustAmt, setAdjustAmt] = useState<Record<string, string>>({});

  // new employee form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newBalanceDays, setNewBalanceDays] = useState("20");
  const [newRole, setNewRole] = useState<"EMPLOYEE" | "ADMIN">("EMPLOYEE");
  const [newError, setNewError] = useState("");
  const [newSuccess, setNewSuccess] = useState("");

  const loadPending = useCallback(async () => {
    const res = await fetch("/api/requests?status=PENDING");
    if (res.ok) setPending(await res.json());
  }, []);

  const loadRule = useCallback(async () => {
    const res = await fetch("/api/staffing-rule");
    if (res.ok) setMinStaff((await res.json()).minStaff);
  }, []);

  const loadCoverage = useCallback(async () => {
    const month = todayISO().slice(0, 7);
    const res = await fetch(`/api/coverage?month=${month}`);
    if (res.ok) setCoverage((await res.json()).days);
  }, []);

  const loadRoster = useCallback(async (date: string) => {
    const res = await fetch(`/api/roster?date=${date}`);
    if (res.ok) setRoster(await res.json());
  }, []);

  const loadEmployees = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) setEmployees(await res.json());
  }, []);

  useEffect(() => {
    loadPending();
    loadRule();
    loadCoverage();
  }, [loadPending, loadRule, loadCoverage]);

  useEffect(() => {
    if (tab === "roster") loadRoster(rosterDate);
  }, [tab, rosterDate, loadRoster]);

  useEffect(() => {
    if (tab === "balances") loadEmployees();
  }, [tab, loadEmployees]);

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    await fetch(`/api/requests/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    loadPending();
    loadCoverage();
  }

  async function updateMinStaff(v: number) {
    setMinStaff(v);
    await fetch("/api/staffing-rule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minStaff: v }),
    });
  }

  async function applyAdjust(userId: string) {
    const val = Number(adjustAmt[userId] || 0);
    if (!val) return;
    await fetch(`/api/users/${userId}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: val, reason: "Χειροκίνητη προσαρμογή" }),
    });
    setAdjustAmt((a) => ({ ...a, [userId]: "" }));
    loadEmployees();
  }

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setNewError("");
    setNewSuccess("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        email: newEmail,
        password: newPassword,
        department: newDept,
        balanceDays: newBalanceDays,
        role: newRole,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNewError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setNewSuccess(`Ο/Η ${newName} προστέθηκε ως ${newRole === "ADMIN" ? "διαχειριστής" : "υπάλληλος"}. Δώσε του/της email: ${newEmail} και τον κωδικό που όρισες.`);
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewDept("");
    setNewBalanceDays("20");
    setNewRole("EMPLOYEE");
    loadEmployees();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const coverageForDate = (iso: string) => coverage.find((c) => c.date === iso)?.available;

  return (
    <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">
      <header className="no-print flex items-center justify-between">
        <span className="font-disp text-2xl">Κάλυψη — Διαχειριστής</span>
        <button onClick={logout} className="text-sm text-ink/50 flex items-center gap-1.5 hover:text-ink">
          <LogOut size={14} /> Αποσύνδεση
        </button>
      </header>

      <div className="no-print flex gap-2 flex-wrap">
        {[
          ["pending", `Εκκρεμείς (${pending.length})`],
          ["roster", "Ημερήσια κατάσταση"],
          ["balances", "Υπόλοιπα"],
          ["new", "Νέος υπάλληλος"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              tab === key ? "bg-ink text-white" : "bg-white border border-ink/10 text-ink/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="space-y-3">
          <div className="no-print flex items-center gap-2 text-sm bg-white rounded-xl border border-ink/10 p-3 w-fit">
            <Users size={15} className="text-ink/50" />
            <span className="text-ink/50">Ελάχιστο προσωπικό / ημέρα</span>
            <input
              type="number"
              min={0}
              value={minStaff}
              onChange={(e) => updateMinStaff(Number(e.target.value))}
              className="w-14 border border-ink/15 rounded-lg px-2 py-1 font-mono"
            />
          </div>

          {pending.length === 0 && (
            <div className="text-sm text-ink/40 bg-white rounded-xl border border-ink/10 p-6 text-center">
              Καμία εκκρεμής αίτηση.
            </div>
          )}

          {pending.map((r) => {
            const afterBalance = (r.user.balanceHours - r.hours) / 8;
            const shortage: string[] = [];
            let cur = new Date(r.startDate);
            const endD = new Date(r.endDate);
            while (cur <= endD) {
              const iso = cur.toISOString().slice(0, 10);
              const dow = cur.getUTCDay();
              if (dow !== 0 && dow !== 6) {
                const avail = coverageForDate(iso);
                if (avail !== undefined && avail - 1 < minStaff) shortage.push(fmt(iso));
              }
              cur.setUTCDate(cur.getUTCDate() + 1);
            }

            return (
              <div key={r.id} className="bg-white rounded-xl border border-ink/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.user.name}</div>
                    <div className="text-sm text-ink/50">
                      {fmt(r.startDate)} – {fmt(r.endDate)} · <span className="font-mono">{r.hours} ώρες</span> ·
                      υπόλοιπο μετά: <span className="font-mono">{afterBalance.toFixed(1)}μ</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(r.id, "REJECTED")}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-brick/30 text-brick hover:bg-brick/5"
                    >
                      <XCircle size={15} /> Απόρριψη
                    </button>
                    <button
                      onClick={() => decide(r.id, "APPROVED")}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-teal text-white hover:opacity-90"
                    >
                      <CheckCircle2 size={15} /> Έγκριση
                    </button>
                  </div>
                </div>
                {shortage.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 text-xs bg-amber/10 text-[#8f5620] rounded-lg p-2.5">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>Αν εγκριθεί, η κάλυψη πέφτει κάτω από το ελάχιστο ({minStaff}) στις: {shortage.join(", ")}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "roster" && (
        <div>
          <div className="no-print flex items-center justify-between mb-4 flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm">
              <CalendarDays size={16} className="text-ink/50" />
              <input
                type="date"
                value={rosterDate}
                onChange={(e) => setRosterDate(e.target.value)}
                className="border border-ink/15 rounded-lg px-3 py-2"
              />
            </label>
            <button onClick={() => window.print()} className="flex items-center gap-2 text-sm bg-ink text-white px-4 py-2 rounded-lg">
              <Printer size={15} /> Εκτύπωση
            </button>
          </div>

          <div className="bg-white rounded-xl border border-ink/10 p-5">
            <div className="font-disp text-xl mb-1">Κατάσταση προσωπικού</div>
            {roster && (
              <>
                <div className="text-sm text-ink/50 mb-4">
                  {fmt(rosterDate)} · εργάζονται <span className="font-mono">{roster.working}</span> από{" "}
                  <span className="font-mono">{roster.total}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink/40 border-b border-ink/10">
                      <th className="py-2 font-normal">Όνομα</th>
                      <th className="py-2 font-normal">Τμήμα</th>
                      <th className="py-2 font-normal text-right">Κατάσταση</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.roster.map((e) => (
                      <tr key={e.id} className="border-b border-ink/5">
                        <td className="py-2">{e.name}</td>
                        <td className="py-2 text-ink/50">{e.department}</td>
                        <td className="py-2 text-right">
                          {e.onLeave ? <span className="text-brick">Άδεια</span> : <span className="text-teal">Εργασία</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "balances" && (
        <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
          {employees.map((e) => (
            <div key={e.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-ink/40">{e.email}</div>
                <div className="text-sm text-ink/50 font-mono">
                  {(e.balanceHours / 8).toFixed(1)} ημέρες · {e.balanceHours} ώρες
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="ώρες +/-"
                  value={adjustAmt[e.id] || ""}
                  onChange={(ev) => setAdjustAmt((a) => ({ ...a, [e.id]: ev.target.value }))}
                  className="w-24 border border-ink/15 rounded-lg px-2 py-1.5 text-sm font-mono"
                />
                <button onClick={() => applyAdjust(e.id)} className="text-sm px-3 py-1.5 rounded-lg bg-ink text-white">
                  Εφαρμογή
                </button>
              </div>
            </div>
          ))}
          {employees.length === 0 && <div className="p-4 text-sm text-ink/40">Φόρτωση...</div>}
        </div>
      )}

      {tab === "new" && (
        <form onSubmit={createEmployee} className="bg-white rounded-xl border border-ink/10 p-5 max-w-md space-y-4">
          <div className="font-disp text-lg flex items-center gap-2">
            <UserPlus size={20} /> Νέος υπάλληλος
          </div>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Ονοματεπώνυμο</div>
            <input required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Όνομα χρήστη</div>
            <input required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" placeholder="π.χ. eleni" autoCapitalize="none" autoCorrect="off" />
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Αρχικός κωδικός (πες του τον, μπορεί να τον αλλάξει αργότερα)</div>
            <input required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" placeholder="τουλάχιστον 6 χαρακτήρες" />
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Ρόλος</div>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as "EMPLOYEE" | "ADMIN")} className="w-full border border-ink/15 rounded-lg px-3 py-2 bg-white">
              <option value="EMPLOYEE">Υπάλληλος</option>
              <option value="ADMIN">Διαχειριστής</option>
            </select>
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Τμήμα (προαιρετικό)</div>
            <input value={newDept} onChange={(e) => setNewDept(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Αρχικό υπόλοιπο άδειας (ημέρες)</div>
            <input type="number" step="0.5" value={newBalanceDays} onChange={(e) => setNewBalanceDays(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
          </label>
          {newError && <div className="text-sm text-brick">{newError}</div>}
          {newSuccess && <div className="text-sm text-teal">{newSuccess}</div>}
          <button type="submit" className="w-full bg-teal text-white rounded-lg py-2.5 font-medium">
            Δημιουργία λογαριασμού
          </button>
        </form>
      )}
    </div>
  );
}
