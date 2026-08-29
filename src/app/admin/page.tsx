"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, Printer, AlertTriangle, Users, LogOut, CalendarDays,
  UserPlus, KeyRound, Stethoscope, GraduationCap, Trash2, RefreshCw, Repeat, ChevronDown, ChevronUp,
} from "lucide-react";

type PendingReq = {
  id: string; startDate: string; endDate: string; hours: number; days?: number | null; leaveType?: string | null; shiftType?: string | null; status: string;
  user: { id: string; name: string; department: string | null; employeeType: string; hoursOvertime: number; hoursHolidays: number; hoursAnnual: number; hoursAccumulated: number; daysLeave: number; daysDayOff: number; daysAccumulated: number };
};
type RosterRow = {
  id: string; name: string; email: string; department: string | null; rank: string | null;
  shiftGroup: string | null; shiftType: "DAY" | "NIGHT" | null; phone: string | null; qualifications: string[];
  role?: string; status: "working" | "off" | "on_leave";
};
type CoverageDay = { date: string; byDept: Record<string, number> };
type StaffingRuleRow = { id: string; department: string; shiftType: string; actualStaff: number; totalForce: number; weekendMinStaff: number | null };
type EmployeeRow = {
  id: string; name: string; email: string; department: string | null; shiftGroup: string | null; shiftType: "DAY" | "NIGHT" | null;
  phone: string | null; qualifications: string[]; employeeType: "PERMANENT" | "TWP"; rank: string | null; role?: string;
  hoursOvertime: number; hoursHolidays: number; hoursAnnual: number; hoursAccumulated: number;
  daysLeave: number; daysDayOff: number; daysAccumulated: number;
};
type AbsenceRow = { id: string; department: string; type: "DOCTOR" | "TRAINING"; count: number; startDate: string; endDate: string };
type ShiftCycleRow = { department: string; groups: string[]; workingGroup: string };
type SwapRow = { id: string; date: string; status: string; requester: { id: string; name: string }; colleague: { id: string; name: string } };

const DEPARTMENTS = ["Μονιάτης", "Πελένδρι", "Αγρός", "Εφταγώνια", "Πάχνα", "Κυβίδες"];
const QUALIFICATIONS = ["ΟΔ/ΑΣ", "ΟΔ", "ΑΣ", "οδ/ΑΣ", "οδ"];
const RANKS = ["Πυρ/μος", "Α/Π", "Δ/Πυρ.", "Ε/Π"];

function sortByRankThenUsername<T extends { rank?: string | null; email: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const rankCompare = RANKS.indexOf(a.rank || "") - RANKS.indexOf(b.rank || "");
    if (rankCompare !== 0) return rankCompare;
    return a.email.localeCompare(b.email);
  });
}
const groupsForDepartment = (dept: string) => (dept === "Μονιάτης" ? ["Πράσινη", "Ερυθρά", "Κυανή", "Λευκή"] : ["Α", "Β"]);
const effectiveKey = (dept: string, shiftType?: string | null) =>
  dept === "Μονιάτης" ? `Μονιάτης (${shiftType === "NIGHT" ? "Νύχτα" : "Ημέρα"})` : dept;

const fmt = (iso: string) => new Date(iso).toLocaleDateString("el-GR");
const todayISO = () => new Date().toISOString().slice(0, 10);

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function mondayOf(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
function addDaysISO(dateISO: string, n: number) {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const GR_MONTHS = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];

function monthGrid(monthStr: string): (string | null)[][] {
  const [y, m] = monthStr.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startDow = (first.getUTCDay() + 6) % 7; // Δευτέρα = 0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${monthStr}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const rosterStatusLabel: Record<string, { label: string; color: string }> = {
  working: { label: "Εργασία", color: "text-teal" },
  off: { label: "OFF", color: "text-amber" },
  on_leave: { label: "Άδεια", color: "text-brick" },
};

const swapBadge: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING: { label: "Αναμονή συναδέλφου", bg: "#C97A2E1A", fg: "#C97A2E" },
  COLLEAGUE_ACCEPTED: { label: "Προς αρχική έγκριση", bg: "#C97A2E1A", fg: "#C97A2E" },
  PENDING_FINAL: { label: "Προς τελική έγκριση", bg: "#C97A2E1A", fg: "#C97A2E" },
  COLLEAGUE_DECLINED: { label: "Απορρίφθηκε (συνάδελφος)", bg: "#A8453A1A", fg: "#A8453A" },
  ADMIN_REJECTED: { label: "Απορρίφθηκε", bg: "#A8453A1A", fg: "#A8453A" },
  APPROVED: { label: "Εγκρίθηκε", bg: "#2F6F5E1A", fg: "#2F6F5E" },
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "final" | "scheduling" | "stats" | "roster" | "general" | "weekly" | "employees" | "admins" | "absences" | "shifts" | "holidays" | "swaps" | "myleave" | "new">("pending");
  const [me, setMe] = useState<{
    id: string; name: string; finalApprover: boolean; staffMember: boolean; department: string | null;
    employeeType: "PERMANENT" | "TWP"; hoursOvertime: number; hoursHolidays: number; hoursAnnual: number; hoursAccumulated: number;
    daysLeave: number; daysDayOff: number; shiftGroup: string | null;
  } | null>(null);
  const [pending, setPending] = useState<PendingReq[]>([]);
  const [finalPending, setFinalPending] = useState<PendingReq[]>([]);
  const [adminsList, setAdminsList] = useState<{ id: string; name: string; email: string; staffMember: boolean; finalApprover: boolean }[]>([]);
  const [rules, setRules] = useState<StaffingRuleRow[]>([]);
  const [coverage, setCoverage] = useState<CoverageDay[]>([]);
  const [rosterDate, setRosterDate] = useState(todayISO());
  const [roster, setRoster] = useState<{ working: number; total: number; roster: RosterRow[] } | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [empEdit, setEmpEdit] = useState<Record<string, any>>({});
  const [adjustAmt, setAdjustAmt] = useState<Record<string, string>>({});
  const [adjustCat, setAdjustCat] = useState<Record<string, string>>({});
  const [resetMsg, setResetMsg] = useState<Record<string, string>>({});
  const [rolloverMsg, setRolloverMsg] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [absDept, setAbsDept] = useState(DEPARTMENTS[0]);
  const [absType, setAbsType] = useState<"DOCTOR" | "TRAINING">("DOCTOR");
  const [absCount, setAbsCount] = useState("1");
  const [absStart, setAbsStart] = useState(todayISO());
  const [absEnd, setAbsEnd] = useState(todayISO());
  const [absError, setAbsError] = useState("");

  const [shiftCycles, setShiftCycles] = useState<ShiftCycleRow[]>([]);
  const [holidays, setHolidays] = useState<{ id: string; date: string; name: string | null }[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [fixDept, setFixDept] = useState(DEPARTMENTS[0]);
  const [fixDate, setFixDate] = useState(todayISO());
  const [fixGroup, setFixGroup] = useState("");

  const [swaps, setSwaps] = useState<SwapRow[]>([]);

  const [showPassword, setShowPassword] = useState(false);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRank, setNewRank] = useState("");
  const [newEmpType, setNewEmpType] = useState<"PERMANENT" | "TWP">("TWP");
  const [newQuals, setNewQuals] = useState<string[]>([]);
  const [newHoursOvertime, setNewHoursOvertime] = useState("0");
  const [newHoursHolidays, setNewHoursHolidays] = useState("0");
  const [newHoursAnnual, setNewHoursAnnual] = useState("160");
  const [newHoursAccumulated, setNewHoursAccumulated] = useState("0");
  const [newDaysLeave, setNewDaysLeave] = useState("20");
  const [newDaysDayOff, setNewDaysDayOff] = useState("0");
  const [newDaysAccumulated, setNewDaysAccumulated] = useState("0");
  const [newRole, setNewRole] = useState<"EMPLOYEE" | "ADMIN">("EMPLOYEE");
  const [newStaffMember, setNewStaffMember] = useState(true);
  const [newFinalApprover, setNewFinalApprover] = useState(false);
  const [newError, setNewError] = useState("");
  const [newSuccess, setNewSuccess] = useState("");

  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()));
  const [weeklyRequests, setWeeklyRequests] = useState<PendingReq[]>([]);

  const [schedulingKey, setSchedulingKey] = useState("");
  const [schedulingMonth, setSchedulingMonth] = useState(todayISO().slice(0, 7));
  const [schedulingDays, setSchedulingDays] = useState<CoverageDay[]>([]);

  const loadSchedulingCoverage = useCallback(async (month: string) => {
    const res = await fetch(`/api/coverage?month=${month}`);
    if (res.ok) setSchedulingDays((await res.json()).days);
  }, []);

  const [myRequests, setMyRequests] = useState<PendingReq[]>([]);
  const [myColleagues, setMyColleagues] = useState<{ id: string; name: string }[]>([]);
  const [mySwaps, setMySwaps] = useState<SwapRow[]>([]);
  const [myStart, setMyStart] = useState("");
  const [myEnd, setMyEnd] = useState("");
  const [myLeaveType, setMyLeaveType] = useState<"LEAVE" | "DAYOFF">("LEAVE");
  const [myError, setMyError] = useState("");
  const [mySwapColleague, setMySwapColleague] = useState("");
  const [mySwapDate, setMySwapDate] = useState("");
  const [mySwapError, setMySwapError] = useState("");

  const loadMyRequests = useCallback(async () => {
    const [reqRes, colRes, swapRes] = await Promise.all([
      fetch("/api/requests?mine=1"),
      fetch("/api/colleagues"),
      fetch("/api/swaps"),
    ]);
    if (reqRes.ok) setMyRequests(await reqRes.json());
    if (colRes.ok) setMyColleagues(await colRes.json());
    if (swapRes.ok) setMySwaps(await swapRes.json());
  }, []);

  async function submitMyRequest(e: React.FormEvent) {
    e.preventDefault();
    setMyError("");
    const body: any = { startDate: myStart, endDate: myEnd };
    if (me?.employeeType === "PERMANENT") body.leaveType = myLeaveType;
    const res = await fetch("/api/requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMyError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setMyStart(""); setMyEnd("");
    loadMyRequests(); loadMe(); loadCoverage();
  }

  async function submitMySwap(e: React.FormEvent) {
    e.preventDefault();
    setMySwapError("");
    if (!mySwapColleague || !mySwapDate) return;
    const res = await fetch("/api/swaps", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colleagueId: mySwapColleague, date: mySwapDate }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMySwapError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setMySwapColleague(""); setMySwapDate("");
    loadMyRequests();
  }

  async function respondMySwap(id: string, response: "ACCEPT" | "DECLINE") {
    await fetch(`/api/swaps/${id}/respond`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    loadMyRequests();
  }

  const loadPending = useCallback(async () => {
    const res = await fetch("/api/requests?status=PENDING");
    if (res.ok) setPending(await res.json());
  }, []);
  const loadFinalPending = useCallback(async () => {
    const res = await fetch("/api/requests?status=PENDING_FINAL");
    if (res.ok) setFinalPending(await res.json());
  }, []);
  const loadMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.ok) setMe(await res.json());
  }, []);
  const loadAdmins = useCallback(async () => {
    const res = await fetch("/api/admins");
    if (res.ok) setAdminsList(await res.json());
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
  const loadShiftCycles = useCallback(async () => {
    const res = await fetch("/api/shift-cycle");
    if (res.ok) setShiftCycles(await res.json());
  }, []);

  const loadHolidays = useCallback(async () => {
    const res = await fetch("/api/holidays");
    if (res.ok) setHolidays(await res.json());
  }, []);

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!newHolidayDate) return;
    await fetch("/api/holidays", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newHolidayDate, name: newHolidayName }),
    });
    setNewHolidayDate(""); setNewHolidayName("");
    loadHolidays(); loadCoverage();
  }

  async function removeHoliday(id: string) {
    await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    loadHolidays(); loadCoverage();
  }
  const loadSwaps = useCallback(async () => {
    const res = await fetch("/api/swaps");
    if (res.ok) setSwaps(await res.json());
  }, []);
  const loadWeekly = useCallback(async () => {
    const res = await fetch("/api/requests?status=APPROVED");
    if (res.ok) setWeeklyRequests(await res.json());
  }, []);

  useEffect(() => { loadPending(); loadRules(); loadCoverage(); loadMe(); }, [loadPending, loadRules, loadCoverage, loadMe]);
  useEffect(() => { if (tab === "roster") loadRoster(rosterDate); }, [tab, rosterDate, loadRoster]);
  useEffect(() => { if (tab === "employees") loadEmployees(); }, [tab, loadEmployees]);
  useEffect(() => { if (tab === "absences") loadAbsences(); }, [tab, loadAbsences]);
  useEffect(() => { if (tab === "shifts") loadShiftCycles(); }, [tab, loadShiftCycles]);
  useEffect(() => { if (tab === "holidays") loadHolidays(); }, [tab, loadHolidays]);
  useEffect(() => { if (tab === "swaps") loadSwaps(); }, [tab, loadSwaps]);
  useEffect(() => { if (tab === "final") { loadFinalPending(); loadSwaps(); } }, [tab, loadFinalPending, loadSwaps]);
  useEffect(() => { if (tab === "general") loadEmployees(); }, [tab, loadEmployees]);
  useEffect(() => { if (tab === "weekly") loadWeekly(); }, [tab, loadWeekly]);
  useEffect(() => { if (tab === "stats") { loadWeekly(); loadHolidays(); } }, [tab, loadWeekly, loadHolidays]);
  useEffect(() => {
    if (tab !== "scheduling") return;
    if (!schedulingKey && rules.length > 0) {
      const r = rules[0];
      setSchedulingKey(r.department === "Μονιάτης" ? `Μονιάτης (${r.shiftType === "NIGHT" ? "Νύχτα" : "Ημέρα"})` : r.department);
    }
    loadSchedulingCoverage(schedulingMonth);
    loadEmployees();
  }, [tab, schedulingMonth, rules, schedulingKey, loadSchedulingCoverage, loadEmployees]);
  useEffect(() => { if (tab === "admins") loadAdmins(); }, [tab, loadAdmins]);
  useEffect(() => { if (tab === "myleave") loadMyRequests(); }, [tab, loadMyRequests]);
  useEffect(() => { setNewGroup(groupsForDepartment(newDept)[0] || ""); }, [newDept]);
  useEffect(() => { setFixGroup(groupsForDepartment(fixDept)[0] || ""); }, [fixDept]);

  async function decide(id: string, decision: "APPROVED" | "REJECTED", reason?: string) {
    await fetch(`/api/requests/${id}/decision`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    setRejectingId(null); setRejectReason("");
    loadPending(); loadFinalPending(); loadCoverage();
  }

  async function updateRule(department: string, shiftType: string, field: "actualStaff" | "totalForce" | "weekendMinStaff", v: number | null) {
    setRules((rs) => rs.map((r) => (r.department === department && r.shiftType === shiftType ? { ...r, [field]: v } : r)));
    const current = rules.find((r) => r.department === department && r.shiftType === shiftType);
    if (!current) return;
    await fetch("/api/staffing-rule", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        department, shiftType,
        actualStaff: field === "actualStaff" ? v : current.actualStaff,
        totalForce: field === "totalForce" ? v : current.totalForce,
        weekendMinStaff: field === "weekendMinStaff" ? v : current.weekendMinStaff,
      }),
    });
    loadCoverage();
  }

  async function applyAdjust(userId: string) {
    const val = Number(adjustAmt[userId] || 0);
    const cat = adjustCat[userId];
    if (!val || !cat) return;
    await fetch(`/api/users/${userId}/adjust`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: val, category: cat, reason: "Χειροκίνητη προσαρμογή" }),
    });
    setAdjustAmt((a) => ({ ...a, [userId]: "" }));
    loadEmployees();
  }

  async function saveEmployee(id: string) {
    const edits = empEdit[id];
    if (!edits) return;
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits),
    });
    if (res.ok) loadEmployees();
  }

  async function resetPassword(id: string) {
    const res = await fetch(`/api/users/${id}/reset-password`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setResetMsg((m) => ({ ...m, [id]: res.ok ? `Νέος κωδικός: ${data.newPassword}` : data.error || "Σφάλμα" }));
  }

  async function deleteEmployee(id: string, name: string) {
    if (!confirm(`Σίγουρα θέλεις να διαγράψεις οριστικά τον/την ${name}; Θα διαγραφεί και όλο το ιστορικό αδειών/ανταλλαγών του/της. Δεν αναιρείται.`)) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    loadEmployees();
    loadAdmins();
  }

  async function runRollover() {
    if (!confirm("Σίγουρα θέλεις να εκτελέσεις τη μεταφορά αδειών τέλους έτους για όλο το προσωπικό; Δεν αναιρείται.")) return;
    const res = await fetch("/api/admin/rollover", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRolloverMsg(data.error || "Σφάλμα.");
      return;
    }
    setRolloverMsg(`Ολοκληρώθηκε: ${data.permanentCount} Μόνιμοι, ${data.twpCount} Τ.Ω.Π.`);
    loadAdmins();
  }

  function updateEdit(id: string, field: string, value: any) {
    setEmpEdit((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));
  }

  function toggleEditQual(id: string, current: string[], q: string) {
    const set = new Set(current);
    if (set.has(q)) set.delete(q); else set.add(q);
    updateEdit(id, "qualifications", Array.from(set));
  }

  async function addAbsence(e: React.FormEvent) {
    e.preventDefault();
    setAbsError("");
    const res = await fetch("/api/absences", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department: absDept, type: absType, count: absCount, startDate: absStart, endDate: absEnd }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAbsError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setAbsCount("1"); loadAbsences(); loadCoverage();
  }

  async function removeAbsence(id: string) {
    await fetch(`/api/absences/${id}`, { method: "DELETE" });
    loadAbsences(); loadCoverage();
  }

  async function fixShiftCycle(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/shift-cycle", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department: fixDept, date: fixDate, group: fixGroup }),
    });
    loadShiftCycles();
  }

  async function decideSwap(id: string, decision: "APPROVED" | "ADMIN_REJECTED") {
    await fetch(`/api/swaps/${id}/decision`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    loadSwaps();
  }

  function toggleNewQual(q: string) {
    setNewQuals((qs) => (qs.includes(q) ? qs.filter((x) => x !== q) : [...qs, q]));
  }

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setNewError(""); setNewSuccess("");
    const res = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName, email: newEmail, password: newPassword, department: newDept, shiftGroup: newGroup,
        phone: newPhone, rank: newRank, employeeType: newEmpType, qualifications: newQuals, role: newRole,
        hoursOvertime: newHoursOvertime, hoursHolidays: newHoursHolidays, hoursAnnual: newHoursAnnual, hoursAccumulated: newHoursAccumulated,
        daysLeave: newDaysLeave, daysDayOff: newDaysDayOff, daysAccumulated: newDaysAccumulated,
        staffMember: newRole === "ADMIN" ? newStaffMember : true,
        finalApprover: newRole === "ADMIN" ? newFinalApprover : false,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNewError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setNewSuccess(`Ο/Η ${newName} προστέθηκε. Όνομα χρήστη: ${newEmail} — κωδικός: ${newPassword}`);
    setNewName(""); setNewEmail(""); setNewPassword(""); setNewDept(""); setNewPhone(""); setNewRank("");
    setNewQuals([]); setNewEmpType("TWP"); setNewRole("EMPLOYEE"); setNewStaffMember(true); setNewFinalApprover(false);
    loadRules();
  }

  async function updateAdminFlag(id: string, field: "staffMember" | "finalApprover", value: boolean) {
    setAdminsList((as) => as.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
    await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassError(""); setPassMsg("");
    const res = await fetch("/api/auth/change-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: curPass, newPassword: newPass }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPassError(data.error || "Κάτι πήγε στραβά.");
      return;
    }
    setPassMsg("Ο κωδικός άλλαξε επιτυχώς."); setCurPass(""); setNewPass("");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const coverageForDate = (iso: string, dept: string) => coverage.find((c) => c.date === iso)?.byDept?.[dept];

  const groupedRoster = roster
    ? roster.roster
        .filter((r) => r.status !== "off") // μόνο η βάρδια που εργάζεται σήμερα, όχι όλο το προσωπικό
        .reduce((acc: Record<string, RosterRow[]>, r) => {
          const k = r.department || "Χωρίς τμήμα";
          (acc[k] = acc[k] || []).push(r);
          return acc;
        }, {})
    : {};

  const pendingSwaps = swaps.filter((s) => s.status === "COLLEAGUE_ACCEPTED");

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
          ...(me?.finalApprover
            ? [["final", `Τελική έγκριση (${finalPending.length + swaps.filter((s) => s.status === "PENDING_FINAL").length})`]]
            : []),
          ["scheduling", "Προγραμματισμός"],
          ["roster", "Ημερήσια κατάσταση"],
          ["general", "Γενική κατάσταση"],
          ["stats", "Στατιστικά"],
          ["weekly", "Εβδομαδιαία αναφορά"],
          ["employees", "Υπάλληλοι"],
          ["swaps", `Ανταλλαγές${pendingSwaps.length ? ` (${pendingSwaps.length})` : ""}`],
          ["absences", "Ιατρού / Εκπαίδευση"],
          ["shifts", "Βάρδιες"],
          ["holidays", "Αργίες"],
          ...(me?.finalApprover ? [["admins", "Διαχειριστές"]] : []),
          ...(me?.staffMember ? [["myleave", "Η άδειά μου"]] : []),
          ["new", "Νέος υπάλληλος"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${tab === key ? "bg-ink text-white" : "bg-white border border-ink/10 text-ink/70"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="space-y-3">
          {pending.length === 0 && (
            <div className="text-sm text-ink/40 bg-white rounded-xl border border-ink/10 p-6 text-center">Καμία εκκρεμής αίτηση.</div>
          )}

          {pending.map((r) => {
            const dept = r.user.department || "Χωρίς τμήμα";
            const covKey = effectiveKey(dept, r.shiftType);
            const shortage: string[] = [];
            let cur = new Date(r.startDate);
            const endD = new Date(r.endDate);
            while (cur <= endD) {
              const iso = cur.toISOString().slice(0, 10);
              const avail = coverageForDate(iso, covKey);
              if (avail !== undefined && avail - 1 < 0) shortage.push(fmt(iso));
              cur.setUTCDate(cur.getUTCDate() + 1);
            }
            const isPermanent = r.user.employeeType === "PERMANENT";

            return (
              <div key={r.id} className="bg-white rounded-xl border border-ink/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.user.name} <span className="text-xs font-normal text-ink/40">· {dept}</span></div>
                    <div className="text-sm text-ink/50">
                      {fmt(r.startDate)} – {fmt(r.endDate)}
                      {isPermanent ? (
                        <> · <span className="font-mono">{r.days} ημέρες</span> · {r.leaveType === "DAYOFF" ? "Ημεραργία" : "Άδεια"}</>
                      ) : (
                        <> · <span className="font-mono">{r.hours} ώρες</span></>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-brick/30 text-brick hover:bg-brick/5">
                      <XCircle size={15} /> Απόρριψη
                    </button>
                    <button onClick={() => decide(r.id, "APPROVED")}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-teal text-white hover:opacity-90">
                      <CheckCircle2 size={15} /> {me?.finalApprover ? "Έγκριση" : "Αρχική έγκριση"}
                    </button>
                  </div>
                </div>
                {rejectingId === r.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Αιτιολόγηση απόρριψης (προαιρετικό)"
                      className="flex-1 min-w-[200px] border border-ink/15 rounded-lg px-3 py-2 text-sm" />
                    <button onClick={() => decide(r.id, "REJECTED", rejectReason)} className="text-sm px-3 py-2 rounded-lg bg-brick text-white">Επιβεβαίωση απόρριψης</button>
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

      {tab === "final" && (
        <div className="space-y-3">
          <div className="text-sm text-ink/50 bg-white rounded-xl border border-ink/10 p-3">
            Εδώ φτάνουν οι αιτήσεις και τα αιτήματα που έχουν ήδη λάβει αρχική έγκριση από άλλον διαχειριστή και περιμένουν τη δική σου οριστική έγκριση.
          </div>

          <div className="font-disp text-lg">Αιτήσεις άδειας</div>
          {finalPending.length === 0 && (
            <div className="text-sm text-ink/40 bg-white rounded-xl border border-ink/10 p-6 text-center">Καμία αίτηση προς τελική έγκριση.</div>
          )}
          {finalPending.map((r) => {
            const isPermanent = r.user.employeeType === "PERMANENT";
            return (
              <div key={r.id} className="bg-white rounded-xl border border-ink/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.user.name} <span className="text-xs font-normal text-ink/40">· {r.user.department}</span></div>
                    <div className="text-sm text-ink/50">
                      {fmt(r.startDate)} – {fmt(r.endDate)}
                      {isPermanent ? (
                        <> · <span className="font-mono">{r.days} ημέρες</span> · {r.leaveType === "DAYOFF" ? "Ημεραργία" : "Άδεια"}</>
                      ) : (
                        <> · <span className="font-mono">{r.hours} ώρες</span></>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-brick/30 text-brick hover:bg-brick/5">
                      <XCircle size={15} /> Απόρριψη
                    </button>
                    <button onClick={() => decide(r.id, "APPROVED")}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-teal text-white hover:opacity-90">
                      <CheckCircle2 size={15} /> Οριστική έγκριση
                    </button>
                  </div>
                </div>
                {rejectingId === r.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Αιτιολόγηση απόρριψης (προαιρετικό)"
                      className="flex-1 min-w-[200px] border border-ink/15 rounded-lg px-3 py-2 text-sm" />
                    <button onClick={() => decide(r.id, "REJECTED", rejectReason)} className="text-sm px-3 py-2 rounded-lg bg-brick text-white">Επιβεβαίωση απόρριψης</button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="font-disp text-lg pt-3">Ανταλλαγές βάρδιας</div>
          {swaps.filter((s) => s.status === "PENDING_FINAL").length === 0 && (
            <div className="text-sm text-ink/40 bg-white rounded-xl border border-ink/10 p-6 text-center">Καμία ανταλλαγή προς τελική έγκριση.</div>
          )}
          {swaps.filter((s) => s.status === "PENDING_FINAL").map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-ink/10 p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Repeat size={15} className="text-ink/40" />
                <span className="font-medium">{fmt(s.date)}</span>
                <span className="text-ink/50">{s.requester.name} ↔ {s.colleague.name}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => decideSwap(s.id, "ADMIN_REJECTED")} className="text-xs px-2 py-1 rounded-lg border border-brick/30 text-brick">Απόρριψη</button>
                <button onClick={() => decideSwap(s.id, "APPROVED")} className="text-xs px-2 py-1 rounded-lg bg-teal text-white">Οριστική έγκριση</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "scheduling" && (
        <div className="space-y-4">
          <div className="no-print bg-white rounded-xl border border-ink/10 p-3">
            <div className="flex items-center gap-2 text-sm text-ink/50 mb-3"><Users size={15} /> Προσωπικό ανά τμήμα / βάρδια</div>
            <div className="space-y-3">
              {rules.map((r) => {
                const key = r.department === "Μονιάτης" ? `Μονιάτης (${r.shiftType === "NIGHT" ? "Νύχτα" : "Ημέρα"})` : r.department;
                const todayCov = coverage.find((c) => c.date === todayISO())?.byDept?.[key];
                return (
                  <div key={`${r.department}-${r.shiftType}`} className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-medium w-40">{key}</span>
                    <label className="flex items-center gap-1.5 text-xs text-ink/60">
                      Πραγματικό προσωπικό
                      <input type="number" min={0} value={r.actualStaff} onChange={(e) => updateRule(r.department, r.shiftType, "actualStaff", Number(e.target.value))}
                        className="w-14 border border-ink/15 rounded-lg px-2 py-1 font-mono text-sm" />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-ink/60">
                      Ελάχιστο (καθημερινή)
                      <input type="number" min={0} value={r.totalForce} onChange={(e) => updateRule(r.department, r.shiftType, "totalForce", Number(e.target.value))}
                        className="w-14 border border-ink/15 rounded-lg px-2 py-1 font-mono text-sm" />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-ink/60">
                      Ελάχιστο (αργία/Σ/Κ)
                      <input type="number" min={0} placeholder="ίδιο" value={r.weekendMinStaff ?? ""} onChange={(e) => updateRule(r.department, r.shiftType, "weekendMinStaff", e.target.value === "" ? null : Number(e.target.value))}
                        className="w-16 border border-ink/15 rounded-lg px-2 py-1 font-mono text-sm" />
                    </label>
                    {todayCov !== undefined && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${todayCov > 0 ? "bg-teal/10 text-teal" : "bg-brick/10 text-brick"}`}>
                        Σήμερα μπορούν να λείπουν: {Math.max(0, todayCov)}
                      </span>
                    )}
                  </div>
                );
              })}
              {rules.length === 0 && <span className="text-sm text-ink/40">Δεν υπάρχουν ακόμα τμήματα με υπαλλήλους.</span>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-ink/10 p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="font-disp text-xl">Ημερολόγιο διαθεσιμότητας</div>
              <div className="flex items-center gap-3">
                <select value={schedulingKey} onChange={(e) => setSchedulingKey(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2 text-sm bg-white">
                  {rules.map((r) => {
                    const key = r.department === "Μονιάτης" ? `Μονιάτης (${r.shiftType === "NIGHT" ? "Νύχτα" : "Ημέρα"})` : r.department;
                    return <option key={key} value={key}>{key}</option>;
                  })}
                </select>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSchedulingMonth((m) => shiftMonth(m, -1))} className="px-2 py-1 rounded-lg border border-ink/15 text-sm">‹</button>
                  <span className="text-sm font-medium w-36 text-center">{GR_MONTHS[Number(schedulingMonth.slice(5, 7)) - 1]} {schedulingMonth.slice(0, 4)}</span>
                  <button onClick={() => setSchedulingMonth((m) => shiftMonth(m, 1))} className="px-2 py-1 rounded-lg border border-ink/15 text-sm">›</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1 text-xs text-ink/40 text-center">
              {["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"].map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            {monthGrid(schedulingMonth).map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                {week.map((dateISO, di) => {
                  if (!dateISO) return <div key={di} />;
                  const avail = schedulingDays.find((d) => d.date === dateISO)?.byDept?.[schedulingKey];
                  const dayNum = Number(dateISO.slice(8, 10));
                  const color = avail === undefined ? "text-ink/30" : avail > 0 ? "text-teal" : "text-brick";
                  const bg = avail === undefined ? "bg-ink/[0.02]" : avail > 0 ? "bg-teal/5" : "bg-brick/5";
                  return (
                    <div key={di} className={`aspect-square rounded-lg flex flex-col items-center justify-center ${bg}`}>
                      <span className="text-[10px] text-ink/40">{dayNum}</span>
                      <span className={`text-sm font-mono font-medium ${color}`}>{avail !== undefined ? Math.max(0, avail) : "—"}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="text-xs text-ink/40 mt-3">Ο αριθμός σε κάθε ημέρα δείχνει πόσα άτομα ακόμα μπορούν να πάρουν άδεια χωρίς να πέσει η κάλυψη κάτω από το ελάχιστο.</div>
          </div>

          <div className="bg-white rounded-xl border border-ink/10 p-5">
            <div className="font-disp text-xl mb-1">Προτεινόμενοι για άδεια</div>
            <div className="text-sm text-ink/50 mb-4">
              Για το «{schedulingKey}», με βάση το μεγαλύτερο απόθεμα αδειών και τη διαθεσιμότητα του μήνα.
            </div>
            {(() => {
              const dept = schedulingKey.startsWith("Μονιάτης") ? "Μονιάτης" : schedulingKey;
              const daysWithRoom = schedulingDays.filter((d) => (d.byDept?.[schedulingKey] ?? 0) > 0).length;
              const candidates = employees
                .filter((e) => e.department === dept)
                .map((e) => {
                  const balance = e.employeeType === "PERMANENT" ? e.daysLeave + e.daysAccumulated : e.hoursOvertime + e.hoursHolidays + e.hoursAnnual + e.hoursAccumulated;
                  const unit = e.employeeType === "PERMANENT" ? "ημέρες" : "ώρες";
                  return { ...e, balance, unit };
                })
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 8);

              if (daysWithRoom === 0) {
                return <div className="text-sm text-ink/40">Δεν υπάρχει διαθεσιμότητα άδειας αυτόν τον μήνα για αυτή την επιλογή.</div>;
              }
              if (candidates.length === 0) {
                return <div className="text-sm text-ink/40">Δεν βρέθηκε προσωπικό σε αυτό το τμήμα.</div>;
              }
              return (
                <div className="space-y-2">
                  <div className="text-xs text-ink/40 mb-1">{daysWithRoom} ημέρες με διαθεσιμότητα τον μήνα αυτό.</div>
                  {candidates.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm border-b border-ink/5 py-2 last:border-0">
                      <span>{c.rank} {c.name}</span>
                      <span className="font-mono text-ink/60">{c.balance} {c.unit} διαθέσιμο</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {tab === "stats" && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-ink/10 p-5 overflow-x-auto">
            <div className="font-disp text-xl mb-4">Στατιστικά αδειών ανά υπάλληλο</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/40 border-b border-ink/10">
                  <th className="py-2 pr-3 font-normal">Όνομα</th>
                  <th className="py-2 pr-3 font-normal text-right">Σύνολο ημερών</th>
                  <th className="py-2 pr-3 font-normal text-right">Ημέρα</th>
                  <th className="py-2 pr-3 font-normal text-right">Νύχτα</th>
                  <th className="py-2 pr-3 font-normal text-right">Καθημερινή</th>
                  <th className="py-2 pr-3 font-normal text-right">Σάββατο</th>
                  <th className="py-2 pr-3 font-normal text-right">Κυριακή</th>
                  <th className="py-2 font-normal text-right">Αργία</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const holidaySet = new Set(holidays.map((h) => h.date.slice(0, 10)));
                  const dayType = (iso: string): "weekday" | "saturday" | "sunday" | "holiday" => {
                    if (holidaySet.has(iso)) return "holiday";
                    const dow = new Date(iso + "T00:00:00Z").getUTCDay();
                    if (dow === 0) return "sunday";
                    if (dow === 6) return "saturday";
                    return "weekday";
                  };
                  const approved = weeklyRequests.filter((r) => r.status === "APPROVED");
                  const byUser: Record<string, { name: string; totalDays: number; day: number; night: number; weekday: number; saturday: number; sunday: number; holiday: number }> = {};
                  for (const r of approved) {
                    const name = r.user.name;
                    if (!byUser[name]) byUser[name] = { name, totalDays: 0, day: 0, night: 0, weekday: 0, saturday: 0, sunday: 0, holiday: 0 };
                    let cur = r.startDate.slice(0, 10);
                    const end = r.endDate.slice(0, 10);
                    while (cur <= end) {
                      byUser[name].totalDays += 1;
                      const t = dayType(cur);
                      byUser[name][t] += 1;
                      if (r.shiftType === "DAY") byUser[name].day += 1;
                      else if (r.shiftType === "NIGHT") byUser[name].night += 1;
                      cur = addDaysISO(cur, 1);
                    }
                  }
                  const rows = Object.values(byUser).sort((a, b) => a.name.localeCompare(b.name, "el"));
                  if (rows.length === 0) return <tr><td colSpan={8} className="py-4 text-ink/40 text-sm">Δεν υπάρχουν ακόμα εγκεκριμένες άδειες.</td></tr>;
                  return rows.map((u) => (
                    <tr key={u.name} className="border-b border-ink/5">
                      <td className="py-2 pr-3">{u.name}</td>
                      <td className="py-2 pr-3 text-right font-mono">{u.totalDays}</td>
                      <td className="py-2 pr-3 text-right font-mono text-ink/60">{u.day || "—"}</td>
                      <td className="py-2 pr-3 text-right font-mono text-ink/60">{u.night || "—"}</td>
                      <td className="py-2 pr-3 text-right font-mono text-ink/60">{u.weekday}</td>
                      <td className="py-2 pr-3 text-right font-mono text-ink/60">{u.saturday}</td>
                      <td className="py-2 pr-3 text-right font-mono text-ink/60">{u.sunday}</td>
                      <td className="py-2 text-right font-mono text-ink/60">{u.holiday}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "roster" && (
        <div>
          <div className="no-print flex items-center justify-between mb-4 flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm">
              <CalendarDays size={16} className="text-ink/50" />
              <input type="date" value={rosterDate} onChange={(e) => setRosterDate(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
            </label>
            <button onClick={() => window.print()} className="flex items-center gap-2 text-sm bg-ink text-white px-4 py-2 rounded-lg">
              <Printer size={15} /> Εκτύπωση
            </button>
            <button
              onClick={() => {
                if (!roster) return;
                downloadCSV(`katastasi-${rosterDate}.csv`, [
                  ["Τμήμα", "Βάρδια", "Βαθμός & Όνομα", "Προσόντα", "Τηλέφωνο", "Κατάσταση"],
                  ...roster.roster
                    .filter((e) => e.status !== "off")
                    .map((e) => [
                      e.department || "", e.shiftType === "DAY" ? "Ημέρα" : e.shiftType === "NIGHT" ? "Νύχτα" : "",
                      `${e.rank || ""} ${e.email} ${e.name}`.trim(), e.qualifications.join(" / "), e.phone || "", rosterStatusLabel[e.status].label,
                    ]),
                ]);
              }}
              className="no-print flex items-center gap-2 text-sm border border-ink/15 text-ink/70 px-4 py-2 rounded-lg"
            >
              Εξαγωγή σε Excel
            </button>
          </div>

          <div className="bg-white rounded-xl border border-ink/10 p-5">
            <div className="font-disp text-xl mb-1">Κατάσταση προσωπικού</div>
            {roster && (
              <>
                <div className="text-sm text-ink/50 mb-4">
                  {fmt(rosterDate)} · εργάζονται <span className="font-mono">{roster.working}</span> από <span className="font-mono">{roster.total}</span>
                </div>
                {Object.entries(groupedRoster).map(([dept, rows]) => (
                  <div key={dept} className="mb-5">
                    <div className="font-disp text-base mb-2 text-ink/80">{dept}</div>
                    {dept === "Μονιάτης" ? (
                      <>
                        {[
                          { label: "Βάρδια Ημέρας", filter: (r: RosterRow) => r.shiftType === "DAY" },
                          { label: "Βάρδια Νύχτας", filter: (r: RosterRow) => r.shiftType === "NIGHT" },
                        ].map(({ label, filter }) => (
                          <div key={label} className="mb-4">
                            <div className="text-sm text-ink/60 mb-1">{label}</div>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-ink/40 border-b border-ink/10">
                                  <th className="py-2 font-normal">Βαθμός & Όνομα</th>
                                  <th className="py-2 font-normal">Προσόντα</th>
                                  <th className="py-2 font-normal">Τηλέφωνο</th>
                                  <th className="py-2 font-normal text-right">Κατάσταση</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.filter(filter).map((e) => (
                                  <tr key={e.id} className="border-b border-ink/5">
                                    <td className="py-2">{e.rank} {e.email} {e.name}</td>
                                    <td className="py-2 text-ink/50 text-xs">{e.qualifications.join(", ")}</td>
                                    <td className="py-2 text-ink/50 font-mono text-xs">{e.phone}</td>
                                    <td className={`py-2 text-right font-medium ${rosterStatusLabel[e.status].color}`}>{rosterStatusLabel[e.status].label}</td>
                                  </tr>
                                ))}
                                {rows.filter(filter).length === 0 && (
                                  <tr><td colSpan={4} className="py-2 text-ink/40 text-xs">Κανείς</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-ink/40 border-b border-ink/10">
                            <th className="py-2 font-normal">Βαθμός & Όνομα</th>
                            <th className="py-2 font-normal">Προσόντα</th>
                            <th className="py-2 font-normal">Τηλέφωνο</th>
                            <th className="py-2 font-normal text-right">Κατάσταση</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((e) => (
                            <tr key={e.id} className="border-b border-ink/5">
                              <td className="py-2">{e.rank} {e.email} {e.name}</td>
                              <td className="py-2 text-ink/50 text-xs">{e.qualifications.join(", ")}</td>
                              <td className="py-2 text-ink/50 font-mono text-xs">{e.phone}</td>
                              <td className={`py-2 text-right font-medium ${rosterStatusLabel[e.status].color}`}>{rosterStatusLabel[e.status].label}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {tab === "general" && (
        <div className="space-y-3">
          <div className="no-print flex justify-end gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 text-sm bg-ink text-white px-4 py-2 rounded-lg">
              <Printer size={15} /> Εκτύπωση
            </button>
            <button
              onClick={() =>
                downloadCSV("geniki-katastasi.csv", [
                  ["Τμήμα", "Βαθμός", "Όνομα χρήστη", "Ονοματεπώνυμο", "Προσόντα", "Τηλέφωνο"],
                  ...employees.map((e) => [e.department || "", e.rank || "", e.email, e.name, e.qualifications.join(" / "), e.phone || ""]),
                ])
              }
              className="flex items-center gap-2 text-sm border border-ink/15 text-ink/70 px-4 py-2 rounded-lg"
            >
              Εξαγωγή σε Excel
            </button>
          </div>
          <div className="bg-white rounded-xl border border-ink/10 p-5">
            <div className="font-disp text-xl mb-4">Γενική κατάσταση προσωπικού</div>
            {Object.entries(
              employees.reduce((acc: Record<string, EmployeeRow[]>, e) => {
                const k = e.department || "Χωρίς τμήμα";
                (acc[k] = acc[k] || []).push(e);
                return acc;
              }, {})
            ).map(([dept, rows]) => (
              <div key={dept} className="mb-5">
                <div className="font-disp text-base mb-2 text-ink/80">{dept}</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink/40 border-b border-ink/10">
                      <th className="py-2 font-normal">Βαθμός</th>
                      <th className="py-2 font-normal">Όνομα χρήστη</th>
                      <th className="py-2 font-normal">Ονοματεπώνυμο</th>
                      <th className="py-2 font-normal">Προσόντα</th>
                      <th className="py-2 font-normal">Τηλέφωνο</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortByRankThenUsername(rows).map((e) => (
                        <tr key={e.id} className="border-b border-ink/5">
                          <td className="py-2 text-ink/50">{e.rank}</td>
                          <td className="py-2 font-mono text-xs">{e.email}</td>
                          <td className="py-2">{e.name}</td>
                          <td className="py-2 text-ink/50 text-xs">{e.qualifications.join(", ")}</td>
                          <td className="py-2 text-ink/50 font-mono text-xs">{e.phone}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
            {employees.length === 0 && <div className="text-sm text-ink/40">Φόρτωση...</div>}
          </div>
        </div>
      )}

      {tab === "weekly" && (
        <div className="space-y-3">
          <div className="no-print flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm">
              <CalendarDays size={16} className="text-ink/50" />
              Εβδομάδα από
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(mondayOf(e.target.value))} className="border border-ink/15 rounded-lg px-3 py-2" />
              έως {fmt(addDaysISO(weekStart, 6))}
            </label>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="flex items-center gap-2 text-sm bg-ink text-white px-4 py-2 rounded-lg">
                <Printer size={15} /> Εκτύπωση
              </button>
              <button
                onClick={() => {
                  const weekEnd = addDaysISO(weekStart, 6);
                  const rows = weeklyRequests.filter((r) => r.startDate.slice(0, 10) <= weekEnd && r.endDate.slice(0, 10) >= weekStart);
                  downloadCSV(`evdomadiaia-${weekStart}.csv`, [
                    ["Όνομα", "Τμήμα", "Από", "Έως", "Ποσότητα", "Τύπος", "Τρέχον υπόλοιπο"],
                    ...rows.map((r) => {
                      const isPermanent = r.user.employeeType === "PERMANENT";
                      const bal = isPermanent
                        ? `Άδεια ${r.user.daysLeave}ημ / Ημεραργία ${r.user.daysDayOff}ημ / Συσσ. ${r.user.daysAccumulated}ημ`
                        : `Σύνολο ${r.user.hoursOvertime + r.user.hoursHolidays + r.user.hoursAnnual + r.user.hoursAccumulated}ω`;
                      return [
                        r.user.name, r.user.department || "", fmt(r.startDate), fmt(r.endDate),
                        isPermanent ? `${r.days} ημέρες` : `${r.hours} ώρες`,
                        isPermanent ? (r.leaveType === "DAYOFF" ? "Ημεραργία" : "Άδεια") : "Άδεια", bal,
                      ];
                    }),
                  ]);
                }}
                className="flex items-center gap-2 text-sm border border-ink/15 text-ink/70 px-4 py-2 rounded-lg"
              >
                Εξαγωγή σε Excel
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-ink/10 p-5">
            <div className="font-disp text-xl mb-1">Εβδομαδιαία αναφορά αδειών</div>
            <div className="text-sm text-ink/50 mb-4">{fmt(weekStart)} – {fmt(addDaysISO(weekStart, 6))}</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/40 border-b border-ink/10">
                  <th className="py-2 font-normal">Όνομα</th>
                  <th className="py-2 font-normal">Τμήμα</th>
                  <th className="py-2 font-normal">Περίοδος</th>
                  <th className="py-2 font-normal">Ποσότητα</th>
                  <th className="py-2 font-normal">Τρέχον υπόλοιπο</th>
                </tr>
              </thead>
              <tbody>
                {weeklyRequests
                  .filter((r) => {
                    const weekEnd = addDaysISO(weekStart, 6);
                    return r.startDate.slice(0, 10) <= weekEnd && r.endDate.slice(0, 10) >= weekStart;
                  })
                  .map((r) => {
                    const isPermanent = r.user.employeeType === "PERMANENT";
                    return (
                      <tr key={r.id} className="border-b border-ink/5">
                        <td className="py-2">{r.user.name}</td>
                        <td className="py-2 text-ink/50">{r.user.department}</td>
                        <td className="py-2 text-ink/50 text-xs">{fmt(r.startDate)} – {fmt(r.endDate)}</td>
                        <td className="py-2 font-mono text-xs">{isPermanent ? `${r.days} ημέρες (${r.leaveType === "DAYOFF" ? "Ημεραργία" : "Άδεια"})` : `${r.hours} ώρες`}</td>
                        <td className="py-2 font-mono text-xs text-ink/50">
                          {isPermanent ? `Άδεια ${r.user.daysLeave}ημ / Ημεραργία ${r.user.daysDayOff}ημ / Συσσ. ${r.user.daysAccumulated}ημ` : `${r.user.hoursOvertime + r.user.hoursHolidays + r.user.hoursAnnual + r.user.hoursAccumulated}ω`}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {weeklyRequests.length === 0 && <div className="text-sm text-ink/40 mt-3">Φόρτωση...</div>}
          </div>
        </div>
      )}

      {tab === "employees" && (
        <div className="space-y-3">
          <div className="no-print flex justify-end">
            <button onClick={() => window.print()} className="flex items-center gap-2 text-sm bg-ink text-white px-4 py-2 rounded-lg">
              <Printer size={15} /> Εκτύπωση υπολοίπων
            </button>
          </div>
          <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
            {sortByRankThenUsername(employees).map((e) => {
              const edits = empEdit[e.id] || {};
              const isPermanent = (edits.employeeType ?? e.employeeType) === "PERMANENT";
              const expanded = expandedEmp === e.id;
              return (
                <div key={e.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{e.name} <span className="text-xs text-ink/40">· {e.rank} · {e.department}</span></div>
                      <div className="text-xs text-ink/40">{e.email} · {e.phone}</div>
                      {isPermanent ? (
                        <div className="text-sm text-ink/50 font-mono">Άδεια: {e.daysLeave}ημ · Ημεραργία: {e.daysDayOff}ημ · Συσσ.: {e.daysAccumulated}ημ</div>
                      ) : (
                        <div className="text-sm text-ink/50 font-mono">
                          Υπερ.: {e.hoursOvertime}ω · Αργίες: {e.hoursHolidays}ω · Έτους: {e.hoursAnnual}ω · Συσσ.: {e.hoursAccumulated}ω
                          <span className="text-ink/70 font-medium"> · Σύνολο: {e.hoursOvertime + e.hoursHolidays + e.hoursAnnual + e.hoursAccumulated}ω</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setExpandedEmp(expanded ? null : e.id)} className="no-print text-sm text-ink/50 flex items-center gap-1">
                      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />} Επεξεργασία
                    </button>
                  </div>

                  {expanded && (
                    <div className="no-print mt-4 border-t border-ink/10 pt-4 space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="text-sm">
                          <div className="text-ink/50 mb-1">Ονοματεπώνυμο</div>
                          <input defaultValue={e.name} onChange={(ev) => updateEdit(e.id, "name", ev.target.value)} className="w-full border border-ink/15 rounded-lg px-2 py-1.5" />
                        </label>
                        <label className="text-sm">
                          <div className="text-ink/50 mb-1">Τηλέφωνο</div>
                          <input defaultValue={e.phone || ""} onChange={(ev) => updateEdit(e.id, "phone", ev.target.value)} className="w-full border border-ink/15 rounded-lg px-2 py-1.5" />
                        </label>
                        <label className="text-sm">
                          <div className="text-ink/50 mb-1">Τμήμα</div>
                          <select defaultValue={e.department || ""} onChange={(ev) => updateEdit(e.id, "department", ev.target.value)} className="w-full border border-ink/15 rounded-lg px-2 py-1.5 bg-white">
                            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </label>
                        <label className="text-sm">
                          <div className="text-ink/50 mb-1">Ομάδα</div>
                          <select defaultValue={e.shiftGroup || ""} onChange={(ev) => updateEdit(e.id, "shiftGroup", ev.target.value)} className="w-full border border-ink/15 rounded-lg px-2 py-1.5 bg-white">
                            {groupsForDepartment(edits.department ?? e.department ?? "").map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </label>
                        <label className="text-sm">
                          <div className="text-ink/50 mb-1">Βαθμός</div>
                          <select defaultValue={e.rank || ""} onChange={(ev) => updateEdit(e.id, "rank", ev.target.value)} className="w-full border border-ink/15 rounded-lg px-2 py-1.5 bg-white">
                            {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </label>
                        <label className="text-sm">
                          <div className="text-ink/50 mb-1">Κατηγορία</div>
                          <select defaultValue={e.employeeType} onChange={(ev) => updateEdit(e.id, "employeeType", ev.target.value)} className="w-full border border-ink/15 rounded-lg px-2 py-1.5 bg-white">
                            <option value="TWP">Τ.Ω.Π.</option>
                            <option value="PERMANENT">Μόνιμος</option>
                          </select>
                        </label>
                      </div>
                      {(edits.department ?? e.department) === "Μονιάτης" && (
                        <div className="text-xs text-ink/40">Η βάρδια (Ημέρα/Νύχτα) υπολογίζεται αυτόματα κάθε μέρα από την ομάδα βάρδιας — δεν χρειάζεται χειροκίνητη ρύθμιση.</div>
                      )}
                      <div>
                        <div className="text-sm text-ink/50 mb-1">Προσόντα</div>
                        <div className="flex flex-wrap gap-2">
                          {QUALIFICATIONS.map((q) => {
                            const active = (edits.qualifications ?? e.qualifications).includes(q);
                            return (
                              <button key={q} type="button" onClick={() => toggleEditQual(e.id, edits.qualifications ?? e.qualifications, q)}
                                className={`text-xs px-2.5 py-1 rounded-full border ${active ? "bg-ink text-white border-ink" : "border-ink/20 text-ink/60"}`}>
                                {q}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEmployee(e.id)} className="text-sm px-4 py-2 rounded-lg bg-ink text-white">Αποθήκευση στοιχείων</button>
                        <button onClick={() => resetPassword(e.id)} className="text-sm px-4 py-2 rounded-lg border border-ink/15 text-ink/70">Επαναφορά κωδικού</button>
                        {me?.finalApprover && (
                          <button onClick={() => deleteEmployee(e.id, e.name)} className="text-sm px-4 py-2 rounded-lg border border-brick/30 text-brick hover:bg-brick/5">Διαγραφή υπαλλήλου</button>
                        )}
                      </div>
                      {resetMsg[e.id] && <div className="text-xs text-teal">{resetMsg[e.id]}</div>}

                      <div className="border-t border-ink/10 pt-3">
                        <div className="text-sm text-ink/50 mb-2">Προσαρμογή υπολοίπου</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={adjustCat[e.id] || ""} onChange={(ev) => setAdjustCat((c) => ({ ...c, [e.id]: ev.target.value }))} className="border border-ink/15 rounded-lg px-2 py-1.5 text-sm bg-white">
                            <option value="">Κατηγορία</option>
                            {isPermanent ? (
                              <>
                                <option value="DAYS_LEAVE">Άδεια (ημέρες)</option>
                                <option value="DAYS_DAYOFF">Ημεραργία / R.D. (ημέρες)</option>
                                <option value="DAYS_ACCUMULATED">Συσσωρευμένη (ημέρες)</option>
                              </>
                            ) : (
                              <>
                                <option value="OVERTIME">Υπερωρίες (ώρες)</option>
                                <option value="HOLIDAYS">Αργίες (ώρες)</option>
                                <option value="ANNUAL">Έτους (ώρες)</option>
                                <option value="ACCUMULATED">Συσσωρευμένη (ώρες)</option>
                              </>
                            )}
                          </select>
                          <input type="number" step="0.5" placeholder="+/-" value={adjustAmt[e.id] || ""} onChange={(ev) => setAdjustAmt((a) => ({ ...a, [e.id]: ev.target.value }))}
                            className="w-24 border border-ink/15 rounded-lg px-2 py-1.5 text-sm font-mono" />
                          <button onClick={() => applyAdjust(e.id)} className="text-sm px-3 py-1.5 rounded-lg bg-teal text-white">Εφαρμογή</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {employees.length === 0 && <div className="p-4 text-sm text-ink/40">Φόρτωση...</div>}
          </div>
        </div>
      )}

      {tab === "swaps" && (
        <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
          {swaps.length === 0 && <div className="p-4 text-sm text-ink/40">Δεν υπάρχουν αιτήματα ανταλλαγής.</div>}
          {swaps.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Repeat size={15} className="text-ink/40" />
                <span className="font-medium">{fmt(s.date)}</span>
                <span className="text-ink/50">{s.requester.name} ↔ {s.colleague.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: swapBadge[s.status].bg, color: swapBadge[s.status].fg }}>
                  {swapBadge[s.status].label}
                </span>
                {(s.status === "COLLEAGUE_ACCEPTED" || (me?.finalApprover && s.status === "PENDING_FINAL")) && (
                  <>
                    <button onClick={() => decideSwap(s.id, "ADMIN_REJECTED")} className="text-xs px-2 py-1 rounded-lg border border-brick/30 text-brick">Απόρριψη</button>
                    <button onClick={() => decideSwap(s.id, "APPROVED")} className="text-xs px-2 py-1 rounded-lg bg-teal text-white">
                      {me?.finalApprover ? "Έγκριση" : "Αρχική έγκριση"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
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
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
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
                <button onClick={() => removeAbsence(a.id)} className="text-ink/40 hover:text-brick"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "shifts" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
            {shiftCycles.map((c) => (
              <div key={c.department} className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-medium">{c.department}</div>
                  <div className="text-xs text-ink/40">Ομάδες: {c.groups.join(" → ")} → (ξανά η πρώτη)</div>
                </div>
                <div className="text-sm">Σήμερα δουλεύει: <span className="font-mono font-medium text-teal">{c.workingGroup}</span></div>
              </div>
            ))}
            {shiftCycles.length === 0 && <div className="p-4 text-sm text-ink/40">Φόρτωση...</div>}
          </div>
          <form onSubmit={fixShiftCycle} className="bg-white rounded-xl border border-ink/10 p-5 space-y-3">
            <div className="font-disp text-lg flex items-center gap-2"><RefreshCw size={18} /> Διόρθωση κύκλου βάρδιας</div>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Τμήμα</div>
                <select value={fixDept} onChange={(e) => setFixDept(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2 bg-white">
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Ημερομηνία</div>
                <input type="date" value={fixDate} onChange={(e) => setFixDate(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Ομάδα που δουλεύει</div>
                <select value={fixGroup} onChange={(e) => setFixGroup(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2 bg-white">
                  {groupsForDepartment(fixDept).map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <button type="submit" className="self-end bg-ink text-white rounded-lg px-4 py-2 text-sm">Ορισμός</button>
            </div>
          </form>
        </div>
      )}

      {tab === "holidays" && (
        <div className="space-y-4">
          <form onSubmit={addHoliday} className="bg-white rounded-xl border border-ink/10 p-5 space-y-3">
            <div className="font-disp text-lg">Νέα αργία</div>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Ημερομηνία</div>
                <input type="date" required value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Ονομασία (προαιρετικό)</div>
                <input value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" placeholder="π.χ. Πρωτοχρονιά" />
              </label>
              <button type="submit" className="bg-teal text-white rounded-lg px-4 py-2 text-sm font-medium">Προσθήκη</button>
            </div>
            <div className="text-xs text-ink/40">Τις μέρες αυτές (και τα Σαββατοκύριακα) ισχύει το ελάχιστο προσωπικό «αργίας/Σ.Κ.» αντί του κανονικού.</div>
          </form>

          <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
            {holidays.length === 0 && <div className="p-4 text-sm text-ink/40">Δεν έχουν οριστεί αργίες.</div>}
            {holidays.map((h) => (
              <div key={h.id} className="p-4 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">{fmt(h.date)}</span>
                  {h.name && <span className="text-ink/50 ml-2">{h.name}</span>}
                </div>
                <button onClick={() => removeHoliday(h.id)} className="text-ink/40 hover:text-brick"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "admins" && (
        <div className="space-y-3">
          <div className="text-sm text-ink/50 bg-white rounded-xl border border-ink/10 p-3">
            Εδώ βλέπεις όλους τους διαχειριστές — ακόμα κι αυτούς που δεν είναι μέλη προσωπικού και δεν εμφανίζονται στη λίστα «Υπάλληλοι».
          </div>
          <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
            {adminsList.map((a) => (
              <div key={a.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-ink/40">{a.email}</div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={a.staffMember} onChange={(e) => updateAdminFlag(a.id, "staffMember", e.target.checked)} />
                    Μέλος προσωπικού
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={a.finalApprover} onChange={(e) => updateAdminFlag(a.id, "finalApprover", e.target.checked)} />
                    Τελική έγκριση
                  </label>
                  <button onClick={() => resetPassword(a.id)} className="text-sm px-3 py-1.5 rounded-lg border border-ink/15 text-ink/70">Επαναφορά κωδικού</button>
                  {a.id !== me?.id && (
                    <button onClick={() => deleteEmployee(a.id, a.name)} className="text-sm px-3 py-1.5 rounded-lg border border-brick/30 text-brick hover:bg-brick/5">Διαγραφή</button>
                  )}
                </div>
                {resetMsg[a.id] && <div className="text-xs text-teal w-full">{resetMsg[a.id]}</div>}
              </div>
            ))}
            {adminsList.length === 0 && <div className="p-4 text-sm text-ink/40">Φόρτωση...</div>}
          </div>

          <div className="bg-white rounded-xl border border-ink/10 p-5 space-y-3">
            <div className="font-disp text-lg">Μεταφορά αδειών τέλους έτους</div>
            <div className="text-sm text-ink/50">
              Για τους Μόνιμους: η αχρησιμοποίητη Άδεια μεταφέρεται στη Συσσωρευμένη (μέγιστο απόθεμα 100 ημέρες) και μηδενίζεται. Η Ημεραργία/R.D. δεν μεταφέρεται.<br />
              Για τους Τ.Ω.Π.: το αχρησιμοποίητο Έτους μεταφέρεται στη Συσσωρευμένη (μέγιστο απόθεμα 334.40 ώρες) και μηδενίζεται. Οι Υπερωρίες δεν μεταφέρονται.
            </div>
            <button onClick={runRollover} className="bg-brick text-white rounded-lg px-4 py-2 text-sm font-medium">Εκτέλεση μεταφοράς τώρα</button>
            {rolloverMsg && <div className="text-sm text-teal">{rolloverMsg}</div>}
            <div className="text-xs text-ink/40">⚠️ Αυτή η ενέργεια επηρεάζει όλο το προσωπικό ταυτόχρονα και δεν αναιρείται — κάνε την μία φορά, στην αρχή του νέου έτους.</div>
          </div>
        </div>
      )}

      {tab === "myleave" && me && (
        <div className="space-y-5 max-w-2xl">
          <div className="text-sm text-ink/50 bg-white rounded-xl border border-ink/10 p-3">
            Ως μέλος προσωπικού μπορείς να υποβάλλεις τη δική σου αίτηση άδειας ή αίτημα αλλαγής βάρδιας.
            Δεν χρειάζεται έγκριση από άλλον διαχειριστή — καταχωρείται κατευθείαν και ενημερώνει την ημερήσια κατάσταση.
          </div>

          {me.employeeType === "PERMANENT" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-ink/10 p-4">
                <div className="text-sm text-ink/50 mb-1">Άδεια</div>
                <div className="font-disp text-2xl font-mono">{me.daysLeave} <span className="text-sm font-normal text-ink/40">ημέρες</span></div>
              </div>
              <div className="bg-white rounded-xl border border-ink/10 p-4">
                <div className="text-sm text-ink/50 mb-1">Ημεραργία</div>
                <div className="font-disp text-2xl font-mono">{me.daysDayOff} <span className="text-sm font-normal text-ink/40">ημέρες</span></div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[["Υπερωρίες", me.hoursOvertime], ["Αργίες", me.hoursHolidays], ["Έτους", me.hoursAnnual], ["Συσσωρευμένη", me.hoursAccumulated]].map(([label, val]) => (
                <div key={label as string} className="bg-white rounded-xl border border-ink/10 p-4">
                  <div className="text-xs text-ink/50 mb-1">{label}</div>
                  <div className="font-disp text-xl font-mono">{val}</div>
                  <div className="text-[10px] text-ink/40">ώρες</div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submitMyRequest} className="bg-white rounded-xl border border-ink/10 p-5 space-y-3">
            <div className="font-disp text-lg">Νέα αίτηση άδειας</div>
            {me.employeeType === "PERMANENT" && (
              <div className="flex gap-2">
                <button type="button" onClick={() => setMyLeaveType("LEAVE")} className={`text-sm px-3 py-1.5 rounded-full ${myLeaveType === "LEAVE" ? "bg-ink text-white" : "bg-ink/5 text-ink/60"}`}>Άδεια</button>
                <button type="button" onClick={() => setMyLeaveType("DAYOFF")} className={`text-sm px-3 py-1.5 rounded-full ${myLeaveType === "DAYOFF" ? "bg-ink text-white" : "bg-ink/5 text-ink/60"}`}>Ημεραργία</button>
              </div>
            )}
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Από</div>
                <input type="date" required value={myStart} onChange={(e) => setMyStart(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
              </label>
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Έως</div>
                <input type="date" required value={myEnd} onChange={(e) => setMyEnd(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
              </label>
              <button type="submit" className="bg-teal text-white rounded-lg px-4 py-2 text-sm font-medium">Υποβολή</button>
            </div>
            {myError && <div className="text-sm text-brick">{myError}</div>}
          </form>

          <div>
            <div className="font-disp text-lg mb-2">Οι αιτήσεις μου</div>
            <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
              {myRequests.length === 0 && <div className="p-4 text-sm text-ink/40">Δεν υπάρχουν αιτήσεις ακόμα.</div>}
              {myRequests.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium">{fmt(r.startDate)} – {fmt(r.endDate)} {r.leaveType && <span className="text-ink/40 font-normal">({r.leaveType === "DAYOFF" ? "Ημεραργία" : "Άδεια"})</span>}</div>
                    <div className="text-xs text-ink/40 font-mono">{r.days ? `${r.days} ημέρες` : `${r.hours} ώρες`}</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-teal/10 text-teal">Εγκρίθηκε</span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={submitMySwap} className="bg-white rounded-xl border border-ink/10 p-5 space-y-3">
            <div className="font-disp text-lg">Αίτημα αλλαγής βάρδιας</div>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Συνάδελφος</div>
                <select required value={mySwapColleague} onChange={(e) => setMySwapColleague(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2 bg-white">
                  <option value="">Επίλεξε</option>
                  {myColleagues.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <div className="text-ink/50 mb-1">Ημερομηνία</div>
                <input type="date" required value={mySwapDate} onChange={(e) => setMySwapDate(e.target.value)} className="border border-ink/15 rounded-lg px-3 py-2" />
              </label>
              <button type="submit" className="bg-ink text-white rounded-lg px-4 py-2 text-sm">Αίτημα</button>
            </div>
            {mySwapError && <div className="text-sm text-brick">{mySwapError}</div>}
            <div className="text-xs text-ink/40">Χρειάζεται μόνο τη συναίνεση του συναδέλφου — εγκρίνεται αυτόματα μόλις αποδεχτεί.</div>
          </form>

          {mySwaps.length > 0 && (
            <div>
              <div className="font-disp text-lg mb-2">Οι ανταλλαγές μου</div>
              <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/8">
                {mySwaps.map((s) => {
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
                            <button onClick={() => respondMySwap(s.id, "ACCEPT")} className="text-xs px-2 py-1 rounded-lg bg-teal text-white">Αποδοχή</button>
                            <button onClick={() => respondMySwap(s.id, "DECLINE")} className="text-xs px-2 py-1 rounded-lg bg-brick text-white">Άρνηση</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "new" && (
        <form onSubmit={createEmployee} className="bg-white rounded-xl border border-ink/10 p-5 max-w-md space-y-4">
          <div className="font-disp text-lg flex items-center gap-2"><UserPlus size={20} /> Νέος υπάλληλος</div>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Ονοματεπώνυμο</div>
            <input required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Όνομα χρήστη</div>
            <input required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" autoCapitalize="none" autoCorrect="off" />
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Αρχικός κωδικός</div>
            <input required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" placeholder="τουλάχιστον 6 χαρακτήρες" />
          </label>
          <label className="block text-sm">
            <div className="text-ink/50 mb-1">Ρόλος</div>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as "EMPLOYEE" | "ADMIN")} className="w-full border border-ink/15 rounded-lg px-3 py-2 bg-white">
              <option value="EMPLOYEE">Υπάλληλος</option>
              <option value="ADMIN">Διαχειριστής</option>
            </select>
          </label>

          {newRole === "ADMIN" && (
            <div className="space-y-2 bg-ink/5 rounded-lg p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newStaffMember} onChange={(e) => setNewStaffMember(e.target.checked)} />
                Μέλος προσωπικού (εμφανίζεται σε καταστάσεις/βάρδιες)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newFinalApprover} onChange={(e) => setNewFinalApprover(e.target.checked)} />
                Διαχειριστής τελικής έγκρισης
              </label>
            </div>
          )}

          {(newRole === "EMPLOYEE" || newStaffMember) && (
            <>
              <label className="block text-sm">
                <div className="text-ink/50 mb-1">Τηλέφωνο (8 ψηφία)</div>
                <input required pattern="\d{8}" maxLength={8} value={newPhone} onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ""))} className="w-full border border-ink/15 rounded-lg px-3 py-2" placeholder="99123456" />
              </label>
              <label className="block text-sm">
                <div className="text-ink/50 mb-1">Κατηγορία προσωπικού</div>
                <select value={newEmpType} onChange={(e) => setNewEmpType(e.target.value as "PERMANENT" | "TWP")} className="w-full border border-ink/15 rounded-lg px-3 py-2 bg-white">
                  <option value="TWP">Τ.Ω.Π.</option>
                  <option value="PERMANENT">Μόνιμος</option>
                </select>
              </label>
              <label className="block text-sm">
                <div className="text-ink/50 mb-1">Βαθμός</div>
                <select required value={newRank} onChange={(e) => setNewRank(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2 bg-white">
                  <option value="" disabled>Επίλεξε βαθμό</option>
                  {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <div className="text-ink/50 mb-1">Τμήμα</div>
                <select required value={newDept} onChange={(e) => setNewDept(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2 bg-white">
                  <option value="" disabled>Επίλεξε τμήμα</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              {newDept && (
                <label className="block text-sm">
                  <div className="text-ink/50 mb-1">Ομάδα βάρδιας</div>
                  <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2 bg-white">
                    {groupsForDepartment(newDept).map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
              )}
              {newDept === "Μονιάτης" && (
                <div className="text-xs text-ink/40">Η βάρδια (Ημέρα/Νύχτα) υπολογίζεται αυτόματα κάθε μέρα από την ομάδα βάρδιας — δεν χρειάζεται χειροκίνητη ρύθμιση.</div>
              )}
              <div>
                <div className="text-sm text-ink/50 mb-1">Προσόντα</div>
                <div className="flex flex-wrap gap-2">
                  {QUALIFICATIONS.map((q) => (
                    <button key={q} type="button" onClick={() => toggleNewQual(q)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${newQuals.includes(q) ? "bg-ink text-white border-ink" : "border-ink/20 text-ink/60"}`}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {newEmpType === "PERMANENT" ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    <div className="text-ink/50 mb-1">Άδεια (ημέρες)</div>
                    <input type="number" step="0.5" value={newDaysLeave} onChange={(e) => setNewDaysLeave(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
                  </label>
                  <label className="text-sm">
                    <div className="text-ink/50 mb-1">Ημεραργία / R.D. (ημέρες)</div>
                    <input type="number" step="0.5" value={newDaysDayOff} onChange={(e) => setNewDaysDayOff(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
                  </label>
                  <label className="text-sm">
                    <div className="text-ink/50 mb-1">Συσσωρευμένη (ημέρες)</div>
                    <input type="number" step="0.5" value={newDaysAccumulated} onChange={(e) => setNewDaysAccumulated(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    <div className="text-ink/50 mb-1">Υπερωρίες (ώρες)</div>
                    <input type="number" value={newHoursOvertime} onChange={(e) => setNewHoursOvertime(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
                  </label>
                  <label className="text-sm">
                    <div className="text-ink/50 mb-1">Αργίες (ώρες)</div>
                    <input type="number" value={newHoursHolidays} onChange={(e) => setNewHoursHolidays(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
                  </label>
                  <label className="text-sm">
                    <div className="text-ink/50 mb-1">Έτους (ώρες)</div>
                    <input type="number" value={newHoursAnnual} onChange={(e) => setNewHoursAnnual(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
                  </label>
                  <label className="text-sm">
                    <div className="text-ink/50 mb-1">Συσσωρευμένη (ώρες)</div>
                    <input type="number" value={newHoursAccumulated} onChange={(e) => setNewHoursAccumulated(e.target.value)} className="w-full border border-ink/15 rounded-lg px-3 py-2" />
                  </label>
                </div>
              )}
            </>
          )}

          {newError && <div className="text-sm text-brick">{newError}</div>}
          {newSuccess && <div className="text-sm text-teal">{newSuccess}</div>}
          <button type="submit" className="w-full bg-teal text-white rounded-lg py-2.5 font-medium">Δημιουργία λογαριασμού</button>
        </form>
      )}
    </div>
  );
}
