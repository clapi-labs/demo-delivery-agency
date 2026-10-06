import { listConversations } from "@/db/queries/conversations";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listConversations());
}
