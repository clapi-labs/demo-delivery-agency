import { desc, eq } from "drizzle-orm";

import { db, schema } from "@dispatch/shared/db";

export type CourierRow = typeof schema.couriers.$inferSelect;

export async function listCouriers(): Promise<CourierRow[]> {
  return db.select().from(schema.couriers).where(eq(schema.couriers.active, true)).orderBy(desc(schema.couriers.createdAt));
}

export async function createCourier(input: { name: string; phone: string; lat?: number; lng?: number }) {
  const [courier] = await db
    .insert(schema.couriers)
    .values({
      name: input.name,
      phone: input.phone,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      status: "available",
      locationUpdatedAt: input.lat !== undefined ? new Date() : null,
      shiftStartedAt: new Date(),
    })
    .returning();
  return courier;
}

export async function updateCourierStatus(id: number, status: schema.CourierStatus) {
  const [courier] = await db.update(schema.couriers).set({ status }).where(eq(schema.couriers.id, id)).returning();
  return courier;
}
