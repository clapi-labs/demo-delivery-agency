import { listTrips } from "@/db/queries/trips";

export const dynamic = "force-dynamic";

export async function GET() {
  const trips = await listTrips();
  return Response.json(trips);
}
