import { timingSafeEqual } from "node:crypto";

import { env } from "@/env";

/**
 * Los endpoints internos mandan WhatsApps en nombre de la agencia: sin este
 * candado, cualquiera que descubra la URL escribe a restaurantes y
 * motorizados. El portal manda el secreto en `x-internal-secret`.
 */
export function isInternal(request: Request): boolean {
  const received = request.headers.get("x-internal-secret") ?? "";
  const expected = env.internalSecret;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
