import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "./client";
import { assignments, couriers, trips } from "./schema";

/**
 * Asignación por cola (round-robin) — la versión de la demo.
 *
 * El motor multi-factor (`domain/dispatch/`) sigue en el repo, pero sin GPS
 * real del motorizado sus números no significan nada todavía. Esto es lo que
 * sí se puede defender hoy: el viaje va al motorizado libre que lleva más
 * tiempo sin recibir uno. Al marcar "Entregado" vuelve al final de la cola.
 *
 * Vive en `shared` porque la usan dos sitios que tienen que coincidir: el bot
 * (asigna en cuanto el pedido queda completo) y el portal (reintenta los
 * pendientes cuando se libera una moto).
 *
 * Las dos "reservas" son `UPDATE … WHERE estado = X RETURNING`: si el bot y
 * el portal intentan asignar al mismo tiempo, solo uno gana la fila y el otro
 * no hace nada, en vez de mandar dos motos o darle dos viajes a una.
 */
export async function assignNextCourier(tripId: number): Promise<{ courierId: number; courierName: string } | null> {
  const now = new Date();

  const [claimedTrip] = await db
    .update(trips)
    .set({ status: "en_route", updatedAt: now })
    .where(and(eq(trips.id, tripId), eq(trips.status, "pending")))
    .returning({ id: trips.id });
  if (!claimedTrip) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const [candidate] = await db
      .select({ id: couriers.id })
      .from(couriers)
      .where(and(eq(couriers.status, "available"), eq(couriers.active, true)))
      .orderBy(sql`${couriers.lastAssignedAt} asc nulls first`, asc(couriers.id))
      .limit(1);

    if (!candidate) break;

    const [courier] = await db
      .update(couriers)
      .set({
        status: "busy",
        lastAssignedAt: now,
        deliveriesThisShift: sql`${couriers.deliveriesThisShift} + 1`,
      })
      .where(and(eq(couriers.id, candidate.id), eq(couriers.status, "available")))
      .returning({ id: couriers.id, name: couriers.name });

    if (!courier) continue; // otro proceso la tomó primero: probar con la siguiente

    await db
      .insert(assignments)
      .values({ tripId, courierId: courier.id, courierName: courier.name, assignedAt: now, dispatchedAt: now })
      .onConflictDoUpdate({
        target: assignments.tripId,
        set: { courierId: courier.id, courierName: courier.name, assignedAt: now, dispatchedAt: now, deliveredAt: null },
      });

    return { courierId: courier.id, courierName: courier.name };
  }

  // Ninguna moto libre: el viaje vuelve a esperar en "Por asignar".
  await db.update(trips).set({ status: "pending", updatedAt: now }).where(eq(trips.id, tripId));
  return null;
}

/** Asigna los pendientes, el más viejo primero, hasta quedarse sin motos. */
export async function assignPendingTrips(): Promise<number> {
  const pending = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.status, "pending"))
    .orderBy(asc(trips.createdAt));

  let assigned = 0;
  for (const trip of pending) {
    const result = await assignNextCourier(trip.id);
    if (!result) break;
    assigned++;
  }
  return assigned;
}

/** "Entregado": cierra el viaje, libera la moto y le da el siguiente pendiente. */
export async function completeTrip(tripId: number): Promise<boolean> {
  const now = new Date();

  const [trip] = await db
    .update(trips)
    .set({ status: "delivered", updatedAt: now })
    .where(and(eq(trips.id, tripId), eq(trips.status, "en_route")))
    .returning({ id: trips.id });
  if (!trip) return false;

  const [assignment] = await db
    .update(assignments)
    .set({ deliveredAt: now })
    .where(eq(assignments.tripId, tripId))
    .returning({ courierId: assignments.courierId });

  if (assignment?.courierId) {
    await db
      .update(couriers)
      .set({ status: "available" })
      .where(and(eq(couriers.id, assignment.courierId), eq(couriers.status, "busy")));
  }

  await assignPendingTrips();
  return true;
}
