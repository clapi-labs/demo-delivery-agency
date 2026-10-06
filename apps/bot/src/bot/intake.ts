import {
  ASSIGNED_MESSAGE,
  EMPTY_TRIP_FIELDS,
  ESCALATION_MESSAGE,
  MAX_CLARIFICATION_ATTEMPTS,
  evaluateExtraction,
  mergeTripFields,
} from "@dispatch/shared";
import { assignNextCourier } from "@dispatch/shared/db";

import { recordMessage, updateConversation, upsertConversationOnInbound, type Conversation } from "@/db/queries/conversation";
import { createTrip } from "@/db/queries/trips";
import { extractTripFields } from "@/services/openai/extract";
import { sendText } from "@/services/whatsapp/client";
import type { IncomingMessage } from "@/services/whatsapp/types";

/**
 * El flujo de un pedido por WhatsApp, en tres salidas posibles:
 *
 * 1. **Completo** → se crea el viaje, se asigna la siguiente moto de la cola
 *    y se le confirma al restaurante.
 * 2. **Incompleto** → se guarda lo que se entendió (el borrador es la memoria
 *    entre mensajes) y se pregunta SOLO lo que falta.
 * 3. **Confuso, o incompleto después de 2 repreguntas** → se pausa el bot y se
 *    le pasa a un asesor. Un bot que insiste una tercera vez ya no está
 *    ayudando, está estorbando.
 */

const FIELD_LABEL: Record<string, string> = {
  origenRestaurante: "el nombre del restaurante",
  direccionEntrega: "la dirección de entrega",
  telefonoCliente: "el teléfono del cliente",
  valorACobrar: "el valor a cobrar",
  metodoPago: "si es en efectivo o por transferencia",
};

const TEMPLATE =
  "¡Hola! 🛵 Para pedir una moto envíame:\n\n• Restaurante\n• Dirección de entrega\n• Teléfono del cliente\n• Valor a cobrar\n• Efectivo o transferencia\n\nPuede ser en un solo mensaje o por partes.";

function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

async function reply(conversation: Conversation, phone: string, text: string) {
  await recordMessage(conversation.id, "bot", text);
  await sendText(phone, text);
}

async function escalate(conversation: Conversation, phone: string, reason: string) {
  await updateConversation(conversation.id, {
    botPaused: true,
    escalationReason: reason,
    draft: null,
    failedAttempts: 0,
  });
  await reply(conversation, phone, ESCALATION_MESSAGE);
}

export async function handleIncoming(message: IncomingMessage) {
  const conversation = await upsertConversationOnInbound(message.phone, message.profileName);
  const text = message.kind === "text" ? message.text : `[${message.type}]`;

  await recordMessage(conversation.id, "restaurant", text, { waMessageId: message.waMessageId });

  // Con un asesor al frente, el bot no contesta nada: escuchar y callar.
  if (conversation.botPaused) return;

  if (message.kind !== "text") {
    await reply(conversation, message.phone, "Por ahora solo leo mensajes de texto. " + TEMPLATE);
    return;
  }

  const known = conversation.draft ?? EMPTY_TRIP_FIELDS;
  const extraction = await extractTripFields(message.text, known);
  const merged = mergeTripFields(known, extraction.fields);

  if (extraction.confused) {
    await escalate(conversation, message.phone, "El restaurante dio datos confusos o pidió hablar con una persona.");
    return;
  }

  const result = evaluateExtraction(merged);

  if (result.complete) {
    await updateConversation(conversation.id, { draft: null, failedAttempts: 0 });
    const trip = await createTrip(conversation.id, result.fields);
    const courier = await assignNextCourier(trip.id);

    await reply(
      conversation,
      message.phone,
      courier
        ? `✅ ${ASSIGNED_MESSAGE}\n\nPedido ${trip.code} · ${courier.courierName}`
        : `✅ Pedido ${trip.code} recibido. Todas las motos están en ruta: te asignamos la primera que se libere.`,
    );
    return;
  }

  // Un saludo o un mensaje sin ningún dato no cuenta como intento fallido:
  // el restaurante todavía no ha intentado pedir nada.
  const nothingYet = result.missing.length === 5;
  if (nothingYet && conversation.failedAttempts === 0) {
    await reply(conversation, message.phone, TEMPLATE);
    return;
  }

  // Un intento fallido es un mensaje que no aportó NINGÚN dato nuevo. El
  // restaurante que manda la dirección en un mensaje y el teléfono en otro
  // está colaborando, no confundido: no puede acercarse al escalamiento.
  const filled = (f: typeof merged) => Object.values(f).filter((v) => v !== null).length;
  const progressed = filled(merged) > filled(known);
  const attempts = progressed ? conversation.failedAttempts : conversation.failedAttempts + 1;

  if (attempts >= MAX_CLARIFICATION_ATTEMPTS) {
    await escalate(conversation, message.phone, `${MAX_CLARIFICATION_ATTEMPTS} mensajes seguidos sin datos nuevos del pedido.`);
    return;
  }

  await updateConversation(conversation.id, { draft: merged, failedAttempts: attempts });
  const missing = joinLabels(result.missing.map((key) => FIELD_LABEL[key]));
  await reply(conversation, message.phone, `Perfecto, ya lo tengo anotado. Solo me falta ${missing}. ¿Me lo confirmas?`);
}
