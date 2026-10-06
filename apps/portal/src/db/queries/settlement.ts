import { eq } from "drizzle-orm";

import { db, schema } from "@dispatch/shared/db";

export type SettlementRow = {
  courierId: number;
  courierName: string;
  deliveredCount: number;
  cashCollected: number;
};

/** Una fila por domiciliario: cuántos viajes entregó (lo que se le debe) y
 *  cuánto efectivo recaudó (lo que él debe entregar). Se agrega en JS, no en
 *  SQL: a la escala de una demo (unas pocas decenas de viajes) es más claro
 *  que un GROUP BY con dos agregados condicionales. */
export async function getSettlement(): Promise<SettlementRow[]> {
  const rows = await db
    .select({
      courierId: schema.assignments.courierId,
      courierName: schema.assignments.courierName,
      status: schema.trips.status,
      paymentMethod: schema.trips.paymentMethod,
      valueToCollect: schema.trips.valueToCollect,
    })
    .from(schema.assignments)
    .innerJoin(schema.trips, eq(schema.trips.id, schema.assignments.tripId))
    .where(eq(schema.trips.status, "delivered"));

  const byCourier = new Map<string, SettlementRow>();

  for (const row of rows) {
    const key = row.courierName;
    const existing = byCourier.get(key) ?? {
      courierId: row.courierId ?? 0,
      courierName: row.courierName,
      deliveredCount: 0,
      cashCollected: 0,
    };
    existing.deliveredCount += 1;
    if (row.paymentMethod === "efectivo") {
      existing.cashCollected += row.valueToCollect;
    }
    byCourier.set(key, existing);
  }

  return Array.from(byCourier.values()).sort((a, b) => b.deliveredCount - a.deliveredCount);
}
