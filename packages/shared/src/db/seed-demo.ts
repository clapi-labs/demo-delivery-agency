import { db, schema } from "./client";

/**
 * Datos de demostración — restaurantes, motorizados y viajes ficticios para
 * que el tablero no empiece vacío el día de la presentación. Se puede
 * correr más de una vez: no borra lo anterior, solo agrega otra tanda (así
 * no se pierde nada si ya se generaron viajes reales por WhatsApp).
 */

const COURIERS = [
  { name: "Camilo Rodríguez", phone: "573001112233", lat: 4.6514, lng: -74.0628, status: "available" as const, deliveries: 4 },
  { name: "Laura Gómez", phone: "573002223344", lat: 4.6947, lng: -74.0303, status: "available" as const, deliveries: 2 },
  { name: "Andrés Pardo", phone: "573003334455", lat: 4.6283, lng: -74.1646, status: "busy" as const, deliveries: 6 },
  { name: "Diana Torres", phone: "573004445566", lat: 4.7558, lng: -74.0931, status: "available" as const, deliveries: 1 },
  { name: "Jhon Fredy Martínez", phone: "573005556677", lat: 4.6356, lng: -74.0925, status: "paused" as const, deliveries: 3 },
  { name: "Sebastián Cruz", phone: "573006667788", lat: 4.6728, lng: -74.1458, status: "offline" as const, deliveries: 0 },
];

const RESTAURANTS = [
  { name: "Donde Lucho", lat: 4.6514, lng: -74.0628, address: "Calle 63 #11-20, Chapinero" },
  { name: "Crepes Express", lat: 4.6947, lng: -74.0303, address: "Carrera 7 #116-50, Usaquén" },
  { name: "Wok to Go", lat: 4.6283, lng: -74.1646, address: "Av. Primero de Mayo #68-40, Kennedy" },
  { name: "La Hamburguesería", lat: 4.6356, lng: -74.0925, address: "Calle 45 #22-10, Teusaquillo" },
  { name: "Pizza Nostra", lat: 4.7108, lng: -74.1157, address: "Calle 80 #100-20, Engativá" },
];

const DELIVERY_ADDRESSES = [
  "Calle 85 #15-30, Chapinero",
  "Carrera 11 #93-45, Chicó",
  "Calle 127 #45-12, Usaquén",
  "Carrera 50 #22-18, Teusaquillo",
  "Calle 170 #60-05, Suba",
  "Carrera 68 #40-20, Kennedy",
];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

function tripCode() {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `D-${code}`;
}

function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000);
}

export async function seedDemo() {
  const insertedCouriers = await db.insert(schema.couriers).values(
    COURIERS.map((c) => ({
      name: c.name,
      phone: c.phone,
      status: c.status,
      lat: c.lat,
      lng: c.lng,
      locationUpdatedAt: new Date(),
      deliveriesThisShift: c.deliveries,
      shiftStartedAt: minutesAgo(180),
    })),
  ).returning();

  console.log(`✓ ${insertedCouriers.length} motorizados`);

  // --- Pendientes: distintas edades para ver el indicador de espera ---
  const pendingSpecs = [
    { restaurant: 0, delivery: 0, value: 28000, payment: "efectivo" as const, ageMin: 0.2 },
    { restaurant: 2, delivery: 3, value: 45000, payment: "transferencia" as const, ageMin: 1.8 },
    { restaurant: 4, delivery: 5, value: 32000, payment: "efectivo" as const, ageMin: 3.5 },
  ];

  for (const spec of pendingSpecs) {
    const restaurant = pick(RESTAURANTS, spec.restaurant);
    await db.insert(schema.trips).values({
      code: tripCode(),
      status: "pending",
      originRestaurantName: restaurant.name,
      pickupAddress: restaurant.address,
      pickupLocation: { lat: restaurant.lat, lng: restaurant.lng },
      deliveryAddress: pick(DELIVERY_ADDRESSES, spec.delivery),
      customerPhone: "573009998877",
      valueToCollect: spec.value,
      paymentMethod: spec.payment,
      requiresCashReturn: spec.payment === "efectivo",
      createdAt: minutesAgo(spec.ageMin),
      updatedAt: minutesAgo(spec.ageMin),
    });
  }

  // --- En ruta: ya asignados, hace rato (sin el destello de "recién asignado") ---
  const enRouteSpecs = [
    { restaurant: 1, delivery: 1, value: 52000, payment: "transferencia" as const, courier: insertedCouriers[2] },
    { restaurant: 3, delivery: 2, value: 19000, payment: "efectivo" as const, courier: insertedCouriers[0] },
  ];

  for (const spec of enRouteSpecs) {
    const restaurant = pick(RESTAURANTS, spec.restaurant);
    const [trip] = await db
      .insert(schema.trips)
      .values({
        code: tripCode(),
        status: "en_route",
        originRestaurantName: restaurant.name,
        pickupAddress: restaurant.address,
        pickupLocation: { lat: restaurant.lat, lng: restaurant.lng },
        deliveryAddress: pick(DELIVERY_ADDRESSES, spec.delivery),
        customerPhone: "573008887766",
        valueToCollect: spec.value,
        paymentMethod: spec.payment,
        requiresCashReturn: spec.payment === "efectivo",
        createdAt: minutesAgo(12),
        updatedAt: minutesAgo(4),
      })
      .returning();

    await db.insert(schema.assignments).values({
      tripId: trip.id,
      courierId: spec.courier.id,
      courierName: spec.courier.name,
      assignedAt: minutesAgo(8),
      dispatchedAt: minutesAgo(7),
    });
  }

  // --- Entregados: para que Arqueo tenga números reales ---
  const deliveredSpecs = [
    { restaurant: 0, delivery: 0, value: 24000, payment: "efectivo" as const, courier: insertedCouriers[2] },
    { restaurant: 1, delivery: 2, value: 61000, payment: "transferencia" as const, courier: insertedCouriers[2] },
    { restaurant: 2, delivery: 4, value: 18000, payment: "efectivo" as const, courier: insertedCouriers[4] },
    { restaurant: 4, delivery: 1, value: 33000, payment: "efectivo" as const, courier: insertedCouriers[0] },
  ];

  for (const spec of deliveredSpecs) {
    const restaurant = pick(RESTAURANTS, spec.restaurant);
    const [trip] = await db
      .insert(schema.trips)
      .values({
        code: tripCode(),
        status: "delivered",
        originRestaurantName: restaurant.name,
        pickupAddress: restaurant.address,
        pickupLocation: { lat: restaurant.lat, lng: restaurant.lng },
        deliveryAddress: pick(DELIVERY_ADDRESSES, spec.delivery),
        customerPhone: "573007776655",
        valueToCollect: spec.value,
        paymentMethod: spec.payment,
        requiresCashReturn: spec.payment === "efectivo",
        createdAt: minutesAgo(90),
        updatedAt: minutesAgo(40),
      })
      .returning();

    await db.insert(schema.assignments).values({
      tripId: trip.id,
      courierId: spec.courier.id,
      courierName: spec.courier.name,
      assignedAt: minutesAgo(85),
      dispatchedAt: minutesAgo(80),
      deliveredAt: minutesAgo(40),
    });
  }

  console.log(`✓ ${pendingSpecs.length} viajes pendientes, ${enRouteSpecs.length} en ruta, ${deliveredSpecs.length} entregados`);
}
