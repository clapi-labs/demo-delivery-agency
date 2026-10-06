"use client";

import { useCallback, useEffect, useState } from "react";

import { AddCourierForm } from "@/components/AddCourierForm";
import { CourierCard } from "@/components/CourierCard";
import type { Courier } from "@/lib/types";

export default function FlotaPage() {
  const [couriers, setCouriers] = useState<Courier[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/couriers", { cache: "no-store" });
    if (res.ok) setCouriers(await res.json());
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  async function setStatus(id: number, status: Courier["status"]) {
    setCouriers((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    await fetch(`/api/couriers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  const available = couriers.filter((c) => c.status === "available").length;

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink">Flota</h1>
        <p className="text-sm text-ink-3">
          {couriers.length} motorizados · {available} libres ahora
        </p>
      </div>

      <AddCourierForm onCreated={refresh} />

      <div className="no-scrollbar grid flex-1 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {couriers.map((courier) => (
          <CourierCard key={courier.id} courier={courier} onToggle={(status) => setStatus(courier.id, status)} />
        ))}
        {couriers.length === 0 && <p className="col-span-full py-12 text-center text-sm text-ink-3">Todavía no hay motorizados — agrega el primero arriba.</p>}
      </div>
    </div>
  );
}
