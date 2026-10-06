import { getSettlement } from "@/db/queries/settlement";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getSettlement();
  return Response.json(rows);
}
