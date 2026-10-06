"use client";

import { LayoutGrid, Users, Wallet, Radio } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/viajes", label: "Viajes", icon: LayoutGrid },
  { href: "/flota", label: "Flota", icon: Users },
  { href: "/arqueo", label: "Arqueo", icon: Wallet },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col bg-rail px-3 py-4">
        <div className="flex items-center gap-2 px-2 pb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-black">
            C
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-[-0.02em] text-rail-fg">CLAPI Dispatch</p>
            <p className="text-[11px] text-rail-muted">Centro de control</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`ease-ui flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active ? "bg-rail-active text-rail-fg" : "text-rail-muted hover:bg-rail-active/60 hover:text-rail-fg"
                }`}
              >
                <Icon size={18} strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-2 rounded-lg bg-rail-active/60 px-3 py-2.5 text-[11px] text-rail-muted">
          <Radio size={14} className="animate-live text-ok" />
          Sistema en vivo
        </div>
      </aside>

      <main className="no-scrollbar flex-1 overflow-y-auto bg-canvas">{children}</main>
    </div>
  );
}
