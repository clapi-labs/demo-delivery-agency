import type { CourierCandidate, OperatingMode, ScoreFactors, ScoreWeights } from "./types";
import { SCORE_WEIGHTS } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Hora pico 11 a.m.–2 p.m. y 6–9 p.m., igual que cualquier ciudad con
 *  almuerzo y cena. Son valores de arranque, no una regla de negocio
 *  cerrada — se mueven a configuración en cuanto el cliente dé sus horas
 *  reales. */
export function resolveOperatingMode(hour: number): OperatingMode {
  const isLunchPeak = hour >= 11 && hour < 14;
  const isDinnerPeak = hour >= 18 && hour < 21;
  return isLunchPeak || isDinnerPeak ? "peak" : "valley";
}

export function weightsForMode(mode: OperatingMode): ScoreWeights {
  return SCORE_WEIGHTS[mode];
}

/** Factor tiempo: ETA más corto → factor más alto. `maxEtaMinutes` fija el
 *  techo de la normalización — por defecto 20 min, que es ya un domicilio
 *  lento en una ciudad intermedia. */
export function timeFactor(etaMinutes: number, maxEtaMinutes = 20): number {
  return clamp(1 - etaMinutes / maxEtaMinutes, 0, 1);
}

/**
 * Factor ruta: qué tan alineado va el domiciliario hacia el punto de
 * recogida respecto a su distancia en línea recta. Placeholder deliberado
 * para el MVP — sin rumbo (`heading`) confiable todavía, se aproxima con la
 * misma distancia Haversine ya calculada en el filtro: más cerca, mejor
 * ruta. Cuando se tenga `heading` real del GPS, este factor se reemplaza por
 * la alineación entre el rumbo y el vector hacia el pickup — no la fórmula
 * del score completa.
 */
export function routeFactor(distanceKm: number, radiusKm: number): number {
  return clamp(1 - distanceKm / radiusKm, 0, 1);
}

/**
 * Factor equidad: por debajo del promedio del turno, el factor sube de 0.5
 * hacia 1 (prioridad); por encima, baja de 0.5 hacia 0 (penalización leve).
 * `shiftAverage` en 0 (nadie ha entregado nada todavía) no penaliza a nadie:
 * todos entran en 0.5, neutro.
 */
export function equityFactor(deliveriesThisShift: number, shiftAverage: number): number {
  if (shiftAverage <= 0) return 0.5;
  const relative = (shiftAverage - deliveriesThisShift) / shiftAverage;
  return clamp(0.5 + relative * 0.5, 0, 1);
}

export function computeFactors(
  candidate: Pick<CourierCandidate, "deliveriesThisShift">,
  distanceKm: number,
  etaMinutes: number,
  radiusKm: number,
  shiftAverage: number,
): ScoreFactors {
  return {
    time: timeFactor(etaMinutes),
    route: routeFactor(distanceKm, radiusKm),
    equity: equityFactor(candidate.deliveriesThisShift, shiftAverage),
  };
}

/** $S = F_{tiempo} \times W_1 + F_{ruta} \times W_2 + F_{equidad} \times W_3$ */
export function computeScore(factors: ScoreFactors, weights: ScoreWeights): number {
  return factors.time * weights.time + factors.route * weights.route + factors.equity * weights.equity;
}

export function shiftAverageDeliveries(couriers: Pick<CourierCandidate, "deliveriesThisShift">[]): number {
  if (couriers.length === 0) return 0;
  const total = couriers.reduce((sum, c) => sum + c.deliveriesThisShift, 0);
  return total / couriers.length;
}
