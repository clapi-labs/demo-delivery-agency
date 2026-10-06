"use client";

import { Banknote, Bike } from "lucide-react";
import { useEffect, useState } from "react";

import { useTrips } from "@/components/TripsProvider";
import { formatCOP, initials } from "@/lib/format";
import type { SettlementRow } from "@/lib/types";

export default function ArqueoPage() {
  const { trips } = useTrips();
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const deliveredCount = trips.filter((t) => t.status === "delivered").length;

  // Se recalcula cada vez que cambia el número de entregas: el arqueo se
  // mueve solo mientras la demo corre.
  useEffect(() => {
    fetch("/api/settlement", { cache: "no-store" })
      .then((r) => r.json())
      .then(setRows)
      .catch(() => {});
  }, [deliveredCount]);

  const totalCash = rows.reduce((sum, r) => sum + r.cashCollected, 0);
  const totalTrips = rows.reduce((sum, r) => sum + r.deliveredCount, 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-5 lg:px-8 lg:py-7">
      <div>
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Arqueo del día</h1>
        <p className="text-sm text-ink-3">Quién le debe a quién, sin cuadernos</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-clapi-soft text-clapi-ink">
            <Bike size={22} />
          </span>
          <div>
            <p className="text-2xl font-bold tabular-nums">{totalTrips}</p>
            <p className="text-sm text-ink-3">viajes entregados · lo que les debemos</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-soft text-gold-ink">
            <Banknote size={22} />
          </span>
          <div>
            <p className="text-2xl font-bold tabular-nums">{formatCOP(totalCash)}</p>
            <p className="text-sm text-ink-3">efectivo por entregar a la central</p>
          </div>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="hidden grid-cols-[1fr_9rem_11rem] gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-3 sm:grid">
          <span>Motorizado</span>
          <span className="text-right">Viajes realizados</span>
          <span className="text-right">Efectivo a entregar</span>
        </div>

        {rows.map((row) => (
          <div
            key={row.courierName}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-line px-5 py-4 last:border-0 sm:grid-cols-[1fr_9rem_11rem]"
          >
            <span className="flex items-center gap-3 font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-clapi text-xs font-bold text-white">
                {initials(row.courierName)}
              </span>
              {row.courierName}
            </span>
            <span className="text-right text-sm tabular-nums text-ink-2 sm:text-base">
              {row.deliveredCount}
              <span className="text-ink-3 sm:hidden"> {row.deliveredCount === 1 ? "viaje" : "viajes"}</span>
            </span>
            <span className="col-span-2 text-right sm:col-span-1">
              <span
                className={`inline-block rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
                  row.cashCollected > 0 ? "bg-gold-soft text-gold-ink" : "bg-sunken text-ink-3"
                }`}
              >
                {formatCOP(row.cashCollected)}
              </span>
            </span>
          </div>
        ))}

        {rows.length === 0 && <p className="px-5 py-12 text-center text-sm text-ink-3">Todavía no hay entregas cerradas hoy.</p>}
      </section>
    </div>
  );
}
