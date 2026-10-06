"use client";

import { motion } from "motion/react";
import { Banknote, CheckCircle2, CircleDot, MapPin, Timer, User } from "lucide-react";

import { elapsedLabel, formatCOP, initials } from "@/lib/format";
import type { Trip } from "@/lib/types";

function WaitingBadge({ since }: { since: string }) {
  const createdAt = new Date(since);
  const seconds = (Date.now() - createdAt.getTime()) / 1000;
  const urgent = seconds > 120;

  return (
    <span
      className={`ease-ui flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        urgent ? "animate-waiting bg-danger-soft text-danger" : "bg-warn-soft text-warn"
      }`}
    >
      <Timer size={12} />
      {elapsedLabel(createdAt)}
    </span>
  );
}

function PaymentBadge({ trip }: { trip: Trip }) {
  if (trip.paymentMethod === "efectivo") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-[11px] font-semibold text-warn">
        <Banknote size={13} />
        Cobrar {formatCOP(trip.valueToCollect)}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-[11px] font-semibold text-ok">
      <CheckCircle2 size={13} />
      Pre-pagado · {formatCOP(trip.valueToCollect)}
    </span>
  );
}

export function TripCard({ trip }: { trip: Trip }) {
  const justAssigned =
    trip.status === "en_route" && trip.assignedAt && Date.now() - new Date(trip.assignedAt).getTime() < 6000;

  return (
    <motion.div
      layout
      layoutId={`trip-${trip.id}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={`card ease-ui flex flex-col gap-3 p-3.5 ${justAssigned ? "animate-assign-flash" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold text-ink-3">{trip.code}</span>
        {trip.status === "pending" ? (
          <WaitingBadge since={trip.createdAt} />
        ) : trip.status === "delivered" ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-ok">
            <CheckCircle2 size={12} />
            Entregado
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-medium text-route">
            <CircleDot size={12} />
            En ruta
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[9px] font-bold text-brand-ink">
            A
          </span>
          <span className="text-ink-2">{trip.originRestaurantName}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-route-soft text-[9px] font-bold text-route">
            B
          </span>
          <span className="line-clamp-2 text-ink">{trip.deliveryAddress}</span>
        </div>
      </div>

      <PaymentBadge trip={trip} />

      <div className="ease-ui flex items-center gap-2 border-t border-line pt-2.5">
        {trip.courierName ? (
          <>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-black">
              {initials(trip.courierName)}
            </span>
            <span className="text-xs font-medium text-ink-2">{trip.courierName}</span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-ink-3">
            <User size={13} />
            Sin asignar
          </span>
        )}
        {trip.requiresCashReturn && trip.status !== "delivered" && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-ink-3">
            <MapPin size={11} />
            Retorna a base
          </span>
        )}
      </div>
    </motion.div>
  );
}
