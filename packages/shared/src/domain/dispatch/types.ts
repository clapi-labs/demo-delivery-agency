/**
 * Motor de asignación multi-factor.
 *
 * Todo lo de abajo es puro (sin red, sin base de datos): recibe candidatos ya
 * cargados y un `EtaResolver`/`EtaCache` inyectados, y devuelve una decisión.
 * Quien orquesta (el endpoint `/api/internal/dispatch/:tripId`) es quien sabe
 * de Postgres, Redis y Google Maps — este archivo no.
 */

export type GeoPoint = { lat: number; lng: number };

export type OperatingMode = "peak" | "valley";

export type CourierStatus = "available" | "busy" | "paused" | "offline";

/** Lo que el motor necesita saber de un domiciliario para puntuarlo. */
export type CourierCandidate = {
  courierId: number;
  name: string;
  phone: string;
  location: GeoPoint;
  /** Hace cuánto se actualizó `location`. Un candidato con la ubicación muy
   *  vieja (p. ej. > 5 min) no debería competir: puede que ya no esté ahí. */
  locationAgeSeconds: number;
  status: CourierStatus;
  /** Entregas completadas en el turno actual. Insumo del factor de equidad. */
  deliveriesThisShift: number;
};

export type TripRequest = {
  tripId: number;
  pickup: GeoPoint;
  pickupAddress: string;
  deliveryAddress: string;
};

export type ScoreWeights = {
  time: number;
  route: number;
  equity: number;
};

/**
 * $W_2$ (ruta) no lo fijó el negocio explícitamente — solo dieron $W_1$ y
 * $W_3$ por modo. Se asume aquí como el residuo: lo que no es tiempo ni
 * equidad. Si el negocio tiene una cifra propia, se reemplaza este mapa, no
 * la fórmula.
 */
export const SCORE_WEIGHTS: Record<OperatingMode, ScoreWeights> = {
  peak: { time: 0.7, route: 0.1, equity: 0.2 },
  valley: { time: 0.2, route: 0.2, equity: 0.6 },
};

export type ScoreFactors = {
  time: number;
  route: number;
  equity: number;
};

export type EtaSource = "cache" | "api" | "estimated";

export type ScoredCandidate = {
  courier: CourierCandidate;
  distanceKm: number;
  etaMinutes: number;
  etaSource: EtaSource;
  factors: ScoreFactors;
  score: number;
};

/** Por qué una oferta salió del paso: expiró sin respuesta o el motorizado
 *  la rechazó explícitamente. Distinguirlo importa para el ajuste del
 *  algoritmo — un rechazo explícito dice algo distinto que un silencio. */
export type OfferOutcome = "accepted" | "rejected" | "expired";

export type DispatchResult =
  | { kind: "assigned"; courierId: number; rank: number }
  | { kind: "exhausted"; attemptedCourierIds: number[] };
