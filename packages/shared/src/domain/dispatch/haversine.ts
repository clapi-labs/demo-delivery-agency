import type { GeoPoint } from "./types";

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Distancia en línea recta, no de ruta. Es el filtro barato que descarta la
 *  mayoría de la flota antes de gastar un solo centavo en APIs de mapas. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export const DEFAULT_RADIUS_KM = 3;

/** Paso 1 del pipeline: descarta motos a más de `radiusKm` del punto de
 *  recogida. Nunca toca red — es la razón de que sea el primer filtro. */
export function filterByRadius<T extends { location: GeoPoint }>(
  candidates: T[],
  pickup: GeoPoint,
  radiusKm = DEFAULT_RADIUS_KM,
): (T & { distanceKm: number })[] {
  return candidates
    .map((c) => ({ ...c, distanceKm: haversineKm(pickup, c.location) }))
    .filter((c) => c.distanceKm <= radiusKm);
}
