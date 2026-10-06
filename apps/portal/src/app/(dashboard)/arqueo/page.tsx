"use client";

import { Banknote, Package } from "lucide-react";
import { useEffect, useState } from "react";

import { formatCOP, initials } from "@/lib/format";
import type { SettlementRow } from "@/lib/types";

export default function ArqueoPage() {
  const [rows, setRows] = useState<SettlementRow[]>([]);

  useEffect(() => {
    fetch("/api/settlement", { cache: "no-store" })
      .then((r) => r.json())
      .then(setRows);
  }, []);

  const totalCash = rows.reduce((sum, r) => sum + r.cashCollected, 0);
  const totalTrips = rows.reduce((sum, r) => sum + r.deliveredCount, 0);

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink">Arqueo del día</h1>
        <p className="text-sm text-ink-3">Quién le debe a quién, sin adivinar</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
            <Package size={18} />
          </span>
          <div>
            <p className="text-xl font-semibold text-ink">{totalTrips}</p>
            <p className="text-xs text-ink-3">viajes entregados hoy</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-warn-soft text-warn">
            <Banknote size={18} />
          </span>
          <div>
            <p className="text-xl font-semibold text-ink">{formatCOP(totalCash)}</p>
            <p className="text-xs text-ink-3">efectivo en la calle</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-4 py-3 font-medium">Motorizado</th>
              <th className="px-4 py-3 font-medium">Viajes realizados · lo que le debemos</th>
              <th className="px-4 py-3 font-medium">Efectivo recaudado · lo que nos debe entregar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.courierId} className="border-b border-line last:border-0">
                <td className="flex items-center gap-2 px-4 py-3 font-medium text-ink">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-black">
                    {initials(row.courierName)}
                  </span>
                  {row.courierName}
                </td>
                <td className="px-4 py-3 text-ink-2">{row.deliveredCount}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
                    {formatCOP(row.cashCollected)}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-ink-3">
                  Todavía no hay entregas cerradas hoy.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
