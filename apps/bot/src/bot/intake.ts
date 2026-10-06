import { evaluateExtraction } from "@dispatch/shared";

import { upsertConversationOnInbound, recordMessage } from "@/db/queries/conversation";
import { createTrip } from "@/db/queries/trips";
import { extractTripFields } from "@/services/openai/extract";
import { sendText } from "@/services/whatsapp/client";
import type { IncomingMessage } from "@/services/whatsapp/types";

/**
 * Reemplaza al orquestador de 11 puertas de CLAPI (`bot/orchestrator.ts`):
 * acá no hay menú que recorrer ni pago que confirmar por botones, solo un
 * mensaje libre que o alcanza para crear el viaje, o no.
 *
 * Deliberadamente NO repite el candado de CLAPI "un pedido no puede nacer de
 * una conversación" (ADR-02 de ese sistema) — es la inversión a propósito:
 * ver `docs/PLAN_REFACTOR.md` §0.
 */

const MISSING_FIELD_LABEL: Record<string, string> = {
  origenRestaurante: "el nombre del restaurante",
  direccionEntrega: "la dirección de entrega",
  telefonoCliente: "el teléfono del cliente",
  valorACobrar: "el valor a cobrar",
  metodoPago: "si es efectivo o transferencia",
};

export async function handleIncoming(message: IncomingMessage) {
  const conversation = await upsertConversationOnInbound(message.phone, message.profileName);

  if (message.kind !== "text") {
    await sendText(message.phone, "Por ahora solo puedo leer mensajes de texto. Escríbeme el pedido así: restaurante, dirección, teléfono del cliente, valor a cobrar y si es efectivo o transferencia.");
    return;
  }

  await recordMessage(conversation.id, "restaurant", message.text, { waMessageId: message.waMessageId });

  const extracted = await extractTripFields(message.text);
  const result = evaluateExtraction(extracted);

  if (!result.complete) {
    const missingLabels = result.missing.map((key) => MISSING_FIELD_LABEL[key]).join(", ");
    const reply = `Me faltó: ${missingLabels}. ¿Me lo confirmas?`;
    await recordMessage(conversation.id, "bot", reply, { extraction: extracted as Record<string, unknown> });
    await sendText(message.phone, reply);
    return;
  }

  const trip = await createTrip(conversation.id, result.fields);

  const reply = `Listo, viaje *${trip.code}* registrado:\n📍 ${result.fields.direccionEntrega}\n💰 ${result.fields.valorACobrar} (${result.fields.metodoPago})\n\nTe aviso en cuanto tenga una moto asignada.`;
  await recordMessage(conversation.id, "bot", reply);
  await sendText(message.phone, reply);

  // TODO: disparar POST /api/internal/dispatch/:tripId en cuanto exista
  // flota real (couriers.lat/lng) para probar contra — ver
  // docs/PLAN_REFACTOR.md §4, paso 5.
}
