import { eq } from "drizzle-orm";

import { db, schema } from "@dispatch/shared/db";
import { rankCandidates, resolveOperatingMode, type CourierCandidate } from "@dispatch/shared";

import { BOGOTA_CENTER } from "@/lib/geo";
import { freeMapsClient, sharedEtaCache } from "@/lib/dispatch-ports";

export const dynamic = "force-dynamic";

/**
 * Un paso de auto-asignación: toma los viajes `pending` y, si hay un
 * domiciliario disponible dentro de rango, se lo asigna — con el motor real
 * (`rankCandidates`), no un sorteo. Pensado para que el cliente lo llame
 * cada pocos segundos mientras el toggle "Auto-Asignación" esté encendido;
 * no mantiene estado propio de "encendido/apagado" porque quien decide eso
 * es el navegador que lo dispara.
 *
 * Se salta el paso de oferta-con-15-segundos (PLAN_REFACTOR.md §2): para la
 * demo asigna directo. El historial de ofertas queda documentado como el
 * siguiente paso, no construido esta noche.
 */
export async function POST() {
  const [pendingTrips, availableCouriers] = await Promise.all([
    db.select().from(schema.trips).where(eq(schema.trips.status, "pending")),
    db.select().from(schema.couriers).where(eq(schema.couriers.status, "available")),
  ]);

  if (pendingTrips.length === 0 || availableCouriers.length === 0) {
    return Response.json({ assigned: 0 });
  }

  const pool: CourierCandidate[] = availableCouriers.map((c) => ({
    courierId: c.id,
    name: c.name,
    phone: c.phone,
    location: { lat: c.lat ?? BOGOTA_CENTER.lat, lng: c.lng ?? BOGOTA_CENTER.lng },
    locationAgeSeconds: c.locationUpdatedAt ? (Date.now() - c.locationUpdatedAt.getTime()) / 1000 : 0,
    status: "available",
    deliveriesThisShift: c.deliveriesThisShift,
  }));

  const assignedCourierIds = new Set<number>();
  const mode = resolveOperatingMode(new Date().getHours());
  let assigned = 0;

  for (const trip of pendingTrips) {
    const candidates = pool.filter((c) => !assignedCourierIds.has(c.courierId));
    if (candidates.length === 0) break;

    const pickup = trip.pickupLocation ?? BOGOTA_CENTER;
    const ranked = await rankCandidates(
      { tripId: trip.id, pickup, pickupAddress: trip.pickupAddress ?? trip.originRestaurantName, deliveryAddress: trip.deliveryAddress },
      candidates,
      mode,
      { etaCache: sharedEtaCache(), maps: freeMapsClient, radiusKm: 30 },
    );

    const winner = ranked[0];
    if (!winner) continue;

    await db.insert(schema.assignments).values({
      tripId: trip.id,
      courierId: winner.courier.courierId,
      courierName: winner.courier.name,
      dispatchedAt: new Date(),
    });
    await db
      .update(schema.trips)
      .set({ status: "en_route", updatedAt: new Date() })
      .where(eq(schema.trips.id, trip.id));
    await db
      .update(schema.couriers)
      .set({ status: "busy", deliveriesThisShift: winner.courier.deliveriesThisShift + 1 })
      .where(eq(schema.couriers.id, winner.courier.courierId));

    assignedCourierIds.add(winner.courier.courierId);
    assigned += 1;
  }

  return Response.json({ assigned });
}
