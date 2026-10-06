import { EMPTY_TRIP_FIELDS, buildExtractionPrompt, type ExtractedTripFields } from "@dispatch/shared";

import { env } from "@/env";

export type ExtractionOutcome = { fields: ExtractedTripFields; confused: boolean; failed: boolean };

/**
 * Una sola llamada con salida JSON forzada. Recibe lo ya capturado para que
 * el modelo sepa a qué campo pertenece un dato suelto ("3001234567" → el
 * teléfono que faltaba). Si OpenAI falla, devuelve `failed` y el llamador
 * conserva el borrador tal cual — un error de red no puede borrar el pedido.
 */
export async function extractTripFields(
  messageText: string,
  known: ExtractedTripFields,
  zoneNames: string[],
): Promise<ExtractionOutcome> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.openai.apiKey}` },
      body: JSON.stringify({
        model: env.openai.chatModel,
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: buildExtractionPrompt(zoneNames) },
          {
            role: "user",
            content: `Datos ya capturados:\n${JSON.stringify(known)}\n\nMensaje nuevo del restaurante:\n${messageText}`,
          },
        ],
      }),
    });

    if (!response.ok) return { fields: EMPTY_TRIP_FIELDS, confused: false, failed: true };

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

    const valor =
      typeof raw.valorACobrar === "number"
        ? raw.valorACobrar
        : typeof raw.valorACobrar === "string" && /\d/.test(raw.valorACobrar)
          ? Number(raw.valorACobrar.replace(/\D/g, ""))
          : null;

    return {
      fields: {
        origenRestaurante: typeof raw.origenRestaurante === "string" && raw.origenRestaurante.trim() ? raw.origenRestaurante.trim() : null,
        direccionEntrega: typeof raw.direccionEntrega === "string" && raw.direccionEntrega.trim() ? raw.direccionEntrega.trim() : null,
        telefonoCliente: typeof raw.telefonoCliente === "string" && /\d{7,}/.test(raw.telefonoCliente.replace(/\D/g, "")) ? raw.telefonoCliente.replace(/\D/g, "") : null,
        valorACobrar: valor && valor > 0 ? valor : null,
        metodoPago: raw.metodoPago === "efectivo" || raw.metodoPago === "transferencia" ? raw.metodoPago : null,
        zonaRecogida: typeof raw.zonaRecogida === "string" ? raw.zonaRecogida : null,
        zonaEntrega: typeof raw.zonaEntrega === "string" ? raw.zonaEntrega : null,
      },
      confused: raw.confuso === true,
      failed: false,
    };
  } catch {
    return { fields: EMPTY_TRIP_FIELDS, confused: false, failed: true };
  }
}
