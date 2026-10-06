import { env } from "@/env";

/**
 * Único camino de salida hacia WhatsApp — igual que CLAPI (RN-05 de su
 * diseño). Sin ventana de 24 h todavía porque no hay tabla `conversations`
 * con el reloj de esa ventana conectada aquí aún; se agrega en cuanto el
 * bot necesite reabrir conversación fuera de la primera respuesta.
 */

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "bot_inactive" }
  | { ok: false; reason: "http_error"; status: number; body: unknown }
  | { ok: false; reason: "network_error"; error: string };

function checkActive(): boolean {
  return env.botActive;
}

function graphUrl() {
  return `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;
}

export async function sendText(phone: string, text: string): Promise<SendResult> {
  if (!checkActive()) return { ok: false, reason: "bot_inactive" };

  try {
    const response = await fetch(graphUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: text },
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { ok: false, reason: "http_error", status: response.status, body };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "network_error", error: String(error) };
  }
}
