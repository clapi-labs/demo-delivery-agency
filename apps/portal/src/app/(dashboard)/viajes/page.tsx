"use client";

import { LayoutGroup } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AutoAssignToggle } from "@/components/AutoAssignToggle";
import { KanbanColumn } from "@/components/KanbanColumn";
import type { Trip } from "@/lib/types";

const POLL_MS = 3000;
const AUTO_ASSIGN_MS = 2500;

export default function ViajesPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [autoAssign, setAutoAssign] = useState(true);
  const autoAssignRef = useRef(autoAssign);
  autoAssignRef.current = autoAssign;

  const refresh = useCallback(async () => {
    const res = await fetch("/api/trips", { cache: "no-store" });
    if (res.ok) setTrips(await res.json());
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (!autoAssignRef.current) return;
      const res = await fetch("/api/dispatch/auto-assign", { method: "POST" });
      if (res.ok) {
        const { assigned } = await res.json();
        if (assigned > 0) refresh();
      }
    }, AUTO_ASSIGN_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const pending = trips.filter((t) => t.status === "pending");
  const enRoute = trips.filter((t) => t.status === "assigned" || t.status === "en_route");
  const delivered = trips.filter((t) => t.status === "delivered");

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink">Viajes</h1>
          <p className="text-sm text-ink-3">Despacho en vivo — {trips.length} viajes hoy</p>
        </div>
        <AutoAssignToggle on={autoAssign} onChange={setAutoAssign} />
      </div>

      <LayoutGroup>
        <div className="flex min-h-0 flex-1 gap-5">
          <KanbanColumn
            title="Nuevos · Por asignar"
            accent="bg-warn"
            trips={pending}
            emptyLabel="Sin viajes pendientes"
          />
          <KanbanColumn title="En ruta" accent="bg-route" trips={enRoute} emptyLabel="Nadie en ruta ahora" />
          <KanbanColumn title="Entregados" accent="bg-ok" trips={delivered} emptyLabel="Todavía ninguno hoy" />
        </div>
      </LayoutGroup>
    </div>
  );
}
