import { notifyAssigned, notifyDelivered } from "@/bot/notify";

import { isInternal } from "../auth";

export const dynamic = "force-dynamic";

/**
 * El portal cambió el estado de uno o más viajes (asignó un pendiente al
 * liberarse una moto, o alguien marcó "Entregado" en el tablero o en la app
 * del motorizado) y le pide al bot que avise por WhatsApp.
 */
export async function POST(request: Request) {
  if (!isInternal(request)) return new Response("Unauthorized", { status: 401 });

  const { assigned = [], delivered = [] } = (await request.json()) as { assigned?: number[]; delivered?: number[] };

  for (const id of delivered) await notifyDelivered(id);
  for (const id of assigned) await notifyAssigned(id);

  return Response.json({ ok: true });
}
