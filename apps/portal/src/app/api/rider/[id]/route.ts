import { and, desc, eq } from "drizzle-orm";

import { db, schema } from "@dispatch/shared/db";

export const dynamic = "force-dynamic";

/**
 * Lo que ve el motorizado: él y su viaje activo, si tiene.
 *
 * Sin token firmado a propósito, para la demo: cualquiera con el link ve la
 * pantalla de ese motorizado. Antes de producción va el mismo token HMAC que
 * ya existe en CLAPI (`domain/courier-token.ts`) — está en PLAN_REFACTOR.md.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const courierId = Number((await params).id);

  const [courier] = await db.select().from(schema.couriers).where(eq(schema.couriers.id, courierId));
  if (!courier) return Response.json({ error: "No existe" }, { status: 404 });

  const [active] = await db
    .select({ trip: schema.trips, assignedAt: schema.assignments.assignedAt })
    .from(schema.assignments)
    .innerJoin(schema.trips, eq(schema.trips.id, schema.assignments.tripId))
    .where(and(eq(schema.assignments.courierId, courierId), eq(schema.trips.status, "en_route")))
    .orderBy(desc(schema.assignments.assignedAt))
    .limit(1);

  const delivered = await db
    .select({ id: schema.trips.id })
    .from(schema.assignments)
    .innerJoin(schema.trips, eq(schema.trips.id, schema.assignments.tripId))
    .where(and(eq(schema.assignments.courierId, courierId), eq(schema.trips.status, "delivered")));

  return Response.json({
    courier: { id: courier.id, name: courier.name, status: courier.status },
    trip: active ? { ...active.trip, assignedAt: active.assignedAt } : null,
    deliveredToday: delivered.length,
  });
}
