import { latLngToCell } from "h3-js";

import type { GeoPoint } from "./types";
import { DEFAULT_H3_RESOLUTION } from "./eta";

/** La clave de `EtaCache`: el par de celdas H3 de origen y destino. */
export function h3EtaCacheKey(
  origin: GeoPoint,
  destination: GeoPoint,
  resolution = DEFAULT_H3_RESOLUTION,
): string {
  const originCell = latLngToCell(origin.lat, origin.lng, resolution);
  const destCell = latLngToCell(destination.lat, destination.lng, resolution);
  return `eta:${originCell}:${destCell}`;
}
