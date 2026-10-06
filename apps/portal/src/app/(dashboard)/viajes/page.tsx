"use client";

import { Inbox, Zap } from "lucide-react";
import { AnimatePresence, LayoutGroup } from "motion/react";
import { useState } from "react";

import { TripCard } from "@/components/TripCard";
import { useTrips } from "@/components/TripsProvider";
import type { Trip } from "@/lib/types";

type ColumnKey = "pending" | "route" | "done";

const COLUMNS: { key: ColumnKey; title: string; dot: string; empty: string }[] = [
  { key: "pending", title: "Por asignar", dot: "bg-warn", empty: "Nada esperando moto" },
  { key: "route", title: "En ruta", dot: "bg-clapi", empty: "Ninguna moto en la calle" },
  { key: "done", title: "Entregados", dot: "bg-ok", empty: "Todavía no hay entregas hoy" },
];

function bucket(trips: Trip[], key: ColumnKey) {
  if (key === "pending") return trips.filter((t) => t.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (key === "route")
    return trips
      .filter((t) => t.status === "en_route" || t.status === "assigned")
      .sort((a, b) => (b.assignedAt ?? "").localeCompare(a.assignedAt ?? ""));
  return trips
    .filter((t) => t.status === "delivered")
    .sort((a, b) => (b.deliveredAt ?? b.updatedAt).localeCompare(a.deliveredAt ?? a.updatedAt));
}

function SkeletonCard() {
  return <div className="card h-48 animate-pulse bg-surface" />;
}

export default function ViajesPage() {
  const { trips, loaded, deliver } = useTrips();
  // En el celular se ve una columna a la vez. Arranca en "En ruta": es lo
  // que el despachador vigila — lo pendiente se asigna solo.
  const [tab, setTab] = useState<ColumnKey>("route");

  const groups = Object.fromEntries(COLUMNS.map((c) => [c.key, bucket(trips, c.key)])) as Record<ColumnKey, Trip[]>;

  return (
    <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-4 px-4 py-5 lg:px-8 lg:py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Despachos</h1>
          <p className="text-sm text-ink-3">
            {groups.route.length} en la calle · {groups.done.length} entregados hoy
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-xl bg-clapi-soft px-3 py-2 text-xs font-semibold text-clapi-ink">
          <Zap size={14} className="fill-gold text-gold" />
          Asignación automática · cola por turno
        </span>
      </div>

      {/* Celular: control segmentado. Escritorio: no hace falta, se ven las tres. */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1 lg:hidden">
        {COLUMNS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setTab(c.key)}
            className={`ease-ui flex h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold ${
              tab === c.key ? "bg-surface text-ink shadow-sm" : "text-ink-3"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            {c.title}
            <span className="tabular-nums text-ink-3">{groups[c.key].length}</span>
          </button>
        ))}
      </div>

      <LayoutGroup>
        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-3">
          {COLUMNS.map((c) => (
            <section key={c.key} className={`min-h-0 flex-col gap-3 ${tab === c.key ? "flex" : "hidden lg:flex"}`}>
              <div className="hidden items-center gap-2 px-1 lg:flex">
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                <h2 className="text-sm font-semibold">{c.title}</h2>
                <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-3">{groups[c.key].length}</span>
              </div>

              <div className="no-scrollbar flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:rounded-2xl lg:bg-sunken/60 lg:p-3">
                {!loaded ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {groups[c.key].map((trip) => (
                      <TripCard key={trip.id} trip={trip} onDeliver={deliver} />
                    ))}
                  </AnimatePresence>
                )}
                {loaded && groups[c.key].length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-ink-3">
                    <Inbox size={22} className="opacity-60" />
                    {c.empty}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
