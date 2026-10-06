import {
  createInMemoryEtaCache,
  estimateEtaMinutes,
  haversineKm,
  type EtaCache,
  type GeoPoint,
  type MapsClient,
} from "@dispatch/shared";

/**
 * Adaptadores reales del pipeline para la demo — documentados como
 * pendientes en docs/PLAN_REFACTOR.md §4: caché en memoria del proceso (no
 * Redis todavía, no hace falta a esta escala) y un "cliente de mapas" que en
 * vez de llamar a Google Distance Matrix (costaría dinero y pide tarjeta)
 * estima por Haversine — el mismo camino que el pipeline ya usa como último
 * recurso. El algoritmo corre igual de completo; lo único que cambia es de
 * dónde sale el ETA.
 */
let cache: EtaCache | null = null;

export function sharedEtaCache(): EtaCache {
  if (!cache) cache = createInMemoryEtaCache();
  return cache;
}

export const freeMapsClient: MapsClient = {
  async etaMinutesBatch(origin: GeoPoint, destinations: GeoPoint[]) {
    return destinations.map((d) => estimateEtaMinutes(haversineKm(origin, d)));
  },
};
