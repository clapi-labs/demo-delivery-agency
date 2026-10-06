import { and, asc, eq } from "drizzle-orm";

import { db } from "./client";
import { fares, settings, zones } from "./schema";

export const DEFAULT_FARE_KEY = "default_fare";
export const DEFAULT_FARE = 7000;

export type Zone = typeof zones.$inferSelect;

export async function listZones(): Promise<Zone[]> {
  return db.select().from(zones).orderBy(asc(zones.sortOrder), asc(zones.id));
}

/**
 * La zona de un texto, por palabras clave. Es el respaldo cuando el modelo no
 * reconoce el barrio: "Cra 119 Caney" → El Caney, aunque el modelo no lo haya
 * nombrado. Sin coincidencia, `null` (y se cobra la tarifa por defecto).
 */
export function matchZone(text: string, all: Zone[]): Zone | null {
  const normalized = normalize(text);
  for (const zone of all) {
    const words = [zone.name, ...zone.keywords].map(normalize).filter(Boolean);
    if (words.some((w) => normalized.includes(w))) return zone;
  }
  return null;
}

/** El modelo devuelve el nombre de la zona; esto lo lleva a una fila real. */
export function findZoneByName(name: string | null | undefined, all: Zone[]): Zone | null {
  if (!name) return null;
  const n = normalize(name);
  return all.find((z) => normalize(z.name) === n) ?? all.find((z) => normalize(z.name).includes(n) || n.includes(normalize(z.name))) ?? null;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getDefaultFare(): Promise<number> {
  const [row] = await db.select().from(settings).where(eq(settings.key, DEFAULT_FARE_KEY));
  return typeof row?.value === "number" ? row.value : DEFAULT_FARE;
}

/** El precio del domicilio: la celda origen × destino, o la tarifa por defecto. */
export async function quoteFare(origin: Zone | null, destination: Zone | null): Promise<number> {
  if (origin && destination) {
    const [row] = await db
      .select({ price: fares.price })
      .from(fares)
      .where(and(eq(fares.originZoneId, origin.id), eq(fares.destinationZoneId, destination.id)));
    if (row) return row.price;
  }
  return getDefaultFare();
}

export async function getFareMatrix() {
  const [allZones, allFares, defaultFare] = await Promise.all([listZones(), db.select().from(fares), getDefaultFare()]);
  return {
    zones: allZones,
    fares: allFares.map((f) => ({ originZoneId: f.originZoneId, destinationZoneId: f.destinationZoneId, price: f.price })),
    defaultFare,
  };
}

export async function saveFareMatrix(input: {
  fares: { originZoneId: number; destinationZoneId: number; price: number }[];
  defaultFare: number;
}) {
  for (const f of input.fares) {
    await db
      .insert(fares)
      .values(f)
      .onConflictDoUpdate({ target: [fares.originZoneId, fares.destinationZoneId], set: { price: f.price } });
  }
  await db
    .insert(settings)
    .values({ key: DEFAULT_FARE_KEY, value: input.defaultFare })
    .onConflictDoUpdate({ target: settings.key, set: { value: input.defaultFare } });
}
