import { getFareMatrix, saveFareMatrix } from "@dispatch/shared/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getFareMatrix());
}

export async function PUT(request: Request) {
  const body = await request.json();
  const fares = Array.isArray(body.fares) ? body.fares : [];
  const valid = fares.filter(
    (f: { originZoneId: unknown; destinationZoneId: unknown; price: unknown }) =>
      Number.isInteger(f.originZoneId) && Number.isInteger(f.destinationZoneId) && Number.isInteger(f.price) && (f.price as number) >= 0,
  );
  const defaultFare = Number.isInteger(body.defaultFare) && body.defaultFare >= 0 ? body.defaultFare : 7000;
  await saveFareMatrix({ fares: valid, defaultFare });
  return Response.json({ ok: true });
}
