import { db, schema } from "@dispatch/shared/db";

/** Igual que CLAPI: `waMessageId` como clave primaria hace que el `INSERT`
 *  mismo sea la comprobación atómica, no un `SELECT` seguido de un `INSERT`. */
export async function markProcessedIfNew(waMessageId: string): Promise<boolean> {
  const inserted = await db
    .insert(schema.processedMessages)
    .values({ waMessageId })
    .onConflictDoNothing({ target: schema.processedMessages.waMessageId })
    .returning({ id: schema.processedMessages.waMessageId });

  return inserted.length > 0;
}
