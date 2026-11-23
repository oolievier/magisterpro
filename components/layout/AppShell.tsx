"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/app/providers";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { MobileTabBar, MobileMoreSheet } from "./MobileTabBar";
import { FocusDock } from "./FocusDock";
import { Toaster } from "@/components/ui/Toaster";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className={`transition-[padding] duration-300 ${state.sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[248px]"}`}>
        <Topbar onSearch={() => setPaletteOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12">{children}</main>
      </div>
      <MobileTabBar onMore={() => setMoreOpen(true)} />
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <FocusDock />
      <Toaster />
    </div>
  );
}
