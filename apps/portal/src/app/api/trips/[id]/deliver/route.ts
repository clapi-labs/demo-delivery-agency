import { completeTrip } from "@dispatch/shared/db";

import { notifyBot } from "@/lib/bot";

export const dynamic = "force-dynamic";

/**
 * "Entregado" marcado desde el portal — el respaldo del botón de WhatsApp
 * del motorizado. Mismo efecto: la moto vuelve a la cola, toma el siguiente
 * pendiente si hay, y el bot avisa a quien corresponda.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tripId = Number((await params).id);
  const result = await completeTrip(tripId);
  if (!result) return Response.json({ ok: false }, { status: 409 });

  await notifyBot({ delivered: [tripId], assigned: result.newlyAssigned });
  return Response.json({ ok: true });
}
