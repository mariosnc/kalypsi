"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Send, LogOut, AlertTriangle, KeyRound, Repeat } from "lucide-react";

type Me = {
  id: string; name: string; role: string; department: string | null; shiftGroup: string | null; employeeType: "PERMANENT" | "TWP";
  hoursOvertime: number; hoursHolidays: number; hoursAnnual: number; hoursAccumulated: number;
  daysLeave: number; daysDayOff: number;
};
type Req = {
  id: string; startDate: string; endDate: string; hours: number; days?: number | null;
  leaveType?: string | null; status: string; createdAt: string; rejectionReason?: string | null;
};
type CoverageDay = { date: string; byDept: Record<string, number> };
type Colleague = { id: string; name: string };
type Swap = {
  id: string; date: string; status: string;
  requester: { id: string; name: string }; colleague: { id: string; name: string };
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("el-GR");

const badge: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING: { label: "Εκκρεμεί", bg: "#C97A2E1A", fg: "#C97A2E" },
  APPROVED: { label: "Εγκρίθηκε", bg: "#2F6F5E1A", fg: "#2F6F5E" },
  REJECTED: { label: "Απορρίφθηκε", bg: "#A8453A1A", fg: "#A8453A" },
};

const swapBadge: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING: { label: "Αναμονή συναδέλφου", bg: "#C97A2E1A", fg: "#C97A2E" },
  COLLEAGUE_ACCEPTED: { label: "Αναμονή διαχειριστή", bg: "#C97A2E1A", fg: "#C97A2E" },
  COLLEAGUE_DECLINED: { label: "Απορρίφθηκε από συνάδελφο", bg: "#A8453A1A", fg: "#A8453A" },
  ADMIN_REJECTED: { label: "Απορρίφθηκε από διαχειριστή", bg: "#A8453A1A", fg: "#A8453A" },
  APPROVED: { label: "Εγκρίθηκε", bg: "#2F6F5E1A", fg: "#2F6F5E" },
};

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [leaveType, setLeaveType] = useState<"LEAVE" | "DAYOFF">("LEAVE");
  const [autoShiftType, setAutoShiftType] = useState<"DAY" | "NIGHT" | null>(null);
  const [error, setError] = useState("");
  const [coverageWarning, setCoverageWarning] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");

  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [showSwapForm, setShowSwapForm] = useState(false);
  const [swapColleague, setSwapColleague] = useState("");
  const [swapDate, setSwapDate] = useState("");
  const [swapError, setSwapError] = useState("");

  const load = useCallback(async () => {
    const [meRes, reqRes] = await Promise.all([fetch("/api/me"), fetch("/api/requests")]);
    if (meRes.ok) setMe(await meRes.json());
    if (reqRes.ok) setRequests(await reqRes.json());
  }, []);

  const loadSwaps = useCallback(async () => {
    const [colRes, swapRes] = await Promise.all([fetch("/api/colleagues"), fetch("/api/swaps")]);
    if (colRes.ok) setColleagues(await colRes.json());
    if (swapRes.ok) setSwaps(await swapRes.json());
  }, []);

  useEffect(() => {
    load();
    loadSwaps();
  }, [load, loadSwaps]);

  useEffect(() => {
    async function check() {
      setCoverageWarning("");
      setAutoShiftType(null);
      if (!me?.department || !start || !end || end < start) return;

      const months = new Set<string>();
      months.add(start.slice(0, 7));
      months.add(end.slice(0, 7));

      const covResArr = await Promise.all(Array.from(months).map((m) => fetch(`/api/coverage?month=${m}`)));

      let days: CoverageDay[] = [];
      for (const res of covResArr) {
        if (res.ok) days = days.concat((await res.json()).days);
      }

      // για το Μονιάτης, βρες αυτόματα αν η αίτηση αφορά βάρδια Ημέρας ή Νύχτας εκείνη τη μέρα
      let key = me.department;
      if (me.department === "Μονιάτης") {
        const cycleRes = await fetch(`/api/shift-cycle?date=${start}`);
        if (cycleRes.ok) {
          const cycles = await cycleRes.json();
          const moniatis = cycles.find((c: any) => c.department === "Μονιάτης");
          if (moniatis) {
            const detected = moniatis.workingGroup === me.shiftGroup ? "DAY" : "NIGHT";
            setAutoShiftType(detected);
            key = `Μονιάτης (${detected === "NIGHT" ? "Νύχτα" : "Ημέρα"})`;
          }
        }
      }

      const conflictDays: string[] = [];
      const cur = new Date(start + "T00:00:00Z");
      const endD = new Date(end + "T00:00:00Z");
      while (cur <= endD) {
        const iso = cur.toISOString().slice(0, 10);
        const avail = days.find((d) => d.date === iso)?.byDept?.[key!];
        if (avail !== undefined && avail - 1 < 0) conflictDays.push(fmt(iso));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      if (conflictDays.length > 0) {
        setCoverageWarning(
          `Στις παρακάτω ημέρες το τμήμα σου είναι ήδη στο (ή κοντά στο) ελάχιστο προσωπικό — η αίτηση μπορεί να χρειαστεί ιδιαίτερη έγκριση, ή μπορείς να ζητήσεις αλλαγή βάρδιας με συνάδελφο: ${conflictDays.join(", ")}`
        );
      }
    }
    check();
  }, [start, end, me]);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body: any = { startDate: start, endDate: end };
    if (me?.employeeType === "PERMANENT") body.leaveType = leaveType;
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  async function submitSwap(e: React.FormEvent) {
    e.preventDefault();
    setSwapError("");
    if (!swapColleague || !swapDate) return;
    const res = await fetch("/api/swaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colleagueId: swapColleague, date: swapDate }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSwapError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setShowSwapForm(false);
    setSwapColleague("");
    setSwapDate("");
    loadSwaps();
  }

  async function respondSwap(id: string, response: "ACCEPT" | "DECLINE") {
    await fetch(`/api/swaps/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    loadSwaps();
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

  const isPermanent = me.employeeType === "PERMANENT";
  const isMoniatis = me.department === "Μονιάτης";
  const totalHours = me.hoursOvertime + me.hoursHolidays + me.hoursAnnual + me.hoursAccumulated;

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

      <div className="text-sm text-ink/50">
        Γεια σου, {me.name.split(" ")[0]} · {isPermanent ? "Μόνιμος" : "Τ.Ω.Π."}
      </div>

      {isPermanent ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-ink/10 p-5">
            <div className="text-sm text-ink/50 mb-1">Άδεια</div>
            <div className="font-disp text-3xl font-mono">{me.daysLeave}</div>
            <div className="text-xs text-ink/40">ημέρες</div>
          </div>
          <div className="bg-white rounded-xl border border-ink/10 p-5">
            <div className="text-sm text-ink/50 mb-1">Ημεραργία</div>
            <div className="font-disp text-3xl font-mono">{me.daysDayOff}</div>
            <div className="text-xs text-ink/40">ημέρες</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["Υπερωρίες", me.hoursOvertime],
            ["Αργίες", me.hoursHolidays],
            ["Έτους", me.hoursAnnual],
            ["Συσσωρευμένη", me.hoursAccumulated],
          ].map(([label, val]) => (
            <div key={label as string} className="bg-white rounded-xl border border-ink/10 p-4">
              <div className="text-xs text-ink/50 mb-1">{label}</div>
              <div className="font-disp text-2xl font-mono">{val}</div>
              <div className="text-[10px] text-ink/40">ώρες</div>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-4 text-xs text-ink/40">Σύνολο: <span className="font-mono">{totalHours}</span> ώρες</div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={() => setShowForm(true)} className="bg-teal text-white rounded-xl p-5 flex flex-col items-start justify-between hover:opacity-90 transition">
          <PlusCircle size={22} />
          <span className="text-left font-medium">Νέα αίτηση άδειας</span>
        </button>
        <button onClick={() => setShowSwapForm(true)} className="bg-ink text-white rounded-xl p-5 flex flex-col items-start justify-between hover:opacity-90 transition">
          <Repeat size={22} />
          <span className="text-left font-medium">Αίτημα αλλαγής βάρδιας</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitRequest} className="bg-white rounded-xl border border-ink/10 p-5">
          <div className="font-disp text-lg mb-3">Αίτηση άδειας</div>
          {isPermanent && (
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setLeaveType("LEAVE")} className={`text-sm px-3 py-1.5 rounded-full ${leaveType === "LEAVE" ? "bg-ink text-white" : "bg-ink/5 text-ink/60"}`}>Άδεια</button>
              <button type="button" onClick={() => setLeaveType("DAYOFF")} className={`text-sm px-3 py-1.5 rounded-full ${leaveType === "DAYOFF" ? "bg-ink text-white" : "bg-ink/5 text-ink/60"}`}>Ημεραργία</button>
            </div>
          )}
          {isMoniatis && autoShiftType && (
            <div className="mb-3 text-sm text-ink/60 bg-ink/5 rounded-lg px-3 py-2 inline-block">
              Ανιχνεύτηκε αυτόματα: <span className="font-medium text-ink">{autoShiftType === "NIGHT" ? "Βάρδια Νύχτας" : "Βάρδια Ημέρας"}</span> (με βάση την ομάδα σου)
            </div>
          )}
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
            <button type="button" onClick={() => setShowForm(false)} className="text-ink/50 px-3 py-2">Ακύρωση</button>
          </div>
          {error && <div className="text-sm text-brick mt-2">{error}</div>}
          {coverageWarning && (
            <div className="mt-3 flex items-start gap-2 text-xs bg-amber/10 text-[#8f5620] rounded-lg p-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{coverageWarning}</span>
            </div>
          )}
          <div className="text-xs text-ink/40 mt-2">
            {isPermanent
              ? "Η άδεια υπολογίζεται σε ημέρες."
              : "Οι ώρες υπολογίζονται αυτόματα: 10 ώρες τη Δευτέρα, 11 ώρες όλες τις άλλες ημέρες (και Σαββατοκύριακα)."}
          </div>
        </form>
      )}

      {showSwapForm && (
        <form onSubmit={submitSwap} className="bg-white rounded-xl border border-ink/10 p-5">
          <div className="font-disp text-lg mb-3">Αίτημα αλλαγής βάρδιας</div>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm">
              <div className="text-ink/50 mb-1">Συνάδελφος</div>
              <select required value={swapColleague} onChange={(e) => setSwapColleague(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2 bg-white">
                <option value="">Επίλεξε</option>
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <div className="text-ink/50 mb-1">Ημερομηνία</div>
              <input type="date" required value={swapDate} onChange={(e) => setSwapDate(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
            </label>
            <button type="submit" className="bg-ink text-white rounded-lg px-4 py-2 flex items-center gap-2">
              <Send size={15} /> Αίτημα
            </button>
            <button type="button" onClick={() => setShowSwapForm(false)} className="text-ink/50 px-3 py-2">Ακύρωση</button>
          </div>
          {swapError && <div className="text-sm text-brick mt-2">{swapError}</div>}
          <div className="text-xs text-ink/40 mt-2">Ο συνάδελφος θα καλύψει τη βάρδια σου εκείνη τη μέρα. Χρειάζεται τη συναίνεσή του και έγκριση διαχειριστή.</div>
        </form>
      )}

      {swaps.length > 0 && (
        <div>
          <div className="font-disp text-lg mb-2">Αλλαγές βάρδιας</div>
          <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
            {swaps.map((s) => {
              const iAmColleague = s.colleague.id === me.id;
              return (
                <div key={s.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm">
                    <div className="font-medium">{fmt(s.date)}</div>
                    <div className="text-ink/50 text-xs">{s.requester.name} ↔ {s.colleague.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: swapBadge[s.status].bg, color: swapBadge[s.status].fg }}>
                      {swapBadge[s.status].label}
                    </span>
                    {iAmColleague && s.status === "PENDING" && (
                      <>
                        <button onClick={() => respondSwap(s.id, "ACCEPT")} className="text-xs px-2 py-1 rounded-lg bg-teal text-white">Αποδοχή</button>
                        <button onClick={() => respondSwap(s.id, "DECLINE")} className="text-xs px-2 py-1 rounded-lg bg-brick text-white">Άρνηση</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
                    {fmt(r.startDate)} – {fmt(r.endDate)} {r.leaveType && <span className="text-ink/40 font-normal">({r.leaveType === "DAYOFF" ? "Ημεραργία" : "Άδεια"})</span>}
                  </div>
                  <div className="text-xs text-ink/40 font-mono">{r.days ? `${r.days} ημέρες` : `${r.hours} ώρες`}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: badge[r.status].bg, color: badge[r.status].fg }}>
                  {badge[r.status].label}
                </span>
              </div>
              {r.status === "REJECTED" && r.rejectionReason && (
                <div className="mt-2 text-xs text-brick bg-brick/5 rounded-lg p-2">Αιτιολόγηση: {r.rejectionReason}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
