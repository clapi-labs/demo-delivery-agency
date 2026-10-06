import { eq } from "drizzle-orm";

import { db, schema } from "./client";

/**
 * Deja la base lista para mostrar: `npm run db:seed:demo`.
 *
 * Se puede correr las veces que haga falta (antes de cada demo): borra los
 * viajes y deja la flota coherente — sin motos "en viaje" sin viaje, ni
 * cronómetros de cinco horas. NO toca las conversaciones: los chats reales
 * con restaurantes se conservan.
 *
 * Arranca con historial (entregas de la mañana, para que Arqueo tenga
 * números) y dos motos en la calle. La columna "Por asignar" queda vacía a
 * propósito: lo que entre en la demo entra por WhatsApp, en vivo.
 */

const COURIERS = [
  { name: "Camilo Rodríguez", phone: "573001112233", lat: 3.4516, lng: -76.532 },
  { name: "Laura Gómez", phone: "573002223344", lat: 3.4372, lng: -76.5225 },
  { name: "Andrés Pardo", phone: "573003334455", lat: 3.4205, lng: -76.5405 },
  { name: "Diana Torres", phone: "573004445566", lat: 3.4721, lng: -76.5295 },
  { name: "Jhon Fredy Martínez", phone: "573005556677", lat: 3.4012, lng: -76.5468 },
  { name: "Sebastián Cruz", phone: "573006667788", lat: 3.4583, lng: -76.5172 },
];

// Restaurantes y direcciones de Cali — el cliente es Express Cali.
const DELIVERED = [
  { courier: 0, restaurant: "Donde Lucho", address: "Calle 5 #38-20, San Fernando", value: 32000, cash: true, hoursAgo: 4.2 },
  { courier: 1, restaurant: "Crepes Express", address: "Av. 6N #28-15, Granada", value: 58000, cash: false, hoursAgo: 3.6 },
  { courier: 2, restaurant: "Wok to Go", address: "Carrera 100 #11-60, Ciudad Jardín", value: 41000, cash: true, hoursAgo: 3.1 },
  { courier: 0, restaurant: "La Hamburguesería", address: "Calle 9 #4-50, San Antonio", value: 27000, cash: true, hoursAgo: 2.4 },
  { courier: 3, restaurant: "Pizza Nostra", address: "Calle 15N #6-30, Chipichape", value: 46000, cash: false, hoursAgo: 1.8 },
  { courier: 1, restaurant: "Donde Lucho", address: "Carrera 66 #9-35, El Limonar", value: 35000, cash: true, hoursAgo: 1.1 },
];

const EN_ROUTE = [
  { courier: 2, restaurant: "Crepes Express", address: "Calle 13 #100-35, Pance", value: 52000, cash: false, minutesAgo: 9 },
  { courier: 3, restaurant: "Wok to Go", address: "Carrera 38 #5B-12, Tequendama", value: 29000, cash: true, minutesAgo: 4 },
];

function code() {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let c = "";
  for (let i = 0; i < 5; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `D-${c}`;
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

export async function seedDemo() {
  await db.delete(schema.dispatchOffers);
  await db.delete(schema.assignments);
  await db.delete(schema.trips);
  // Los chats se quedan, pero sin un pedido a medio armar ni un asesor pendiente.
  await db.update(schema.conversations).set({ draft: null, failedAttempts: 0, botPaused: false, escalationReason: null });

  // Flota: se reutilizan los motorizados que ya existan (por teléfono).
  const existing = await db.select().from(schema.couriers);
  const ids: number[] = [];
  for (const c of COURIERS) {
    const found = existing.find((e) => e.phone === c.phone);
    const values = {
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      status: "available" as const,
      active: true,
      locationUpdatedAt: new Date(),
      lastAssignedAt: null,
      deliveriesThisShift: 0,
      shiftStartedAt: ago(5 * 60),
    };
    if (found) {
      await db.update(schema.couriers).set(values).where(eq(schema.couriers.id, found.id));
      ids.push(found.id);
    } else {
      const [row] = await db.insert(schema.couriers).values({ ...values, phone: c.phone }).returning();
      ids.push(row.id);
    }
  }
  // Cualquier otro motorizado creado en pruebas queda fuera de la flota.
  for (const e of existing) {
    if (!ids.includes(e.id)) await db.update(schema.couriers).set({ active: false }).where(eq(schema.couriers.id, e.id));
  }

  const delivered = new Map<number, number>();
  const lastAt = new Map<number, Date>();

  async function addTrip(t: { courier: number; restaurant: string; address: string; value: number; cash: boolean }, createdAt: Date, assignedAt: Date, deliveredAt: Date | null) {
    const courierId = ids[t.courier];
    const [trip] = await db
      .insert(schema.trips)
      .values({
        code: code(),
        status: deliveredAt ? "delivered" : "en_route",
        originRestaurantName: t.restaurant,
        deliveryAddress: t.address,
        customerPhone: `31${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        valueToCollect: t.value,
        paymentMethod: t.cash ? "efectivo" : "transferencia",
        requiresCashReturn: t.cash,
        createdAt,
        updatedAt: deliveredAt ?? assignedAt,
      })
      .returning();
    await db.insert(schema.assignments).values({
      tripId: trip.id,
      courierId,
      courierName: COURIERS[t.courier].name,
      assignedAt,
      dispatchedAt: assignedAt,
      deliveredAt,
    });
    delivered.set(courierId, (delivered.get(courierId) ?? 0) + 1);
    if (!lastAt.has(courierId) || lastAt.get(courierId)! < assignedAt) lastAt.set(courierId, assignedAt);
  }

  for (const t of DELIVERED) {
    const created = ago(t.hoursAgo * 60);
    await addTrip(t, created, new Date(created.getTime() + 40_000), new Date(created.getTime() + 24 * 60_000));
  }
  for (const t of EN_ROUTE) {
    const assigned = ago(t.minutesAgo);
    await addTrip(t, new Date(assigned.getTime() - 30_000), assigned, null);
  }

  // Contadores y turnos coherentes con el historial recién creado.
  for (const id of ids) {
    await db
      .update(schema.couriers)
      .set({ deliveriesThisShift: delivered.get(id) ?? 0, lastAssignedAt: lastAt.get(id) ?? null })
      .where(eq(schema.couriers.id, id));
  }
  for (const t of EN_ROUTE) {
    await db.update(schema.couriers).set({ status: "busy" }).where(eq(schema.couriers.id, ids[t.courier]));
  }

  console.log(`✓ Flota: ${ids.length} motorizados (${ids.length - EN_ROUTE.length} libres)`);
  console.log(`✓ Viajes: ${DELIVERED.length} entregados, ${EN_ROUTE.length} en ruta, 0 por asignar`);
}
