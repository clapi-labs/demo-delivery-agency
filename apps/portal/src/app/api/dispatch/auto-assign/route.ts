import { assignPendingTrips } from "@dispatch/shared/db";

export const dynamic = "force-dynamic";

/** Le da moto a los pendientes que quedaron esperando (cola round-robin). */
export async function POST() {
  const assigned = await assignPendingTrips();
  return Response.json({ assigned });
}
