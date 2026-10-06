import { asc, desc, eq } from "drizzle-orm";

import { db, schema } from "@dispatch/shared/db";

/** La bandeja: cada conversación con su último mensaje. Los que esperan a una
 *  persona (bot pausado) van arriba. Un solo SELECT de mensajes recientes en
 *  vez de uno por conversación — a esta escala sobra. */
export async function listConversations() {
  const [conversations, recent] = await Promise.all([
    db.select().from(schema.conversations).orderBy(desc(schema.conversations.lastMessageAt)).limit(100),
    db.select().from(schema.messages).orderBy(desc(schema.messages.id)).limit(500),
  ]);

  const lastByConversation = new Map<number, (typeof recent)[number]>();
  for (const m of recent) if (!lastByConversation.has(m.conversationId)) lastByConversation.set(m.conversationId, m);

  return conversations
    .map((c) => {
      const last = lastByConversation.get(c.id);
      return {
        id: c.id,
        phone: c.phone,
        displayName: c.displayName,
        botPaused: c.botPaused,
        escalationReason: c.escalationReason,
        draft: c.draft,
        lastMessageAt: c.lastMessageAt,
        lastText: last?.text ?? null,
        lastRole: last?.role ?? null,
      };
    })
    .sort((a, b) => Number(b.botPaused) - Number(a.botPaused));
}

export async function getThread(conversationId: number) {
  return db
    .select({ id: schema.messages.id, role: schema.messages.role, text: schema.messages.text, createdAt: schema.messages.createdAt })
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(asc(schema.messages.id));
}

/** "Intervenir": el operador toma el chat y el bot se calla en ese número. */
export async function takeOver(conversationId: number) {
  await db
    .update(schema.conversations)
    .set({ botPaused: true, escalationReason: "Un operador tomó la conversación.", draft: null, failedAttempts: 0 })
    .where(eq(schema.conversations.id, conversationId));
}

/** "Devolver al bot": el asesor terminó y el bot vuelve a atender ese chat. */
export async function resumeBot(conversationId: number) {
  await db
    .update(schema.conversations)
    .set({ botPaused: false, escalationReason: null, draft: null, failedAttempts: 0 })
    .where(eq(schema.conversations.id, conversationId));
}
