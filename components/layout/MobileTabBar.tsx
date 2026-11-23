"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, GraduationCap, CalendarDays, ListTodo, Menu } from "lucide-react";
import { NAV } from "./Sidebar";

const tabs = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Vandaag" },
  { href: "/grades", icon: GraduationCap, label: "Cijfers" },
  { href: "/schedule", icon: CalendarDays, label: "Rooster" },
  { href: "/planner", icon: ListTodo, label: "Planner" },
];

export function MobileTabBar({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const activeMore = !tabs.some((t) => t.href === pathname);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-stretch border-t border-slate-200 bg-white/90 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b0b12]/95 lg:hidden">
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link key={t.href} href={t.href} className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${active ? "text-accent" : "text-slate-400 dark:text-white/35"}`}>
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
            <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
            {t.label}
          </Link>
        );
      })}
      <button onClick={onMore} className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium ${activeMore ? "text-accent" : "text-slate-400 dark:text-white/35"}`}>
        {activeMore && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
        <Menu size={20} />
        Meer
      </button>
    </nav>
  );
}

export function MobileMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose}>
      <div className="w-full rounded-t-3xl border-t border-white/10 bg-[#101019] p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
        <div className="grid grid-cols-2 gap-2">
          {NAV.map((n) => {
            const Icon = n.icon;
            return <Link key={n.href} href={n.href} onClick={onClose} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs font-medium text-white/80"><Icon size={20} className="text-accent" />{n.label}</Link>;
          })}
          <Link href="/settings" onClick={onClose} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs font-medium text-white/80">⚙️ Instellingen</Link>
        </div>
      </div>
    </div>
  );
}
