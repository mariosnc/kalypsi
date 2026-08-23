"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Printer, AlertTriangle, Users, LogOut, CalendarDays, UserPlus, KeyRound, Stethoscope, GraduationCap, Trash2 } from "lucide-react";

type PendingReq = {
  id: string;
  startDate: string;
  endDate: string;
  hours: number;
  status: string;
  user: { id: string; name: string; department: string | null; balanceHours: number };
};
type RosterRow = { id: string; name: string; department: string | null; onLeave: boolean };
type CoverageDay = { date: string; byDept: Record<string, number> };
type StaffingRuleRow = { id: string; department: string; totalForce: number };
type EmployeeRow = { id: string; name: string; email: string; department: string | null; balanceHours: number };
type AbsenceRow = { id: string; department: string; type: "DOCTOR" | "TRAINING"; count: number; startDate: string; endDate: string };

const DEPARTMENTS = ["Μονιάτης", "Πελένδρι", "Αγρός", "Εφταγώνια", "Πάχνα", "Κυβίδες"];

const fmt = (iso: string) => new Date(iso).toLocaleDateString("el-GR");
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "roster" | "balances" | "new" | "absences">("pending");
  const [pending, setPending] = useState<PendingReq[]>([]);
  const [rules, setRules] = useState<StaffingRuleRow[]>([]);
  const [coverage, setCoverage] = useState<CoverageDay[]>([]);
  const [rosterDate, setRosterDate] = useState(todayISO());
  const [roster, setRoster] = useState<{ working: number; total: number; roster: RosterRow[] } | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [adjustAmt, setAdjustAmt] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [absDept, setAbsDept] = useState(DEPARTMENTS[0]);
  const [absType, setAbsType] = useState<"DOCTOR" | "TRAINING">("DOCTOR");
  const [absCount, setAbsCount] = useState("1");
  const [absStart, setAbsStart] = useState(todayISO());
  const [absEnd, setAbsEnd] = useState(todayISO());
  const [absError, setAbsError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newBalanceHours, setNewBalanceHours] = useState("160");
  const [newRole, setNewRole] = useState<"EMPLOYEE" | "ADMIN">("EMPLOYEE");
  const [newError, setNewError] = useState("");
  const [newSuccess, setNewSuccess] = useState("");

  const loadPending = useCallback(async () => {
    const res = await fetch("/api/requests?status=PENDING");
    if (res.ok) setPending(await res.json());
  }, []);

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/staffing-rule");
    if (res.ok) setRules(await res.json());
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

  const loadAbsences = useCallback(async () => {
    const res = await fetch("/api/absences");
    if (res.ok) setAbsences(await res.json());
  }, []);

  useEffect(() => {
    loadPending();
    loadRules();
    loadCoverage();
  }, [loadPending, loadRules, loadCoverage]);

  useEffect(() => {
    if (tab === "roster") loadRoster(rosterDate);
  }, [tab, rosterDate, loadRoster]);

  useEffect(() => {
    if (tab === "balances") loadEmployees();
  }, [tab, loadEmployees]);

  useEffect(() => {
    if (tab === "absences") loadAbsences();
  }, [tab, loadAbsences]);

  async function decide(id: string, decision: "APPROVED" | "REJECTED", reason?: string) {
    await fetch(`/api/requests/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    setRejectingId(null);
    setRejectReason("");
    loadPending();
    loadCoverage();
  }

  async function updateTotalForce(department: string, v: number) {
    setRules((rs) => rs.map((r) => (r.department === department ? { ...r, totalForce: v } : r)));
    await fetch("/api/staffing-rule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department, totalForce: v }),
    });
    loadCoverage();
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

  async function addAbsence(e: React.FormEvent) {
    e.preventDefault();
    setAbsError("");
    const res = await fetch("/api/absences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department: absDept, type: absType, count: absCount, startDate: absStart, endDate: absEnd }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAbsError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setAbsCount("1");
    loadAbsences();
    loadCoverage();
  }

  async function removeAbsence(id: string) {
    await fetch(`/api/absences/${id}`, { method: "DELETE" });
    loadAbsences();
    loadCoverage();
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
        balanceHours: newBalanceHours,
        role: newRole,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNewError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setNewSuccess(`Ο/Η ${newName} προστέθηκε ως ${newRole === "ADMIN" ? "διαχειριστής" : "υπάλληλος"}. Δώσε του/της όνομα χρήστη: ${newEmail} και τον κωδικό που όρισες.`);
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewDept("");
    setNewBalanceHours("160");
    setNewRole("EMPLOYEE");
    loadRules();
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

  const coverageForDate = (iso: string, dept: string) => coverage.find((c) => c.date === iso)?.byDept?.[dept];

  return (
    <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">
      <header className="no-print flex items-center justify-between flex-wrap gap-3">
        <span className="font-disp text-2xl">Κάλυψη — Διαχειριστής</span>
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
        <form onSubmit={changePassword} className="no-print bg-white rounded-xl border border-ink/10 p-5 space-y-3 max-w-sm">
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

      <div className="no-print flex gap-2 flex-wrap">
        {[
          ["pending", `Εκκρεμείς (${pending.length})`],
          ["roster", "Ημερήσια κατάσταση"],
          ["balances", "Υπόλοιπα"],
          ["absences", "Ιατρού / Εκπαίδευση"],
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
          <div className="no-print bg-white rounded-xl border border-ink/10 p-3 w-fit">
            <div className="flex items-center gap-2 text-sm text-ink/50 mb-2">
              <Users size={15} /> Δύναμη (σύνολο υπαλλήλων) ανά τμήμα
            </div>
            <div className="flex flex-wrap gap-3">
              {rules.map((r) => (
                <label key={r.department} className="flex items-center gap-2 text-sm">
                  <span className="text-ink/70">{r.department}</span>
                  <input
                    type="number"
                    min={0}
                    value={r.totalForce}
                    onChange={(e) => updateTotalForce(r.department, Number(e.target.value))}
                    className="w-14 border border-ink/15 rounded-lg px-2 py-1 font-mono"
                  />
                </label>
              ))}
              {rules.length === 0 && <span className="text-sm text-ink/40">Δεν υπάρχουν ακόμα τμήματα με υπαλλήλους.</span>}
            </div>
          </div>

          {pending.length === 0 && (
            <div className="text-sm text-ink/40 bg-white rounded-xl border border-ink/10 p-6 text-center">
              Καμία εκκρεμής αίτηση.
            </div>
          )}

          {pending.map((r) => {
            const afterBalance = r.user.balanceHours - r.hours;
            const dept = r.user.department || "Χωρίς τμήμα";
            const shortage: string[] = [];
            let cur = new Date(r.startDate);
            const endD = new Date(r.endDate);
            while (cur <= endD) {
              const iso = cur.toISOString().slice(0, 10);
              const avail = coverageForDate(iso, dept);
              if (avail !== undefined && avail - 1 < 0) shortage.push(fmt(iso));
              cur.setUTCDate(cur.getUTCDate() + 1);
            }

            return (
              <div key={r.id} className="bg-white rounded-xl border border-ink/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.user.name} <span className="text-xs font-normal text-ink/40">· {dept}</span></div>
                    <div className="text-sm text-ink/50">
                      {fmt(r.startDate)} – {fmt(r.endDate)} · <span className="font-mono">{r.hours} ώρες</span> ·
                      υπόλοιπο μετά: <span className="font-mono">{afterBalance} ώρες</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)}
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
                {rejectingId === r.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Αιτιολόγηση απόρριψης (προαιρετικό)"
                      className="flex-1 min-w-[200px] border border-ink/15 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => decide(r.id, "REJECTED", rejectReason)}
                      className="text-sm px-3 py-2 rounded-lg bg-brick text-white"
                    >
                      Επιβεβαίωση απόρριψης
                    </button>
                  </div>
                )}
                {shortage.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 text-xs bg-amber/10 text-[#8f5620] rounded-lg p-2.5">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>Αν εγκριθεί, η κάλυψη του τμήματος «{dept}» πέφτει κάτω από το διαθέσιμο στις: {shortage.join(", ")}</span>
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
                  {e.balanceHours} ώρες · ≈{(e.balanceHours / 8).toFixed(1)} ημέρες
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

      {tab === "absences" && (
        <div className="space-y-4">
          <form onSubmit={addAbsence} className="bg-white rounded-xl border border-ink/10 p-5 space-y-3">
            <div className="font-disp text-lg">Νέα απουσία (ιατρού / εκπαίδευση)</div>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Τμήμα</div>
                <select value={absDept} onChange={(e) => setAbsDept(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2 bg-white">
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Τύπος</div>
                <select value={absType} onChange={(e) => setAbsType(e.target.value as "DOCTOR" | "TRAINING")} className="border border-ink/15 rounded-lg px-3 py-2 bg-white">
                  <option value="DOCTOR">Άδεια ιατρού</option>
                  <option value="TRAINING">Εκπαίδευση</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Αριθμός ατόμων</div>
                <input type="number" min={1} value={absCount} onChange={(e) => setAbsCount(e.target.value)} className="w-24 border border-ink/15 rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Από</div>
                <input type="date" value={absStart} onChange={(e) => setAbsStart(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Έως</div>
                <input type="date" value={absEnd} onChange={(e) => setAbsEnd(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
              </label>
            </div>
            {absError && <div className="text-sm text-brick">{absError}</div>}
            <button type="submit" className="bg-teal text-white rounded-lg px-4 py-2 text-sm font-medium">Προσθήκη</button>
          </form>

          <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
            {absences.length === 0 && <div className="p-4 text-sm text-ink/40">Δεν υπάρχουν καταχωρημένες απουσίες.</div>}
            {absences.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  {a.type === "DOCTOR" ? <Stethoscope size={15} className="text-ink/40" /> : <GraduationCap size={15} className="text-ink/40" />}
                  <span className="font-medium">{a.department}</span>
                  <span className="text-ink/50">{a.type === "DOCTOR" ? "Άδεια ιατρού" : "Εκπαίδευση"} · {a.count} άτομα</span>
                  <span className="text-ink/40 font-mono text-xs">{fmt(a.startDate)} – {fmt(a.endDate)}</span>
                </div>
                <button onClick={() => removeAbsence(a.id)} className="text-ink/40 hover:text-brick">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
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
            <input required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" autoCapitalize="none" autoCorrect="off" />
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
            <div className="text-ink/50 mb-1">Τμήμα</div>
            <select required value={newDept} onChange={(e) => setNewDept(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2 bg-white">
              <option value="" disabled>Επίλεξε τμήμα</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Αρχικό υπόλοιπο άδειας (ώρες)</div>
            <input type="number" value={newBalanceHours} onChange={(e) => setNewBalanceHours(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
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
