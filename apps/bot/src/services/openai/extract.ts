import { EXTRACTION_SYSTEM_PROMPT, type ExtractedTripFields } from "@dispatch/shared";

import { env } from "@/env";

/**
 * Una sola llamada, salida JSON forzada (`response_format: json_object`) —
 * nada de tool calling: el modelo solo extrae, nunca decide (ver
 * `domain/extraction.ts`). Si OpenAI falla o devuelve algo irreconocible,
 * se degrada a "todo null" en vez de reventar: el llamador lo trata igual
 * que un mensaje incompleto y repregunta — nunca silencio.
 */
export async function extractTripFields(messageText: string): Promise<ExtractedTripFields> {
  const empty: ExtractedTripFields = {
    origenRestaurante: null,
    direccionEntrega: null,
    telefonoCliente: null,
    valorACobrar: null,
    metodoPago: null,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: env.openai.chatModel,
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: messageText },
        ],
      }),
    });

    if (!response.ok) return empty;

    const data = await response.json();
    const raw = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

    return {
      origenRestaurante: typeof raw.origenRestaurante === "string" ? raw.origenRestaurante : null,
      direccionEntrega: typeof raw.direccionEntrega === "string" ? raw.direccionEntrega : null,
      telefonoCliente: typeof raw.telefonoCliente === "string" ? raw.telefonoCliente : null,
      valorACobrar: typeof raw.valorACobrar === "number" ? raw.valorACobrar : null,
      metodoPago: raw.metodoPago === "efectivo" || raw.metodoPago === "transferencia" ? raw.metodoPago : null,
    };
  } catch {
    return empty;
  }
}
