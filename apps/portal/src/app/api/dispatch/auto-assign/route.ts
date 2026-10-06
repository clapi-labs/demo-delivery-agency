import { assignPendingTrips } from "@dispatch/shared/db";

import { notifyBot } from "@/lib/bot";

export const dynamic = "force-dynamic";

/** Le da moto a los pendientes que quedaron esperando (cola round-robin) y
 *  le pide al bot que avise al motorizado y al restaurante. */
export async function POST() {
  const assigned = await assignPendingTrips();
  if (assigned.length) await notifyBot({ assigned });
  return Response.json({ assigned: assigned.length });
}
