# PLAN_REFACTOR — De CLAPI (B2C) a CLAPI Dispatch (B2B logística)

> Punto de partida: el código real en `~/code/demo-delivery-system` (monorepo
> npm workspaces, Next.js, Drizzle + Neon, WhatsApp Cloud API, OpenAI). Este
> documento es el resultado de revisarlo, no una suposición sobre su forma.

## 0. Lo que hay que decir primero

CLAPI no es solo "un sistema de pedidos con menú" que hay que vaciar de
catálogo. Su `docs/SPEC.md` tiene una sección completa, **"Qué NO hace, a
propósito"**, y dos de esas renuncias son exactamente lo que este MVP necesita
construir:

| CLAPI decidió NO hacer | Por qué (su razón, en su SPEC) | CLAPI Dispatch lo necesita porque |
|---|---|---|
| Asignación automática por cercanía | "Exigiría geocodificar direcciones colombianas escritas a mano; es un problema más grande que el que resuelve" | Es el corazón del producto (§3 del prompt maestro) |
| Rastreo en vivo de la moto | "Exige la pantalla abierta gastando datos y batería, y no cambia nada de lo que el restaurante decide" | El score necesita la posición real para el filtro Haversine y el ETA |
| Domiciliarios que se autoasignan (ADR-12) | "El cajero asigna; el domiciliario solo marca la entrega" | El motor asigna solo; el cajero deja de estar en el camino |
| Que un pedido nazca de una conversación (ADR-02) | "Un pedido no puede nacer de una conversación" — es la regla central del producto | Un viaje **solo** puede nacer de un mensaje de WhatsApp — no hay menú que lo preceda |

No es una crítica al diseño original — esas decisiones eran correctas para un
restaurante que vende por catálogo. El punto es que **esto no es un recorte de
CLAPI, es una inversión de sus dos decisiones de arquitectura más fuertes**
(ADR-02 y ADR-12). Conviene decírselo así al cliente: se reutiliza la
*infraestructura* (canal de WhatsApp, modelo de datos de logística, portal,
pantalla del repartidor) pero el *candado* central cambia de sentido.

Lo que sí se hereda casi intacto —y es la mitad del trabajo ya hecha— es
exactamente el módulo que CLAPI construyó en su Fase 7 (`rama domicilios`):
`couriers`, el token firmado sin contraseña, la ficha de WhatsApp, y
`/repartidor`. Dispatch nace de esa fase, no del menú.

---

## 1. Plan de refactorización

### 1.1 Eliminar

| Pieza en CLAPI | Por qué sale |
|---|---|
| `apps/menu` completo | No hay catálogo que mostrar ni carrito que armar |
| Tablas `categories`, `products`, `option_groups`, `options`, `promotions` | No hay productos |
| Tabla `order_items` | Un viaje no tiene líneas, tiene un valor a cobrar |
| `packages/shared/src/domain/catalog.ts`, `order-lines.ts`, `promotions.ts` | Resuelven precios de catálogo; no hay catálogo |
| `apps/bot/src/bot/menu-link.ts`, `order-guard.ts` | El candado "un pedido nace del menú" (ADR-02) se invierte: ver §0 |
| `apps/bot/src/bot/advisor.ts` + tool calling de `lookup_promotions`/`recommend_products` | No hay nada que recomendar |
| Tablas `vouchers`, `voucher_references` y `bot/voucher.ts` | Leer comprobantes de transferencia es una Fase 5 de CLAPI que este MVP no necesita todavía — `efectivo` vs `transferencia` basta como dato declarado por el restaurante |
| `BUSINESS.address` como dirección única del negocio (`config/business-info.ts`) | Ahora hay múltiples restaurantes con múltiples direcciones de recogida — ver `restaurants.knownPickupAddress` |
| Seeds y assets del catálogo (`db/seed-data.ts`, fotos de comida) | No aplica |

### 1.2 Modificar

| Pieza en CLAPI | Qué cambia | Dónde queda ahora |
|---|---|---|
| `conversations` / `messages` | Se quedan casi iguales — el canal de WhatsApp es el mismo problema sin importar qué hay del otro lado. `phone` pasa a ser el número del **restaurante**, no del cliente final (el cliente final es un dato *dentro* del viaje, no un hilo propio) | `packages/shared/src/db/schema.ts` (ya escrito) |
| `orders` (schema) | Se convierte en `trips`: fuera los campos de catálogo (`subtotal`, `deliveryFee` de menú), dentro `pickupAddress/Location`, `deliveryAddress/Location`, `customerPhone`, `valueToCollect`, `paymentMethod`, `requiresCashReturn` | `trips` en `schema.ts` |
| `order-status.ts` (4 estados: nuevo/preparación/enviado/entregado) | 5 estados: `pending → assigned → en_route → delivered` (+ `cancelled`). Se agrega `assigned` como estado intermedio porque la oferta de 15 s necesita un punto "ya se le ofreció a alguien, todavía no salió" que CLAPI no necesitaba | `TripStatus` en `schema.ts` |
| `couriers` | Se agregan `lat`, `lng`, `locationUpdatedAt`, `status` (`available/busy/paused/offline`), `deliveriesThisShift`, `shiftStartedAt`. El campo `kind` (propio/agencia) de CLAPI puede quedarse para cuando el cliente quiera sumar flotas externas, pero el CRUD del MVP (§B del prompt maestro) solo pide domiciliarios propios | `couriers` en `schema.ts` |
| `deliveries` | Pasa a ser `assignments` (la asignación vigente, una fila por viaje — mismo patrón de CLAPI) **más** `dispatch_offers` (nueva, el historial de cada intento de 15 s — CLAPI no la necesitaba porque ahí la asignación era manual y de un solo intento) | `assignments` + `dispatch_offers` en `schema.ts` |
| `domain/courier-token.ts`, `domain/signed-token.ts` | Sin cambios de fondo — es exactamente el mecanismo que necesita "el domiciliario ve su pedido sin usuario ni contraseña" (§C del prompt maestro) | Se copian tal cual |
| `domain/delivery.ts` (`dispatchTicket`, `mapsLink`, `whatsappLink`) | Se adapta el texto de la ficha (ya no hay "recoger en la dirección del negocio" fija — ahora cada viaje tiene su propio `pickupAddress`, el del restaurante que escribió) y se agrega un enlace a Waze además de Google Maps | `domain/delivery.ts` (pendiente de copiar/adaptar) |
| `/repartidor` (ruta + `DriverBoard.tsx`) | Se mantiene fuera del `AppShell` del portal, igual que en CLAPI (es el celular de otra persona). Se agregan: botón de aceptar/rechazar la oferta con cuenta regresiva de 15 s, y el reporte de ubicación (`watchPosition`) — ver §3 | `apps/rider` (nueva app o ruta separada) |
| `components/orders/OrdersBoard.tsx`, `OrderTicket.tsx` | El Kanban de tres columnas se reutiliza casi 1:1 para Pendiente/En Ruta/Entregado. `DispatchSheet.tsx` (la hoja de asignación manual) se conserva como **vía de escape**: si el motor se agota (`DispatchResult.exhausted`), el cajero asigna a mano con la misma pantalla que ya existe | `apps/portal` |
| `components/logistics/CouriersView.tsx` | El CRUD de domiciliarios ya existe casi completo (alta, pausa) — se le agregan los campos nuevos de ubicación/estado | `apps/portal` |
| `components/dashboard/Dashboard.tsx` | Mismo layout, métricas nuevas: viajes del día, ingresos, motos activas ahora, tiempo promedio de asignación | `apps/portal` |
| `bot/orchestrator.ts`, `engine.ts`, `intent.ts` | Se reemplaza la máquina de estados de 11 puertas por un flujo de 2 pasos: extraer con el modelo → si falta algo, repreguntar una vez; si está completo, crear el viaje y disparar el despacho. Se conserva el patrón de "degradación con gracia" (si el modelo falla, un texto fijo pidiendo que reescriba) | `apps/bot/src/bot/intake.ts` (nuevo, reemplaza a los tres) |
| `services/openai/chat.ts` (tool calling) | Se simplifica a una sola llamada con salida JSON estructurada (el prompt ya está en `domain/extraction.ts`) | `apps/bot/src/services/openai/extract.ts` |

### 1.3 Crear desde cero

- `packages/shared/src/domain/dispatch/*` — el motor de asignación. **Ya escrito** en este repo: `types.ts`, `haversine.ts`, `eta.ts`, `h3-key.ts`, `score.ts`, `pipeline.ts`, `offer.ts`.
- `packages/shared/src/domain/extraction.ts` — el contrato de extracción y el prompt del bot. **Ya escrito.**
- `packages/shared/src/db/schema.ts` — `restaurants`, `trips`, `couriers` (con ubicación), `assignments`, `dispatch_offers`. **Ya escrito.**
- Adaptadores reales de los puertos del pipeline (`EtaCache`, `MapsClient`) — hoy solo existe la referencia en memoria (`createInMemoryEtaCache`). Falta: adaptador de Upstash Redis y cliente de Google Distance Matrix API.
- `apps/bot` — webhook de Meta (se reutiliza casi literal la verificación de firma e idempotencia de CLAPI), `bot/intake.ts`, `POST /api/internal/trips`.
- `apps/portal` — Kanban de viajes, Flota (CRUD + mapa en vivo), Métricas, hoja de asignación manual de respaldo.
- `apps/rider` (o una ruta pública sin `AppShell` dentro del portal, como hace hoy `/repartidor`) — ver viaje asignado, aceptar/rechazar con cuenta regresiva, botón Waze/Maps, botón "Entregado", reporte de ubicación en segundo plano.
- `POST /api/internal/dispatch/:tripId` — corre `rankCandidates()` y crea la primera fila en `dispatch_offers`.
- `POST /api/couriers/:id/respond` — accept/reject de una oferta.
- `POST /api/couriers/:id/location` — ingesta de ubicación.
- Barrido de ofertas vencidas (ver §3 — **no** un cron de Vercel de intervalo largo).

---

## 2. El motor de asignación — ya escrito en `packages/shared/src/domain/dispatch/`

```
packages/shared/src/domain/
├── dispatch/
│   ├── types.ts      GeoPoint, CourierCandidate, TripRequest, ScoredCandidate,
│   │                 ScoreWeights (peak/valley), DispatchResult
│   ├── haversine.ts  haversineKm(), filterByRadius() — paso 1
│   ├── eta.ts        EtaCache / MapsClient (puertos) + referencia en memoria — paso 2
│   ├── h3-key.ts      clave de caché por par de celdas H3 (h3-js)
│   ├── score.ts      resolveOperatingMode(), timeFactor(), routeFactor(),
│   │                 equityFactor(), computeScore() — la fórmula
│   ├── pipeline.ts   rankCandidates() — encadena los 3 pasos, llama a Maps
│   │                 solo para el Top 3 que no tuvo cache hit — paso 3
│   └── offer.ts      nextCandidate(), isOfferExpired(), summarizeDispatch()
│                     — la secuencia de ofertas de 15 s
└── extraction.ts     contrato + prompt de extracción del mensaje del restaurante
```

Todo el pipeline es **puro**: recibe candidatos ya cargados y puertos
inyectados (`EtaCache`, `MapsClient`), nunca toca la red ni la base
directamente. Eso es lo que lo hace testeable sin credenciales y lo que
permite cambiar Redis o el proveedor de mapas sin tocar la fórmula del score.

**Decisión que falta confirmar con el negocio:** la fórmula solo fija $W_1$
(tiempo) y $W_3$ (equidad) por modo. $W_2$ (ruta) se asumió como residuo
(`0.10` en pico, `0.20` en valle, en `types.ts: SCORE_WEIGHTS`) — hay que
reemplazarlo si el negocio tiene una cifra propia.

**Lo que `routeFactor()` hace hoy es un placeholder honesto**, documentado en
el código: sin `heading` (rumbo) confiable del GPS todavía, aproxima "qué tan
buena está la ruta" con la misma distancia Haversine. Cuando se tenga rumbo
real de varias lecturas consecutivas de ubicación, se reemplaza esa función
—no el pipeline— por la alineación entre el rumbo y el vector hacia el
pickup.

### El flujo de una oferta, controladores por crear

```
POST /api/internal/trips           (bot → crea el viaje, llama a dispatch)
  └─ POST /api/internal/dispatch/:tripId
       1. carga couriers con status="available"
       2. rankCandidates(trip, couriers, resolveOperatingMode(hour), ports)
       3. toma el primero → INSERT dispatch_offers (rank=1, expiresAt=+15s)
       4. push al motorizado (ver §3) "tienes una oferta, 15 s"

POST /api/couriers/:id/respond     (rider app)
  { offerId, response: "accept" | "reject" }
  - accept → INSERT assignments, trips.status="assigned",
             notifica al restaurante por WhatsApp (reusa sendText de CLAPI)
  - reject → dispatch_offers.outcome="rejected", ofertar al siguiente
             (nextCandidate() con los ya intentados)

(barrido de vencidos, ver §3)       → mismo camino que "reject" pero
                                      outcome="expired"

Si nextCandidate() devuelve null (se agotó el Top 3):
  trips queda en "pending" sin oferta activa → el portal lo marca
  "sin moto disponible" y abre la hoja de asignación manual (DispatchSheet,
  reutilizada de CLAPI) como vía de escape.
```

---

## 3. Ubicación en tiempo real — recomendación de arquitectura

### Qué transporte usar para qué

| Necesidad | Latencia que tolera | Transporte recomendado |
|---|---|---|
| El motorizado sube su posición | Alta (10–15 s está bien) | **HTTP POST simple**, no WebSocket. `watchPosition` del navegador, con throttle: solo si se movió >50 m o pasaron 15 s, lo que ocurra primero; si está `paused`/`offline`, baja a un ping cada 60 s solo para mantener viva la señal de conexión |
| El motorizado recibe la oferta de 15 s | Baja — si el push tarda 5 s en llegar, ya se comió un tercio de la ventana | **Push en tiempo real** (WebSocket o un proveedor administrado) |
| El portal ve el Kanban y el mapa actualizarse | Baja-media (1–2 s se siente "en vivo") | Mismo canal de push que arriba |

**Por qué no todo por WebSocket:** la ubicación entra con mucha frecuencia y
tolera demora; meterla por el mismo socket que las ofertas compite por el
mismo canal justo cuando más importa la latencia de la oferta. Mantenerlas
separadas es más simple de operar, no solo más "correcto".

### Dónde guardar la posición

**Para el MVP, columnas `lat`/`lng` en `couriers` (Postgres), no Redis GEO.**
Con una flota de decenas de motos, filtrar por Haversine en memoria —que es
literalmente lo que `filterByRadius()` ya hace— es más simple que operar
Redis y no tiene ningún costo de latencia perceptible. Redis GEO
(`GEOADD`/`GEOSEARCH`) se justifica cuando la flota crece lo suficiente para
que un `SELECT` sobre `couriers` deje de ser instantáneo — es una migración
de una función (`filterByRadius`), no del modelo de datos completo. No lo
construya antes de necesitarlo.

**La caché de ETA sí es Redis desde el día uuno** (Upstash, por el mismo
motivo que CLAPI ya eligió Neon: serverless, sin servidor propio que
mantener) — esa es una caché de verdad con TTL, no una tabla.

### El problema real: el SLA de 15 segundos no se sostiene con un cron de Vercel

Vercel Cron no ofrece "corre cada 3 segundos" ni garantiza despertar a los 15
segundos exactos de un evento — su resolución mínima son minutos. Si el
barrido de ofertas vencidas depende de un cron así, el "siguiente candidato"
puede tardar minutos en recibir la oferta, no segundos — el SLA de la
fórmula se rompe antes de que el algoritmo importe.

Dos formas de resolverlo, sin montar un servidor propio solo para esto:

1. **Mensaje programado (recomendada):** al crear cada fila de
   `dispatch_offers`, programar un mensaje con **QStash** (Upstash) para que
   llegue exactamente a los 15 s y llame a
   `POST /api/internal/dispatch-sweep/:offerId`. Nada queda "esperando":
   es un webhook más, igual de serverless-friendly que el resto del stack.
   Precisión real de segundos, sin un proceso corriendo entre medio.
2. **Alternativa más simple, menos precisa:** un proceso siempre-activo
   (un Fly.io/Railway de un solo contenedor Node, barato) que cada 2-3 s
   hace `SELECT ... WHERE expires_at < now() AND outcome IS NULL` sobre
   `dispatch_offers` y dispara el siguiente candidato. Más fácil de
   entender y depurar; cuesta tener *algo* corriendo 24/7 fuera de Vercel.

Para la demo inicial, (2) es más rápido de armar y de explicar en una
llamada con el cliente. Para producción, (1) es la elección correcta porque
no agrega una pieza de infraestructura nueva al stack serverless que CLAPI
ya tiene en Vercel + Neon.

### Push en tiempo real: proveedor administrado, no un socket propio

El stack hereda tres despliegues Vercel independientes (bot/portal/rider), y
Vercel no sostiene WebSockets de larga duración en su runtime serverless.
Montar un servidor `ws`/socket.io propio significa un cuarto servicio
siempre-activo solo para esto. Para el tamaño de este MVP, un proveedor
administrado (**Pusher Channels**, **Ably** o **Supabase Realtime**) da los
canales de "oferta nueva" (por motorizado) y "viaje actualizado" (por
restaurante/portal) sin infraestructura propia, con un costo que a esta
escala es marginal. Si más adelante el cliente ya tiene un VM o un
Fly.io corriendo por otra razón, autohospedar deja de ser una mala idea —
pero no es necesario para arrancar.

---

## 4. Próximos pasos, en orden

1. **Confirmar con el negocio** el valor de $W_2$ y si `routeFactor()` como
   proxy de Haversine es aceptable para el arranque (§2).
2. Copiar y adaptar de CLAPI (no reescribir desde cero): verificación de
   firma del webhook, idempotencia (`processed_messages`), `signed-token.ts`,
   `courier-token.ts`, `/repartidor` → `/motorizado`, `DispatchSheet.tsx`
   como vía de escape manual.
3. Implementar `apps/bot/src/bot/intake.ts` (extracción + repregunta) sobre
   `domain/extraction.ts`, ya escrito.
4. Implementar los adaptadores reales de `EtaCache` (Upstash) y `MapsClient`
   (Google Distance Matrix) — los puertos ya están definidos en `eta.ts`.
5. `POST /api/internal/trips` y `POST /api/internal/dispatch/:tripId` sobre
   `rankCandidates()`, ya escrito.
6. Decidir entre QStash o un worker siempre-activo para el barrido de
   ofertas (§3) — bloquea que el flujo de 15 s funcione de punta a punta.
7. `apps/rider`: `watchPosition` + aceptar/rechazar + botón Waze/Maps +
   "Entregado" (este último ya existe como patrón en `/repartidor` de
   CLAPI).
8. `apps/portal`: Kanban (reusa `OrdersBoard`), Flota (reusa
   `CouriersView`), Métricas (reusa `Dashboard`).
