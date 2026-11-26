"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { emptyAppData, fetchLiveData } from "@/lib/api/live-data";
import { toast } from "@/components/ui/Toaster";
import type {
  AppData, PersistedState, AccentName, ThemeName, HomeworkStatus, EloStatus,
  Grade, ChoiceGroup, Message, BlockedSlot, Appointment,
} from "@/lib/types";

const STORAGE_KEY = "magisterpro-state-v2";

const defaultConnection: PersistedState["connection"] = {
  magisterSchool: "",
  magisterToken: "",
  magisterRefreshToken: "",
  magisterExpiresAt: 0,
  magisterClientId: "",
  magisterRedirectUri: "",
  zermeloSubdomain: "",
  zermeloToken: "",
  level: "vwo5",
  name: "",
  school: "",
};

const defaultState: PersistedState = {
  theme: "dark",
  accent: "indigo",
  connection: defaultConnection,
  enrollments: {},
  homework: {},
  subtasks: {},
  extraSubtasks: {},
  homeworkNotes: {},
  customHomework: [],
  messages: [],
  sentMessages: [],
  notes: {},
  eloStatus: {},
  blockedSlots: [],
  focusSessions: [],
  completedChores: [],
  fakeGrades: [],
  seenIds: [],
  sidebarCollapsed: false,
};

export const ACCENTS: Record<AccentName, { name: string; rgb: string; soft: string; hex: string }> = {
  indigo: { name: "Electric Indigo", rgb: "99 102 241", soft: "67 56 202", hex: "#6366f1" },
  emerald: { name: "Emerald", rgb: "16 185 129", soft: "5 150 105", hex: "#10b981" },
  rose: { name: "Rose", rgb: "244 63 94", soft: "225 29 72", hex: "#f43f5e" },
  amber: { name: "Amber", rgb: "245 158 11", soft: "217 119 6", hex: "#f59e0b" },
  cyan: { name: "Cyber Cyan", rgb: "6 182 212", soft: "8 145 178", hex: "#06b6d4" },
};

interface AppContextValue {
  mounted: boolean;
  now: Date;
  state: PersistedState;
  patch: (p: Partial<PersistedState>) => void;
  data: AppData;
  loading: boolean;
  loadError: string;
  lastSync: Date | null;
  refresh: () => Promise<void>;
  logout: () => void;
  resetLocalData: () => void;
  setTheme: (t: ThemeName) => void;
  setAccent: (a: AccentName) => void;
  enroll: (groupId: string, optionId: string) => void;
  unenroll: (groupId: string) => void;
  setHomeworkStatus: (id: string, status: HomeworkStatus) => void;
  toggleSubtask: (homeworkId: string, subtaskId: string) => void;
  addSubtask: (homeworkId: string, title: string) => void;
  setHomeworkNote: (id: string, note: string) => void;
  setEloStatus: (id: string, status: EloStatus) => void;
  setSubjectNote: (id: string, note: string) => void;
  addBlockedSlot: (slot: BlockedSlot) => void;
  removeBlockedSlot: (id: string) => void;
  addFocusSession: (minutes: number, subjectId?: string, taskId?: string) => void;
  addFakeGrade: (grade: Grade) => void;
  removeFakeGrade: (id: string) => void;
  clearFakeGrades: () => void;
  addMessage: (message: Message) => void;
  markMessageRead: (id: string) => void;
  addHomework: (title: string, subjectId: string, due: string) => void;
  markSeen: (ids: string[]) => void;
  choiceGroups: ChoiceGroup[];
  appointments: Appointment[];
  toggleSidebar: () => void;
  markChore: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp moet binnen <Providers> gebruikt worden.");
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<PersistedState>(defaultState);
  const [now, setNow] = useState(() => new Date());
  const [liveData, setLiveData] = useState<AppData>(emptyAppData);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const loadingRef = useRef(false);
  const connectionRef = useRef(state.connection);

  useEffect(() => { connectionRef.current = state.connection; }, [state.connection]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        setState({ ...defaultState, ...parsed, connection: { ...defaultConnection, ...(parsed.connection ?? {}) } });
      }
    } catch { /* corrupte cache negeren */ }
    setMounted(true);
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);

  const patch = useCallback((p: Partial<PersistedState>) => setState((s) => ({ ...s, ...p })), []);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota negeren */ }
  }, [state, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    const theme = state.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : state.theme;
    root.classList.toggle("dark", theme === "dark");
    const accent = ACCENTS[state.accent] ?? ACCENTS.indigo;
    root.style.setProperty("--accent", accent.rgb);
    root.style.setProperty("--accent-soft", accent.soft);
    root.style.setProperty("--accent-hex", accent.hex);
  }, [state.theme, state.accent, mounted]);

  /** Neemt de echte Magister-sessie over die de browser-extensie aanbiedt. */
  useEffect(() => {
    if (!mounted) return;
    type ExtensionSession = {
      accessToken?: string;
      refreshToken?: string;
      idToken?: string;
      expiresAt?: number;
      school?: string;
      name?: string;
      clientId?: string;
      source?: string;
    };
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ExtensionSession>).detail;
      const accessToken = detail?.accessToken;
      if (!accessToken) return;
      setState((s) => {
        if (s.connection.magisterToken === accessToken) return s;
        return {
          ...s,
          connection: {
            ...s.connection,
            magisterToken: accessToken,
            magisterRefreshToken: detail.refreshToken || s.connection.magisterRefreshToken,
            magisterExpiresAt: detail.expiresAt || Date.now() + 60 * 60 * 1000,
            magisterSchool: detail.school || s.connection.magisterSchool,
            magisterClientId: detail.clientId || s.connection.magisterClientId,
            name: detail.name || s.connection.name,
          },
        };
      });
      setTimeout(() => {
        toast("Magister gekoppeld via de browser-extensie.", "success", detail.school || undefined);
      }, 50);
    };
    window.addEventListener("magisterpro:extension-session", handler);
    // De content script kan het event vóór hydratie hebben gestuurd; vraag het
    // event hier nog een keer op zodra de provider klaar staat.
    window.dispatchEvent(new Event("magisterpro:request-extension-session"));
    return () => window.removeEventListener("magisterpro:extension-session", handler);
  }, [mounted]);

  /** Haalt alle data uit de echte koppelingen; vernieuwt een verlopen token. */
  const refresh = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection.magisterToken) { setLiveData(emptyAppData()); return; }
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadError("");
    try {
      let token = connection.magisterToken;
      if (connection.magisterExpiresAt && Date.now() > connection.magisterExpiresAt - 60_000 && connection.magisterRefreshToken) {
        const res = await fetch("/api/auth/magister/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant: "refresh",
            refreshToken: connection.magisterRefreshToken,
            clientId: connection.magisterClientId || undefined,
          }),
        });
        const json = await res.json() as { token?: string; refreshToken?: string; expiresIn?: number; message?: string };
        if (!res.ok || !json.token) throw new Error(json.message ?? "Je Magister-sessie is verlopen. Log opnieuw in.");
        token = json.token;
        setState((s) => ({
          ...s,
          connection: {
            ...s.connection,
            magisterToken: token,
            magisterRefreshToken: json.refreshToken ?? s.connection.magisterRefreshToken,
            magisterExpiresAt: Date.now() + (json.expiresIn ?? 3600) * 1000,
          },
        }));
      }

      const result = await fetchLiveData({
        magisterToken: token,
        magisterSchool: connection.magisterSchool,
        zermeloSubdomain: connection.zermeloSubdomain,
        zermeloToken: connection.zermeloToken,
      });
      setLiveData(result.data);
      setLastSync(new Date());
      setState((s) => ({
        ...s,
        connection: {
          ...s.connection,
          name: result.name || s.connection.name,
          school: result.school || s.connection.school,
        },
      }));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Kon de schoolgegevens niet laden.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted || !state.connection.magisterToken) return;
    void refresh();
    // Alleen opnieuw laden wanneer de token verandert (niet bij elke profielpatch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, state.connection.magisterToken, refresh]);

  const data = useMemo<AppData>(() => {
    const grades = [...liveData.grades, ...state.fakeGrades];
    const homework = [
      ...liveData.homework.map((h) => ({
        ...h,
        status: state.homework[h.id] ?? h.status,
        subtasks: [...h.subtasks, ...(state.extraSubtasks[h.id] ?? [])].map((st) => ({ ...st, done: state.subtasks[h.id]?.includes(st.id) ?? st.done })),
        note: state.homeworkNotes[h.id] ?? h.note,
      })),
      ...state.customHomework,
    ];
    const messages = [
      ...liveData.messages.map((m) => ({ ...m, read: m.read || state.seenIds.includes(m.id) })),
      ...state.messages,
    ];
    const eloAssignments = liveData.eloAssignments.map(
      (e) => ({ ...e, status: state.eloStatus[e.id] ?? e.status })
    );
    return { ...liveData, grades, homework, messages, eloAssignments };
  }, [liveData, state.fakeGrades, state.homework, state.subtasks, state.extraSubtasks, state.homeworkNotes, state.customHomework, state.messages, state.seenIds, state.eloStatus]);

  /** Keuzegroepen met actuele bezetting op basis van lokale inschrijvingen. */
  const choiceGroups = useMemo<ChoiceGroup[]>(() => {
    const chosen = new Set(Object.values(state.enrollments));
    const chosenGroups = new Set(Object.keys(state.enrollments));
    return liveData.choiceGroups.map((g) => ({
      ...g,
      options: g.options.map((o) => ({
        ...o,
        enrolled: Math.max(0, o.enrolled + (chosen.has(o.id) ? 1 : 0) + (chosenGroups.has(g.id) && !chosen.has(o.id) ? -1 : 0)),
      })),
    }));
  }, [liveData.choiceGroups, state.enrollments]);

  const appointments = useMemo<Appointment[]>(() => {
    const extra: Appointment[] = Object.entries(state.enrollments).flatMap(([groupId, optionId]) => {
      const group = liveData.choiceGroups.find((g) => g.id === groupId);
      const option = group?.options.find((o) => o.id === optionId);
      if (!group || !option) return [];
      return [{
        id: `enrolled-${optionId}`,
        start: option.start,
        end: option.end,
        subjectId: option.subjectId,
        teacherId: option.teacherId,
        location: option.location,
        title: option.title,
        type: option.kind === "steun" ? "steun" : "KWT",
        source: "zermelo" as const,
        kwtGroupId: groupId,
      }];
    });
    return [...liveData.appointments, ...extra].sort((a, b) => a.start.localeCompare(b.start));
  }, [liveData.appointments, liveData.choiceGroups, state.enrollments]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ ...defaultState, theme: state.theme, accent: state.accent });
    setLiveData(emptyAppData());
    window.location.assign("/login");
  }, [state.theme, state.accent]);

  const resetLocalData = useCallback(() => {
    setState((s) => ({
      ...s,
      enrollments: {}, homework: {}, subtasks: {}, extraSubtasks: {}, homeworkNotes: {},
      customHomework: [], messages: [], sentMessages: [], notes: {}, eloStatus: {},
      blockedSlots: [], focusSessions: [], completedChores: [], fakeGrades: [], seenIds: [],
    }));
  }, []);

  const value: AppContextValue = {
    mounted, now, state, patch, data, loading, loadError, lastSync, refresh, logout, resetLocalData,
    setTheme: (theme) => patch({ theme }),
    setAccent: (accent) => patch({ accent }),
    enroll: (groupId, optionId) => patch({ enrollments: { ...state.enrollments, [groupId]: optionId } }),
    unenroll: (groupId) => {
      const next = { ...state.enrollments };
      delete next[groupId];
      patch({ enrollments: next });
    },
    setHomeworkStatus: (id, status) => patch({ homework: { ...state.homework, [id]: status } }),
    toggleSubtask: (homeworkId, subtaskId) => {
      const current = state.subtasks[homeworkId] ?? [];
      const base = [...(data.homework.find((h) => h.id === homeworkId)?.subtasks ?? []), ...(state.extraSubtasks[homeworkId] ?? [])];
      const initial = base.filter((s) => s.done).map((s) => s.id);
      const effective = new Set(current.length ? current : initial);
      effective.has(subtaskId) ? effective.delete(subtaskId) : effective.add(subtaskId);
      patch({ subtasks: { ...state.subtasks, [homeworkId]: [...effective] } });
    },
    addSubtask: (homeworkId, title) => {
      const id = `st-custom-${Date.now()}`;
      patch({
        extraSubtasks: {
          ...state.extraSubtasks,
          [homeworkId]: [...(state.extraSubtasks[homeworkId] ?? []), { id, title, done: false }],
        },
      });
    },
    setHomeworkNote: (id, note) => patch({ homeworkNotes: { ...state.homeworkNotes, [id]: note } }),
    setEloStatus: (id, status) => patch({ eloStatus: { ...state.eloStatus, [id]: status } }),
    setSubjectNote: (id, note) => patch({ notes: { ...state.notes, [id]: note } }),
    addBlockedSlot: (slot) => patch({ blockedSlots: [...state.blockedSlots, slot] }),
    removeBlockedSlot: (id) => patch({ blockedSlots: state.blockedSlots.filter((b) => b.id !== id) }),
    addFocusSession: (minutes, subjectId, taskId) =>
      patch({ focusSessions: [...state.focusSessions, { id: `f${Date.now()}`, minutes, subjectId, taskId, completedAt: new Date().toISOString() }] }),
    addFakeGrade: (grade) => patch({ fakeGrades: [...state.fakeGrades, { ...grade, id: `fake-${Date.now()}`, fake: true }] }),
    removeFakeGrade: (id) => patch({ fakeGrades: state.fakeGrades.filter((g) => g.id !== id) }),
    clearFakeGrades: () => patch({ fakeGrades: [] }),
    addMessage: (message) => patch({ sentMessages: [message, ...state.sentMessages] }),
    markMessageRead: (id) => patch({ seenIds: [...new Set([...state.seenIds, id])] }),
    addHomework: (title, subjectId, due) =>
      patch({
        customHomework: [{
          id: `ch-${Date.now()}`,
          subjectId,
          title,
          description: "Zelf toegevoegd via MagisterPro.",
          due,
          createdAt: new Date().toISOString(),
          status: "todo",
          subtasks: [],
          note: "",
          source: "self",
        }, ...state.customHomework],
      }),
    markSeen: (ids) => patch({ seenIds: [...new Set([...state.seenIds, ...ids])] }),
    choiceGroups,
    appointments,
    toggleSidebar: () => patch({ sidebarCollapsed: !state.sidebarCollapsed }),
    markChore: (id) => patch({ completedChores: [...new Set([...state.completedChores, id])] }),
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0a0a0f] text-white">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse-ring rounded-2xl bg-indigo-500/40" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-black shadow-glow">M</div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold tracking-[0.25em] text-white/90">MAGISTER<span className="text-indigo-400">PRO</span></p>
          <p className="mt-2 text-xs text-white/40">Student Operating System wordt geladen…</p>
        </div>
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
