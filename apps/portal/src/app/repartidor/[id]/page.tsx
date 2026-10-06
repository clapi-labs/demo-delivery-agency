"use client";

import { Banknote, CheckCircle2, CreditCard, Map, Navigation, Phone, Store } from "lucide-react";
import { use, useCallback, useEffect, useState } from "react";

import { BRAND } from "@/lib/brand";
import { formatCOP } from "@/lib/format";
import { clock, useNow } from "@/lib/use-now";
import { usePolling } from "@/lib/use-polling";

type RiderData = {
  courier: { id: number; name: string; status: string };
  trip: {
    id: number;
    code: string;
    originRestaurantName: string;
    deliveryAddress: string;
    customerPhone: string;
    valueToCollect: number;
    paymentMethod: "efectivo" | "transferencia";
    assignedAt: string;
  } | null;
  deliveredToday: number;
};

/**
 * La pantalla del motorizado. Vive FUERA del tablero a propósito: es el
 * celular de otra persona, en la calle, con una mano. Todo es grande, todo
 * está abajo, y hay una sola acción importante a la vez.
 */
export default function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<RiderData | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justDelivered, setJustDelivered] = useState(false);
  const now = useNow(1000);

  const load = useCallback(async () => {
    const res = await fetch(`/api/rider/${id}`, { cache: "no-store" });
    if (!res.ok) return setError(true);
    setData(await res.json());
  }, [id]);

  usePolling(load, 4000);

  useEffect(() => {
    if (!justDelivered) return;
    const t = setTimeout(() => setJustDelivered(false), 3000);
    return () => clearTimeout(t);
  }, [justDelivered]);

  async function deliver() {
    if (!data?.trip) return;
    setBusy(true);
    await fetch(`/api/trips/${data.trip.id}/deliver`, { method: "POST" });
    setBusy(false);
    setJustDelivered(true);
    load();
  }

  if (error) return <p className="p-8 text-center text-ink-3">Este link no corresponde a ningún motorizado.</p>;

  const trip = data?.trip;
  const address = trip ? encodeURIComponent(`${trip.deliveryAddress}, Cali, Colombia`) : "";
  const phone = trip ? trip.customerPhone.replace(/\D/g, "") : "";

  return (
    <div className="no-scrollbar mx-auto flex h-full max-w-md flex-col overflow-y-auto bg-canvas">
      <header className="flex items-center gap-3 bg-clapi-deep px-5 pb-5 pt-[calc(env(safe-area-inset-top)+1rem)] text-white">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-client text-sm font-extrabold">
          {BRAND.client.initials}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{data?.courier.name ?? "Cargando…"}</p>
          <p className="text-xs text-white/60">{data ? `${data.deliveredToday} entregas hoy` : BRAND.client.name}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
          <span className={`h-2 w-2 rounded-full ${trip ? "bg-gold" : "animate-live bg-ok"}`} />
          {trip ? "En viaje" : "Libre"}
        </span>
      </header>

      {justDelivered && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-2xl bg-ok-soft px-4 py-3 font-semibold text-ok">
          <CheckCircle2 size={20} /> ¡Entrega registrada!
        </div>
      )}

      {!data ? null : !trip ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-16 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-ok-soft">
            <span className="h-4 w-4 animate-live rounded-full bg-ok" />
          </span>
          <p className="text-lg font-bold">Estás en la cola</p>
          <p className="text-sm text-ink-3">Cuando te asignen un viaje aparece acá solo. Deja esta pantalla abierta.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-ink-3">{trip.code}</span>
            <span className="rounded-lg bg-clapi-soft px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-clapi-ink">
              {clock((now - new Date(trip.assignedAt).getTime()) / 1000)}
            </span>
          </div>

          <section className="card flex flex-col gap-4 p-5">
            <div className="flex gap-3">
              <Store size={20} className="mt-0.5 shrink-0 text-clapi" />
              <div>
                <p className="text-xs font-semibold uppercase text-ink-3">Recoge en</p>
                <p className="text-lg font-bold leading-snug">{trip.originRestaurantName}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Navigation size={20} className="mt-0.5 shrink-0 text-client" />
              <div>
                <p className="text-xs font-semibold uppercase text-ink-3">Entrega en</p>
                <p className="text-lg font-bold leading-snug">{trip.deliveryAddress}</p>
              </div>
            </div>
          </section>

          {trip.paymentMethod === "efectivo" ? (
            <div className="flex items-center gap-3 rounded-2xl bg-gold-soft p-4 text-gold-ink">
              <Banknote size={26} />
              <div>
                <p className="text-sm font-semibold">Cobra en efectivo</p>
                <p className="text-2xl font-extrabold tabular-nums">{formatCOP(trip.valueToCollect)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-ok-soft p-4 text-ok">
              <CreditCard size={26} />
              <div>
                <p className="text-sm font-semibold">Ya está pagado</p>
                <p className="text-base font-bold">No cobres nada al cliente</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <a
              href={`https://waze.com/ul?q=${address}&navigate=yes`}
              className="card flex h-20 flex-col items-center justify-center gap-1 text-sm font-semibold"
            >
              <Navigation size={22} className="text-[#33ccff]" /> Waze
            </a>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${address}`}
              className="card flex h-20 flex-col items-center justify-center gap-1 text-sm font-semibold"
            >
              <Map size={22} className="text-[#4285f4]" /> Maps
            </a>
            <a
              href={`tel:+${phone.length === 10 ? "57" : ""}${phone}`}
              className="card flex h-20 flex-col items-center justify-center gap-1 text-sm font-semibold"
            >
              <Phone size={22} className="text-ok" /> Cliente
            </a>
          </div>

          <button
            type="button"
            onClick={deliver}
            disabled={busy}
            className="ease-ui mt-auto flex h-20 items-center justify-center gap-3 rounded-2xl bg-ok text-xl font-extrabold text-white shadow-lg shadow-ok/25 active:scale-[0.98] disabled:opacity-60"
          >
            <CheckCircle2 size={28} />
            {busy ? "Registrando…" : "ENTREGADO"}
          </button>
        </div>
      )}
    </div>
  );
}
