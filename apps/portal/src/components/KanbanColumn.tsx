"use client";

import { AnimatePresence } from "motion/react";

import { TripCard } from "@/components/TripCard";
import type { Trip } from "@/lib/types";

export function KanbanColumn({
  title,
  accent,
  trips,
  emptyLabel,
}: {
  title: string;
  accent: string;
  trips: Trip[];
  emptyLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${accent}`} />
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-3">
          {trips.length}
        </span>
      </div>

      <div className="no-scrollbar flex min-h-[200px] flex-col gap-2.5 overflow-y-auto rounded-xl bg-white/[0.02] p-2.5">
        <AnimatePresence mode="popLayout">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </AnimatePresence>
        {trips.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-ink-3">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
