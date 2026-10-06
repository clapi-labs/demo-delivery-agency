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

export const EMPTY_TRIP_FIELDS: ExtractedTripFields = {
  origenRestaurante: null,
  direccionEntrega: null,
  telefonoCliente: null,
  valorACobrar: null,
  metodoPago: null,
};

/**
 * La memoria del pedido: lo que ya se sabía más lo que trajo el mensaje
 * nuevo. Un dato nuevo no nulo gana (es una corrección o un dato que
 * faltaba); un `null` nuevo NUNCA borra lo que ya se tenía. Que lo
 * garantice el código y no el modelo: si el modelo "olvida" un campo en su
 * respuesta, el pedido no pierde ese dato.
 */
export function mergeTripFields(known: ExtractedTripFields, incoming: ExtractedTripFields): ExtractedTripFields {
  return {
    origenRestaurante: incoming.origenRestaurante ?? known.origenRestaurante,
    direccionEntrega: incoming.direccionEntrega ?? known.direccionEntrega,
    telefonoCliente: incoming.telefonoCliente ?? known.telefonoCliente,
    valorACobrar: incoming.valorACobrar ?? known.valorACobrar,
    metodoPago: incoming.metodoPago ?? known.metodoPago,
  };
}

/** Cuántas veces se repregunta antes de pasar el pedido a una persona. */
export const MAX_CLARIFICATION_ATTEMPTS = 2;

export const ESCALATION_MESSAGE = "Te transferiré con un asesor de la central para gestionar tu pedido.";
export const ASSIGNED_MESSAGE = "Moto asignada. Entre 10 a 15 minutos está llegando.";

export const EXTRACTION_SYSTEM_PROMPT = `Eres el asistente de despacho de una agencia de domicilios. Un restaurante te escribe por WhatsApp, en texto libre y desordenado, pidiendo una moto. Puede mandar el pedido en varios mensajes.

Recibes los "Datos ya capturados" de mensajes anteriores y el "Mensaje nuevo". Devuelve SOLO este JSON, con el pedido COMPLETO hasta ahora:

{
  "origenRestaurante": string | null,   // nombre del restaurante que pide el domicilio
  "direccionEntrega": string | null,    // dirección del cliente final
  "telefonoCliente": string | null,     // teléfono del cliente final, solo dígitos
  "valorACobrar": number | null,        // pesos colombianos, solo el número
  "metodoPago": "efectivo" | "transferencia" | null,
  "confuso": boolean
}

Reglas:
- Conserva los datos ya capturados. Solo cámbialos si el mensaje nuevo los corrige explícitamente.
- Si el mensaje nuevo trae solo un dato suelto (por ejemplo, solo un número de teléfono o solo "efectivo"), asígnalo al campo que falta.
- Nunca inventes un valor: lo que no sepas va en null.
- "confuso": true si el restaurante se contradice sin aclarar cuál dato es el bueno, pide algo que no es un domicilio, está molesto o pide hablar con una persona. En cualquier otro caso, false.
- No agregues texto fuera del JSON.`;
