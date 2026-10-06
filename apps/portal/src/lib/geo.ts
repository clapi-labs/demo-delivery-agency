/**
 * Zonas de referencia de Bogotá, solo para el efecto "estamos mirando el
 * GPS" en la vista de Flota — no es geocodificación real, es la celda más
 * cercana de una lista corta de centroides conocidos.
 */

const ZONES: { name: string; lat: number; lng: number }[] = [
  { name: "Chapinero", lat: 4.6514, lng: -74.0628 },
  { name: "Usaquén", lat: 4.6947, lng: -74.0303 },
  { name: "Centro", lat: 4.5981, lng: -74.0758 },
  { name: "Suba", lat: 4.7558, lng: -74.0931 },
  { name: "Kennedy", lat: 4.6283, lng: -74.1646 },
  { name: "Engativá", lat: 4.7108, lng: -74.1157 },
  { name: "Teusaquillo", lat: 4.6356, lng: -74.0925 },
  { name: "Fontibón", lat: 4.6728, lng: -74.1458 },
];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestZone(lat: number, lng: number): string {
  let best = ZONES[0];
  let bestDist = Infinity;
  for (const zone of ZONES) {
    const dist = haversineKm({ lat, lng }, zone);
    if (dist < bestDist) {
      bestDist = dist;
      best = zone;
    }
  }
  return best.name;
}

export const BOGOTA_CENTER = { lat: 4.6097, lng: -74.0817 };
