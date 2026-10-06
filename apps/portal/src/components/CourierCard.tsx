"use client";

import { MapPin, Pause, Phone, Play, Power } from "lucide-react";

import { formatPhone, initials } from "@/lib/format";
import { nearestZone } from "@/lib/geo";
import type { Courier } from "@/lib/types";

const STATUS_CONFIG: Record<Courier["status"], { dot: string; label: string; textClass: string }> = {
  available: { dot: "bg-ok", label: "Libre", textClass: "text-ok" },
  busy: { dot: "bg-warn", label: "En un viaje", textClass: "text-warn" },
  paused: { dot: "bg-ink-3", label: "En pausa", textClass: "text-ink-3" },
  offline: { dot: "bg-danger", label: "Desconectado", textClass: "text-danger" },
};

export function CourierCard({ courier, onToggle }: { courier: Courier; onToggle: (next: Courier["status"]) => void }) {
  const status = STATUS_CONFIG[courier.status];
  const zone = courier.lat && courier.lng ? nearestZone(courier.lat, courier.lng) : null;

  return (
    <div className="card ease-ui flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-black">
          {initials(courier.name)}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface ${status.dot} ${
              courier.status === "available" ? "animate-live" : ""
            }`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{courier.name}</p>
          <p className={`text-xs font-medium ${status.textClass}`}>{status.label}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-line pt-3 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <Phone size={12} />
          {formatPhone(courier.phone)}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={12} className={courier.status !== "offline" ? "text-brand" : ""} />
          {zone ? `Última zona: ${zone}` : "Sin GPS reciente"}
        </span>
        <span>{courier.deliveriesThisShift} entregas en el turno</span>
      </div>

      <div className="flex gap-2 border-t border-line pt-3">
        {courier.status !== "paused" ? (
          <button
            onClick={() => onToggle("paused")}
            className="ease-ui flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-2 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2/70"
          >
            <Pause size={13} /> Pausar
          </button>
        ) : (
          <button
            onClick={() => onToggle("available")}
            className="ease-ui flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ok-soft py-1.5 text-xs font-medium text-ok hover:opacity-80"
          >
            <Play size={13} /> Reactivar
          </button>
        )}
        <button
          onClick={() => onToggle("offline")}
          className="ease-ui flex items-center justify-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink-3 hover:bg-danger-soft hover:text-danger"
        >
          <Power size={13} />
        </button>
      </div>
    </div>
  );
}
