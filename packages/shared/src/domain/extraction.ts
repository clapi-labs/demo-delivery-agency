/**
 * Extracción del mensaje libre del restaurante (SPEC §A del prompt maestro).
 *
 * El modelo SOLO extrae; no decide, no calcula, no asigna. Mismo reparto de
 * responsabilidades que ya usaba CLAPI entre el modelo y el código
 * (ver ADR-08/ADR-09 del sistema original): el modelo dice qué nombró el
 * restaurante, el código valida y decide qué falta.
 */

export type PaymentMethod = "efectivo" | "transferencia";

export type ExtractedTripFields = {
  origenRestaurante: string | null;
  direccionEntrega: string | null;
  telefonoCliente: string | null;
  valorACobrar: number | null;
  metodoPago: PaymentMethod | null;
};

/** `Required<T>` solo quita el `?` opcional — estos campos ya son
 *  obligatorios y lo que hay que quitar es el `| null`. Sin este tipo,
 *  "completo" seguía permitiendo `null` en cada campo para TypeScript. */
export type ResolvedTripFields = { [K in keyof ExtractedTripFields]: Exclude<ExtractedTripFields[K], null> };

export type ExtractionResult =
  | { complete: true; fields: ResolvedTripFields }
  | { complete: false; fields: ExtractedTripFields; missing: (keyof ExtractedTripFields)[] };

const REQUIRED_FIELDS: (keyof ExtractedTripFields)[] = [
  "origenRestaurante",
  "direccionEntrega",
  "telefonoCliente",
  "valorACobrar",
  "metodoPago",
];

/** El modelo devuelve JSON con `null` en lo que no pudo leer; esto decide si
 *  ya alcanza para crear el viaje o hay que repreguntar — y qué. */
export function evaluateExtraction(fields: ExtractedTripFields): ExtractionResult {
  const missing = REQUIRED_FIELDS.filter((key) => fields[key] === null);
  if (missing.length === 0) {
    return { complete: true, fields: fields as ResolvedTripFields };
  }
  return { complete: false, fields, missing };
}

/** "efectivo requiere retorno a base" (prompt maestro §A): la plata que
 *  cobra el motorizado no es suya, hay que liquidarla — a diferencia de una
 *  transferencia, que ya le llegó directo al restaurante o a la agencia. */
export function requiresCashReturn(metodoPago: PaymentMethod): boolean {
  return metodoPago === "efectivo";
}

export const EXTRACTION_SYSTEM_PROMPT = `Eres un extractor de datos para una agencia de domicilios. Un restaurante te escribe en texto libre y desordenado pidiendo que le envíen una moto. Tu única tarea es devolver JSON con estos campos, usando null en lo que el mensaje no diga — nunca inventes un valor:

{
  "origenRestaurante": string | null,   // nombre del restaurante que pide el domicilio
  "direccionEntrega": string | null,    // dirección del cliente final
  "telefonoCliente": string | null,     // teléfono del cliente final, solo dígitos
  "valorACobrar": number | null,        // pesos colombianos, solo el número
  "metodoPago": "efectivo" | "transferencia" | null
}

No agregues texto fuera del JSON. No calcules ni corrijas nada, solo extrae lo que el mensaje dice explícitamente.`;
