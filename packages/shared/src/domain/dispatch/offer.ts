import type { DispatchResult, ScoredCandidate } from "./types";

export const OFFER_TTL_SECONDS = 15;

export type OfferAttempt = {
  courierId: number;
  rank: number;
  offeredAt: Date;
};

/**
 * Siguiente candidato a ofertar, dado quién ya lo rechazó o dejó vencer la
 * oferta. Pura a propósito: quien persiste el intento (`dispatch_offers`) y
 * programa el vencimiento de los 15 s es el endpoint, no esta función.
 */
export function nextCandidate(
  ranked: ScoredCandidate[],
  attempted: Pick<OfferAttempt, "courierId">[],
): ScoredCandidate | null {
  const attemptedIds = new Set(attempted.map((a) => a.courierId));
  return ranked.find((c) => !attemptedIds.has(c.courier.courierId)) ?? null;
}

export function isOfferExpired(offeredAt: Date, now = new Date(), ttlSeconds = OFFER_TTL_SECONDS): boolean {
  return now.getTime() - offeredAt.getTime() >= ttlSeconds * 1000;
}

/**
 * Resume el resultado de la secuencia de ofertas para un viaje: a quién se
 * le asignó, o que las tres (o las que hubiera) se agotaron sin que nadie
 * aceptara. `exhausted` es la señal para que el portal lo muestre como
 * "sin moto disponible" y permita asignar a mano.
 */
export function summarizeDispatch(
  ranked: ScoredCandidate[],
  attempted: OfferAttempt[],
  acceptedCourierId: number | null,
): DispatchResult {
  if (acceptedCourierId !== null) {
    const rank = attempted.find((a) => a.courierId === acceptedCourierId)?.rank ?? 0;
    return { kind: "assigned", courierId: acceptedCourierId, rank };
  }
  return { kind: "exhausted", attemptedCourierIds: attempted.map((a) => a.courierId) };
}
