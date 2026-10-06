/**
 * Zonas de referencia de Cali, solo para el "Última zona" de Flota — no es
 * geocodificación: es el centroide más cercano de una lista corta de barrios.
 */

const ZONES: { name: string; lat: number; lng: number }[] = [
  { name: "San Fernando", lat: 3.4372, lng: -76.5422 },
  { name: "Granada", lat: 3.4583, lng: -76.5322 },
  { name: "Centro", lat: 3.4516, lng: -76.532 },
  { name: "Ciudad Jardín", lat: 3.3609, lng: -76.5352 },
  { name: "Chipichape", lat: 3.4764, lng: -76.5281 },
  { name: "El Limonar", lat: 3.3962, lng: -76.5417 },
  { name: "Tequendama", lat: 3.4224, lng: -76.5405 },
  { name: "San Antonio", lat: 3.4469, lng: -76.5385 },
  { name: "Pance", lat: 3.3375, lng: -76.5367 },
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

export const CITY_CENTER = { lat: 3.4516, lng: -76.532 };
