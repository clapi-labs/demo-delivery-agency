"use client";

import { Sparkles } from "lucide-react";
import { motion } from "motion/react";

export function AutoAssignToggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`ease-ui flex items-center gap-3 rounded-full py-2 pl-3 pr-4 text-sm font-semibold ${
        on ? "bg-brand-soft text-brand-ink" : "bg-surface-2 text-ink-3"
      }`}
    >
      <span
        className={`ease-ui relative flex h-6 w-11 items-center rounded-full p-0.5 ${on ? "bg-brand" : "bg-ink-3/40"}`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="h-5 w-5 rounded-full bg-black shadow"
          style={{ marginLeft: on ? "auto" : 0 }}
        />
      </span>
      <Sparkles size={16} className={on ? "text-brand-ink" : "text-ink-3"} />
      Auto-Asignación Inteligente: {on ? "Activada" : "Desactivada"}
    </button>
  );
}
