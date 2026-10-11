# Variables de entorno: Infisical, local y Vercel

Infisical es la fuente de verdad. De ahí salen los `.env.local` de cada persona y las variables de Vercel. Nadie se pasa secretos por chat.

## 1. Qué variables existen

| Variable | Bot | Portal | Notas |
|---|---|---|---|
| `DATABASE_URL` | sí | sí | Neon. La misma en las dos apps y en la raíz (para `db:push` y `db:seed:demo`) |
| `INTERNAL_SECRET` | sí | sí | **Tiene que ser idéntica** en bot y portal; si no, el portal no puede enviar WhatsApp (`bad_secret`) |
| `WHATSAPP_PHONE_NUMBER_ID` | sí | | Panel de Meta |
| `WHATSAPP_ACCESS_TOKEN` | sí | | Panel de Meta |
| `WHATSAPP_APP_SECRET` | sí | | Firma de los webhooks |
| `WHATSAPP_VERIFY_TOKEN` | sí | | Cadena propia, igual a la configurada en Meta |
| `OPENAI_API_KEY` | sí | | |
| `BOT_ACTIVE` | sí | | `true` en producción, `false` en local. Con `false` el bot recibe pero no envía |
| `BOT_URL` | | sí | URL del bot, sin `/` al final |
| `NEXT_PUBLIC_CLIENT_NAME` | | opcional | Nombre del cliente en el portal |
| `NEXT_PUBLIC_CLIENT_INITIALS` | | opcional | |
| `NEXT_PUBLIC_CLIENT_COLOR` | | opcional | Hex, por defecto `#E11D48` |

No se suben: `WHATSAPP_API_VERSION` y `OPENAI_CHAT_MODEL` (tienen valor por defecto en el código) ni `VERCEL_OIDC_TOKEN` (lo genera la CLI de Vercel en cada máquina).

## 2. Cómo está organizado en Infisical

Proyecto `demo-clapi-dispatch`, con un solo entorno (`prod`) y tres carpetas:

```
/shared   DATABASE_URL, INTERNAL_SECRET
/bot      WHATSAPP_* (4), OPENAI_API_KEY, BOT_ACTIVE      + importa /shared
/portal   BOT_URL, NEXT_PUBLIC_CLIENT_* (3)               + importa /shared
```

`/shared` existe para que `DATABASE_URL` e `INTERNAL_SECRET` estén escritas una sola vez. En `/bot` y `/portal` hay un *Secret Import* de `/shared` (**Add New → Add Import**), y así cada carpeta entrega el juego completo de su app.

No hay entorno `dev` porque hay una sola base de datos y un solo número de WhatsApp. Ojo con eso: **trabajar en local es trabajar sobre la base de la demo.** Los dos únicos valores que cambian en local (`BOT_ACTIVE` y `BOT_URL`) se ajustan al bajar los secretos, como muestra la sección 4.

## 3. Subirlas la primera vez

Lo hace una sola persona, la que ya tiene los `.env.local` llenos. Con el entorno **Production** seleccionado, en cada carpeta: **Upload Secrets** y elegir el archivo con las variables de esa carpeta. Después, en `bot` y en `portal`: **Add New → Add Import** → carpeta `/shared`.

Los valores de Infisical deben coincidir con los de Vercel.

## 4. Cómo los obtiene cada persona del equipo

Una vez por máquina:

```bash
# instalar la CLI: https://infisical.com/docs/cli/overview
infisical login
infisical init        # en la raíz del repo; elegir el proyecto demo-clapi-dispatch
```

`infisical init` crea `.infisical.json`, que solo guarda el id del proyecto. Se puede commitear para que el resto no tenga que elegirlo.

Para bajar los tres archivos que el repo espera:

```bash
infisical export --env=prod --path=/shared > .env.local
infisical export --env=prod --path=/bot \
  | sed -E "s|^BOT_ACTIVE=.*|BOT_ACTIVE=false|" > apps/bot/.env.local
infisical export --env=prod --path=/portal \
  | sed -E "s|^BOT_URL=.*|BOT_URL=http://localhost:3001|" > apps/portal/.env.local
```

Los dos `sed` no son opcionales: sin el primero, el bot local arranca con el `BOT_ACTIVE` de producción y puede enviar WhatsApp reales; sin el segundo, el portal local le habla al bot desplegado.

Después todo corre como siempre: `npm run dev:bot`, `npm run dev:portal`, `npm run db:push`, `npm run db:seed:demo`. Los `.env.local` ya están en `.gitignore`. Cuando alguien cambie un secreto en Infisical, se vuelven a correr los tres comandos.

## 5. Qué va en Vercel

| Proyecto de Vercel | Carpeta de Infisical (`prod`) | Variables |
|---|---|---|
| Bot (root `apps/bot`) | `/bot` | `DATABASE_URL`, `INTERNAL_SECRET`, las 4 `WHATSAPP_*`, `OPENAI_API_KEY`, `BOT_ACTIVE` |
| Portal (root `apps/portal`) | `/portal` | `DATABASE_URL`, `INTERNAL_SECRET`, `BOT_URL`, `NEXT_PUBLIC_CLIENT_*` |

Hay dos formas de mantenerlas:

- **Sincronización automática (recomendada).** En Infisical: **Integrations → Secret Syncs → Vercel**. Se crea una por proyecto: origen `prod` + carpeta, destino el proyecto de Vercel en *Production*, con los imports incluidos. Desde ahí, cambiar un secreto en Infisical lo cambia en Vercel.
- **A mano.** Copiar los valores de `prod` en *Settings → Environment Variables* de cada proyecto.

El paso a paso del despliegue está en [`DESPLIEGUE_VERCEL.md`](DESPLIEGUE_VERCEL.md).

En los dos casos, **Vercel solo toma el valor nuevo en el siguiente deploy**: después de cambiar una variable hay que hacer *Redeploy*. Con las `NEXT_PUBLIC_*` es obligatorio, porque quedan grabadas en el build.

### `BOT_ACTIVE` con sincronización

Si la sincronización está activa, `BOT_ACTIVE` se cambia **en Infisical**, no en Vercel: un cambio hecho directo en Vercel se pisa en la siguiente sincronización.

## 6. Reglas

- `BOT_ACTIVE=false` en local, sin excepción. Un bot local con `true` envía WhatsApp reales desde el número de la demo.
- `WHATSAPP_VERIFY_TOKEN` tiene que ser igual al configurado en Meta. Si se cambia en un lado, se cambia en el otro.
- Si se cambia `INTERNAL_SECRET`, hay que redesplegar bot y portal juntos.
- Variable nueva en el código: se agrega en Infisical, en el `.env.example` de la app y en la tabla de este documento.
