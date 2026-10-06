import { assertEnv, env } from "@/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const { ok, missing } = assertEnv();
  return Response.json({
    ok,
    missing,
    botActive: env.botActive,
  });
}
