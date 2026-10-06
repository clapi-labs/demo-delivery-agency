import { updateCourierStatus } from "@/db/queries/couriers";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["available", "busy", "paused", "offline"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  if (!VALID_STATUSES.includes(body.status)) {
    return Response.json({ error: "Estado inválido" }, { status: 400 });
  }

  const courier = await updateCourierStatus(Number(id), body.status);
  return Response.json(courier);
}
