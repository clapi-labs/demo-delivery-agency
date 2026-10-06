import { DEFAULT_RADIUS_KM, filterByRadius, haversineKm } from "./haversine";
import { ETA_CACHE_TTL_SECONDS, estimateEtaMinutes, type EtaCache, type MapsClient } from "./eta";
import { h3EtaCacheKey } from "./h3-key";
import { computeFactors, computeScore, shiftAverageDeliveries, weightsForMode } from "./score";
import type { CourierCandidate, OperatingMode, ScoredCandidate, TripRequest } from "./types";

const TOP_N_FOR_API = 3;

export type RankCandidatesPorts = {
  etaCache: EtaCache;
  maps: MapsClient;
  radiusKm?: number;
  h3Resolution?: number;
};

/**
 * Los tres pasos de "API de mapas a $0" (SPEC §3), en orden:
 *
 * 1. Haversine descarta todo lo que no entra en el radio.
 * 2. Caché espacial (H3) resuelve el ETA de lo que ya se preguntó antes.
 * 3. Google Maps solo se llama para el Top 3 que sigue sin ETA — y en una
 *    sola llamada batch, no en tres.
 *
 * Devuelve los candidatos puntuados, de mayor a menor score. Quien llama
 * decide cuántos ofertar y en qué orden — este pipeline no envía nada.
 */
export async function rankCandidates(
  trip: TripRequest,
  allCandidates: CourierCandidate[],
  mode: OperatingMode,
  ports: RankCandidatesPorts,
): Promise<ScoredCandidate[]> {
  const radiusKm = ports.radiusKm ?? DEFAULT_RADIUS_KM;
  const inRadius = filterByRadius(allCandidates, trip.pickup, radiusKm);
  if (inRadius.length === 0) return [];

  const shiftAverage = shiftAverageDeliveries(allCandidates);

  // Para no perder al mejor candidato por un ETA sin resolver, se ordena por
  // Haversine primero y solo los más cercanos compiten por el presupuesto de
  // API cuando la caché no alcanza.
  const byProximity = [...inRadius].sort((a, b) => a.distanceKm - b.distanceKm);

  const etaByCourier = new Map<number, { minutes: number; source: "cache" | "api" | "estimated" }>();
  const pendingApiLookup: typeof byProximity = [];

  for (const candidate of byProximity) {
    const key = h3EtaCacheKey(trip.pickup, candidate.location, ports.h3Resolution);
    const cached = await ports.etaCache.get(key);
    if (cached !== null) {
      etaByCourier.set(candidate.courierId, { minutes: cached, source: "cache" });
    } else {
      pendingApiLookup.push(candidate);
    }
  }

  const apiCandidates = pendingApiLookup.slice(0, TOP_N_FOR_API);
  if (apiCandidates.length > 0) {
    const etas = await ports.maps.etaMinutesBatch(
      trip.pickup,
      apiCandidates.map((c) => c.location),
    );
    for (let i = 0; i < apiCandidates.length; i++) {
      const candidate = apiCandidates[i];
      const etaMinutes = etas[i];
      etaByCourier.set(candidate.courierId, { minutes: etaMinutes, source: "api" });
      const key = h3EtaCacheKey(trip.pickup, candidate.location, ports.h3Resolution);
      await ports.etaCache.set(key, etaMinutes, ETA_CACHE_TTL_SECONDS);
    }
  }

  // El resto (ni caché ni cupo de API) recibe una estimación local: nunca se
  // bloquea una asignación por presupuesto de mapas.
  for (const candidate of pendingApiLookup.slice(TOP_N_FOR_API)) {
    etaByCourier.set(candidate.courierId, {
      minutes: estimateEtaMinutes(candidate.distanceKm),
      source: "estimated",
    });
  }

  const weights = weightsForMode(mode);

  const scored: ScoredCandidate[] = byProximity.map((candidate) => {
    const eta = etaByCourier.get(candidate.courierId)!;
    const factors = computeFactors(candidate, candidate.distanceKm, eta.minutes, radiusKm, shiftAverage);
    return {
      courier: candidate,
      distanceKm: candidate.distanceKm,
      etaMinutes: eta.minutes,
      etaSource: eta.source,
      factors,
      score: computeScore(factors, weights),
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export { haversineKm };
