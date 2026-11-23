"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, GraduationCap, CalendarDays, ClipboardCheck, ListTodo,
  BookOpenText, MessageSquareText, ShieldCheck, Settings2, PanelLeftClose,
  PanelLeftOpen, Zap, ChevronDown, Radio, Database,
} from "lucide-react";
import { useApp } from "@/app/providers";

export const NAV = [
  { href: "/dashboard", label: "Command Center", short: "Vandaag", icon: LayoutDashboard },
  { href: "/grades", label: "Cijferstudio Pro", short: "Cijfers", icon: GraduationCap },
  { href: "/schedule", label: "Super-Rooster", short: "Rooster", icon: CalendarDays },
  { href: "/pta", label: "PTA & Examenkluis", short: "PTA", icon: ClipboardCheck },
  { href: "/planner", label: "Toets- & Huiswerkplanner", short: "Planner", icon: ListTodo },
  { href: "/elo", label: "Studiewijzer & ELO", short: "ELO", icon: BookOpenText },
  { href: "/messages", label: "Berichten & Gids", short: "Berichten", icon: MessageSquareText },
  { href: "/attendance", label: "Aanwezigheid", short: "Aanwezigheid", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar, data, patch } = useApp();
  const collapsed = state.sidebarCollapsed;
  const unread = data.messages.filter((m) => !m.read).length;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200 bg-white/90 backdrop-blur-xl transition-[width] duration-300 dark:border-white/[0.08] dark:bg-[#0b0b12]/90 lg:flex ${collapsed ? "w-[76px]" : "w-[248px]"}`}
    >
      <div className={`flex h-16 items-center ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-soft text-sm font-black text-white shadow-glow">
            M
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-white bg-emerald-400 dark:border-[#0b0b12]" />
          </div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="whitespace-nowrap">
              <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                Magister<span className="text-accent">Pro</span>
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-white/30">Student OS</p>
            </motion.div>
          )}
        </Link>
        {!collapsed && (
          <button onClick={toggleSidebar} className="btn-ghost !p-1.5" aria-label="Sidebar inklappen" title="Sidebar inklappen">
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={toggleSidebar} className="mx-auto mb-2 btn-ghost !p-2" aria-label="Sidebar uitklappen">
          <PanelLeftOpen size={16} />
        </button>
      )}

      <button
        onClick={() => patch({ connection: { ...state.connection, mode: state.connection.mode === "demo" ? "live" : "demo" } })}
        className={`mx-3 mb-4 flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${collapsed ? "justify-center" : ""} ${
          state.connection.mode === "demo"
            ? "border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/15"
            : "border-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/15"
        }`}
        title={state.connection.mode === "demo" ? "Demo Sandbox — klik voor Live" : "Live koppeling — klik voor Demo"}
      >
        {state.connection.mode === "demo" ? <Database size={15} className="shrink-0 text-amber-400" /> : <Radio size={15} className="shrink-0 text-emerald-400" />}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-bold text-slate-800 dark:text-white/90">
                {state.connection.mode === "demo" ? "DEMO SANDBOX" : "LIVE MAGISTER + ZERMELO"}
              </span>
              <span className="block truncate text-[9px] text-slate-500 dark:text-white/40">
                {state.connection.mode === "demo" ? "Rijke oefenomgeving" : state.connection.school}
              </span>
            </span>
            <ChevronDown size={13} className="shrink-0 text-slate-400" />
          </>
        )}
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {!collapsed && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-white/25">Werkplek</p>}
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`nav-item ${active ? "nav-item-active" : ""} ${collapsed ? "justify-center !px-0" : ""}`}
            >
              {active && <motion.span layoutId="nav-active" className="absolute inset-0 -z-10 rounded-xl bg-accent/10" />}
              <Icon size={18} strokeWidth={active ? 2.3 : 1.9} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.short}</span>}
              {!collapsed && item.href === "/messages" && unread > 0 && (
                <span className="mono ml-auto rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">{unread}</span>
              )}
              {collapsed && item.href === "/messages" && unread > 0 && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-white/[0.08]">
        <Link href="/settings" title="Instellingen" className={`nav-item ${pathname === "/settings" ? "nav-item-active" : ""} ${collapsed ? "justify-center !px-0" : ""}`}>
          <Settings2 size={18} className="shrink-0" />
          {!collapsed && <span>Instellingen</span>}
        </Link>
        {!collapsed && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.03]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-fuchsia-500 text-xs font-bold text-white">
              {state.connection.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800 dark:text-white/90">{state.connection.name}</p>
              <p className="truncate text-[10px] text-slate-400 dark:text-white/35">5 VWO · {state.connection.school}</p>
            </div>
            <Zap size={13} className="ml-auto shrink-0 text-accent" />
          </div>
        )}
      </div>
    </aside>
  );
}
