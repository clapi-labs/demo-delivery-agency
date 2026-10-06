import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificación de que el webhook viene de Meta. Idéntico al de CLAPI: sin
 * esto, la URL es un endpoint público que manda WhatsApps en nombre de la
 * agencia.
 */
export function isValidSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false;

  const [algorithm, received] = signatureHeader.split("=");
  if (algorithm !== "sha256" || !received) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(received, "hex");
  const b = Buffer.from(expected, "hex");

  return a.length === b.length && timingSafeEqual(a, b);
}

export function handleVerification(
  url: URL,
  expectedToken: string,
): { ok: true; challenge: string } | { ok: false } {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return { ok: true, challenge };
  }
  return { ok: false };
}
