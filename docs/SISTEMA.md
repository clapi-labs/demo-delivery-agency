# Reporte: CLAPI Dispatch (demo Express Cali)

> Estado al 2026-10-11.

## 1. Qué es

Una central de despachos para una agencia de domicilios. Los restaurantes piden moto **escribiendo por WhatsApp en texto libre**. El sistema entiende el mensaje, calcula el valor del domicilio, asigna la moto y le avisa al motorizado por WhatsApp. El motorizado confirma la entrega con un botón, y la agencia ve todo en vivo en un portal web.

Nació como un fork de CLAPI, el sistema para restaurantes (`demo-delivery-system`). Reutiliza el canal de WhatsApp y el diseño, pero cambia la lógica central: en CLAPI un pedido nace del menú web y aquí nace de una conversación.

## 2. Piezas y dónde viven

| Pieza | Qué hace | Dónde |
|---|---|---|
| **Bot** (`apps/bot`) | Recibe los WhatsApp, entiende el pedido, asigna y envía todos los mensajes | Vercel, root `apps/bot` |
| **Portal** (`apps/portal`) | Tablero de la agencia: despachos, chats, flota, finanzas y tarifas | Vercel, root `apps/portal` |
| **Lógica compartida** (`packages/shared`) | Esquema de la base, cola de asignación, tarifas y prompt del bot | Usada por las dos apps |
| **Base de datos** | Postgres en Neon, propia de este proyecto, separada de la de restaurantes | Neon (plan gratis) |
| **WhatsApp** | Número dedicado a esta demo. Meta entrega directo al bot, sin intermediarios | Meta → `<bot>/api/webhook/whatsapp` |
| **IA** | `gpt-4o-mini` en una sola llamada por mensaje para extraer los datos | OpenAI (único costo, de centavos) |

Los dos proyectos de Vercel están conectados a GitHub (`clapi-labs/demo-clapi-dispatch`). Cada push a `main` redespliega solo. Cómo desplegarlos: [`DESPLIEGUE_VERCEL.md`](DESPLIEGUE_VERCEL.md).

**Regla de arquitectura:** solo el bot habla con Meta. Cuando el portal necesita enviar un WhatsApp (respuesta de un operador o aviso de asignación), se lo pide al bot por `/api/internal/*`, protegido con `INTERNAL_SECRET`.

## 3. El flujo de un pedido

```
Restaurante (WhatsApp)  →  Meta  →  Bot
   1. Verifica la firma de Meta, descarta duplicados, responde 200 al instante
   2. ¿El número es de un motorizado de la flota?  →  flujo del motorizado
   3. Si no, es un restaurante: la IA extrae los datos usando la memoria del chat
        ├─ incompleto  →  guarda lo entendido y pregunta solo lo que falta
        ├─ confuso o 2 mensajes sin datos nuevos  →  "Te transferiré con un asesor…"
        │                                            y el bot se calla en ese chat
        └─ completo  →  reconoce las zonas → precio de la tabla → crea el viaje
                     →  asigna la siguiente moto de la cola
                     →  al motorizado: ficha + botón "✅ Confirmar entrega"
                     →  al restaurante: "Moto asignada. Entre 10 a 15 minutos
                        llega el domiciliario a recoger."

Motorizado toca el botón  →  viaje "Entregado", la moto vuelve al final de la cola
                          →  si había pedidos esperando, toma el siguiente
                          →  aviso al restaurante: "Pedido entregado ✅"
```

**Los cinco datos obligatorios:** dónde se recoge, dirección de entrega, teléfono del cliente, valor a cobrar y efectivo/transferencia. El barrio (la zona) **no es obligatorio**. Si no se reconoce, se cobra la tarifa por defecto ($7.000).

## 4. Lógica clave

- **Memoria del pedido:** cada chat guarda un borrador (`conversations.draft`), así un dato suelto ("3104567890") completa el pedido en vez de reiniciarlo. El código garantiza que un dato ya capturado nunca se borre, aunque el modelo lo omita.
- **Asignación (cola round-robin):** el viaje va al motorizado libre que lleva más tiempo sin recibir uno (`couriers.last_assigned_at`). Las reservas son atómicas, así que el bot y el portal no pueden dar la misma moto dos veces. Código: `packages/shared/src/db/dispatch-queue.ts`.
- **Tarifas:** el modelo elige el barrio de cada dirección de la lista de zonas, con un respaldo por palabras clave. El precio sale de la matriz origen × destino y queda guardado en el viaje (`trips.delivery_fee`): si cambias la tabla mañana, el arqueo de hoy no cambia. Código: `packages/shared/src/db/fares.ts`.
- **Motorizado = solo WhatsApp.** No tiene app. El bot lo reconoce por su número (últimos 10 dígitos): si escribe algo, le reenvía su viaje actual o le confirma que está conectado. Su botón de entrega funciona aunque su chat esté pausado.

## 5. El portal (pensado primero para celular)

| Pestaña | Contenido |
|---|---|
| **Despachos** | Kanban *Por asignar → En ruta → Entregados* (pestañas en celular). Cronómetro en vivo desde la asignación, domicilio y zonas en cada tarjeta, alerta sonora y aviso visual al asignar. Botón "Entregado" de respaldo |
| **Chats** | Conversaciones en vivo, el panel "el bot está armando el pedido 3/5", botón **Intervenir** (silencia el bot y abre la caja de respuesta) y **Devolver al bot** |
| **Flota** | Motorizados con estado, turno en la cola, pausar, desconectar y quitar |
| **Finanzas** | Ganancia neta (suma de domicilios), efectivo contra transferencia, y por moto: viajes, ganancia y efectivo a entregar en base |
| **Tarifas** | Matriz editable de 5 zonas del sur de Cali, tarifa por defecto y palabras clave de cada zona |

Marca: el cascarón es Clapi (morado y amarillo) y el color del cliente se configura con `NEXT_PUBLIC_CLIENT_NAME`, `NEXT_PUBLIC_CLIENT_INITIALS` y `NEXT_PUBLIC_CLIENT_COLOR`, sin tocar código (`apps/portal/src/lib/brand.ts`).

## 6. Variables de entorno

| Proyecto | Variables |
|---|---|
| Bot | `DATABASE_URL`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `OPENAI_API_KEY`, `INTERNAL_SECRET`, `BOT_ACTIVE` |
| Portal | `DATABASE_URL`, `BOT_URL`, `INTERNAL_SECRET` (el mismo del bot), opcionales `NEXT_PUBLIC_CLIENT_*` |

## 7. Cómo operarlo

| Para… | Hacer |
|---|---|
| Conectar el número a otro despliegue | Cambiar la Callback URL en Meta (WhatsApp → Configuración → Webhooks). Pasos en [`DESPLIEGUE_VERCEL.md`](DESPLIEGUE_VERCEL.md) |
| Silenciar el bot sin desconectarlo | `BOT_ACTIVE=false` en el bot y redeploy: sigue recibiendo, pero no envía nada |
| Dejar datos de demo | `npm run db:seed:demo`: respeta la flota real y los chats; con la flota vacía crea 6 motorizados de ejemplo |
| Cambiar el esquema | `npm run db:push` |
| Cambiar de cliente | Variables `NEXT_PUBLIC_CLIENT_*` en el portal y redeploy |

Las variables de entorno y su manejo con Infisical están en [`ENV.md`](ENV.md).

**Requisito de Meta que no se puede saltar:** solo se le puede escribir a quien escribió al número en las últimas 24 h. Por eso cada motorizado debe mandar "hola" antes de recibir viajes.

## 8. Limitaciones conocidas

- **La asignación es por cola, no por GPS.** El motor multi-factor (distancia, equidad, hora pico) está escrito en `packages/shared/src/domain/dispatch/`, pero no está conectado: no hay ubicación real de las motos.
- **No hay oferta con tiempo para aceptar:** la moto se asigna directo, sin la ventana de 15 segundos.
- **El portal no tiene login.** Cualquiera con la URL lo ve y lo opera.
- **El portal se actualiza por sondeo** cada 2-3 segundos, no por WebSockets. Alcanza para esta escala.
- **Las zonas dependen de que el restaurante nombre el barrio.** No hay geocodificación.
- **No hay cron del servidor:** los pendientes se reintentan mientras alguien tiene el portal abierto, o cuando una moto entrega.
- **No hay respaldo:** Meta entrega directo al bot. Si el bot se cae, el número queda sin respuesta.
