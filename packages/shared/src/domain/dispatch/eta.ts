import type { GeoPoint } from "./types";

/**
 * Caché espacial de ETAs (paso 2) y cliente de mapas (paso 3).
 *
 * Son interfaces, no implementaciones: el motor (`pipeline.ts`) depende de
 * estos puertos, no de Redis ni de la API de Google. Así se prueba sin red y
 * se cambia de proveedor sin tocar la fórmula del score.
 *
 * La clave de caché combina los índices H3 de origen y destino, no las
 * coordenadas exactas: dos pedidos del mismo restaurante a dos casas vecinas
 * caen en la misma celda y comparten el ETA guardado. `h3Resolution` 8 es
 * ~0.46 km² por celda — suficientemente fino para no mezclar zonas distintas,
 * suficientemente ancho para que el mismo trayecto repita cache hit.
 */

export type EtaCache = {
  get(key: string): Promise<number | null>;
  set(key: string, etaMinutes: number, ttlSeconds: number): Promise<void>;
};

export type MapsClient = {
  /** Un origen, hasta N destinos, en una sola llamada — así es como se
   *  cumple "Top 3 por viaje, no 3 llamadas". */
  etaMinutesBatch(origin: GeoPoint, destinations: GeoPoint[]): Promise<number[]>;
};

export const ETA_CACHE_TTL_SECONDS = 600;
export const DEFAULT_H3_RESOLUTION = 8;

/** Implementación de referencia en memoria — sirve para desarrollo local y
 *  para los tests del pipeline. En producción se reemplaza por un adaptador
 *  de Upstash/Redis con la misma forma. */
export function createInMemoryEtaCache(): EtaCache {
  const store = new Map<string, { value: number; expiresAt: number }>();
  return {
    async get(key) {
      const hit = store.get(key);
      if (!hit || hit.expiresAt < Date.now()) return null;
      return hit.value;
    },
    async set(key, etaMinutes, ttlSeconds) {
      store.set(key, { value: etaMinutes, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
  };
}

/** Estimación sin red: km en línea recta sobre una velocidad promedio de
 *  moto en tráfico urbano. Es el último recurso cuando ni la caché ni el
 *  presupuesto de API alcanzan — nunca bloquea una asignación por costo. */
export function estimateEtaMinutes(distanceKm: number, avgSpeedKmh = 22): number {
  return Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
}
