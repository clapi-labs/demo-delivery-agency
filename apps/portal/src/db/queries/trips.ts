import { desc, eq } from "drizzle-orm";

import { db, schema } from "@dispatch/shared/db";

export type TripRow = typeof schema.trips.$inferSelect;
export type AssignmentRow = typeof schema.assignments.$inferSelect;

export type TripWithAssignment = TripRow & {
  courierName: string | null;
  courierId: number | null;
  assignedAt: Date | null;
  deliveredAt: Date | null;
};

/** Todos los viajes, con el domiciliario asignado si lo hay. `leftJoin`
 *  porque un viaje recién creado todavía no tiene fila en `assignments`. */
export async function listTrips(): Promise<TripWithAssignment[]> {
  const rows = await db
    .select({
      trip: schema.trips,
      courierName: schema.assignments.courierName,
      courierId: schema.assignments.courierId,
      assignedAt: schema.assignments.assignedAt,
      deliveredAt: schema.assignments.deliveredAt,
    })
    .from(schema.trips)
    .leftJoin(schema.assignments, eq(schema.assignments.tripId, schema.trips.id))
    .orderBy(desc(schema.trips.createdAt));

  return rows.map((r) => ({
    ...r.trip,
    courierName: r.courierName,
    courierId: r.courierId,
    assignedAt: r.assignedAt,
    deliveredAt: r.deliveredAt,
  }));
}

export async function setTripStatus(tripId: number, status: schema.TripStatus) {
  await db.update(schema.trips).set({ status, updatedAt: new Date() }).where(eq(schema.trips.id, tripId));
}

export async function markDelivered(tripId: number) {
  await db
    .update(schema.trips)
    .set({ status: "delivered", updatedAt: new Date() })
    .where(eq(schema.trips.id, tripId));
  await db.update(schema.assignments).set({ deliveredAt: new Date() }).where(eq(schema.assignments.tripId, tripId));
}
