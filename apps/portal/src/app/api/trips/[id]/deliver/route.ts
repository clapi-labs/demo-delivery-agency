import { completeTrip } from "@dispatch/shared/db";

export const dynamic = "force-dynamic";

/** "Entregado" — desde el tablero o desde la app del motorizado. La moto
 *  vuelve a la cola y, si hay pendientes, toma el siguiente de una vez. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await completeTrip(Number(id));
  return Response.json({ ok }, { status: ok ? 200 : 409 });
}
