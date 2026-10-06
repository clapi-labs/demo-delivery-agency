import { getThread, resumeBot } from "@/db/queries/conversations";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json(await getThread(Number(id)));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== "resume") return Response.json({ error: "Acción inválida" }, { status: 400 });
  await resumeBot(Number(id));
  return Response.json({ ok: true });
}
