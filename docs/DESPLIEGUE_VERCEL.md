# Guía: desplegar CLAPI Dispatch en Vercel

Para quien despliega el sistema en una cuenta nueva de Vercel. Son dos proyectos del mismo repo: primero el **bot**, después el **portal**.

**Lo que hay que entregar al final:** la *Callback URL* del bot (paso 4). Con ella se conecta el número de WhatsApp en Meta; sin ella el número no le responde a nadie.

## Antes de empezar

Se necesita:

- Acceso al repo `clapi-labs/demo-delivery-agency` desde la cuenta de Vercel. Si el repo no aparece al importar, hay que darle acceso a la app de Vercel en GitHub (*Adjust GitHub App Permissions*).
- Acceso al proyecto `demo-clapi-dispatch` en Infisical, entorno **Production**. Todos los valores salen de ahí; no hay que inventar ninguno.

La base de datos (Neon) ya existe y ya tiene el esquema y los datos. No hay que crear ni migrar nada.

## 1. Desplegar el bot

En Vercel: **Add New → Project** e importar `clapi-labs/demo-delivery-agency`.

| Ajuste | Valor |
|---|---|
| Project Name | el que se quiera, por ejemplo `clapi-dispatch-bot` |
| Framework Preset | Next.js |
| **Root Directory** | `apps/bot` |
| Build, Output e Install | dejar los valores por defecto |

El Root Directory es lo único que no puede quedar por defecto: sin él, el build falla buscando una carpeta `public`.

En **Environment Variables**, antes de desplegar, cargar estas ocho. Los valores están en Infisical, carpeta `bot` (que ya incluye las dos de `shared`):

| Variable | Notas |
|---|---|
| `DATABASE_URL` | |
| `INTERNAL_SECRET` | |
| `WHATSAPP_PHONE_NUMBER_ID` | |
| `WHATSAPP_ACCESS_TOKEN` | |
| `WHATSAPP_APP_SECRET` | |
| `WHATSAPP_VERIFY_TOKEN` | Tiene que ser exactamente el de Infisical: es el mismo que se escribe en Meta |
| `OPENAI_API_KEY` | |
| `BOT_ACTIVE` | `true`. Con `false` el bot recibe los mensajes pero no responde |

Para no copiar una por una: en Infisical, dentro de la carpeta `bot`, el botón de descarga exporta un `.env`, y en Vercel se puede pegar el contenido completo en el primer campo de Environment Variables.

Dar **Deploy** y anotar la URL de producción que asigna Vercel, por ejemplo `https://clapi-dispatch-bot.vercel.app`. En adelante es `<URL_BOT>`.

## 2. Verificar el bot

Reemplazar `<URL_BOT>` y correr las tres pruebas:

```bash
# 1. Variables completas y bot encendido.
#    Debe responder: {"ok":true,"missing":[],"botActive":true}
curl -s <URL_BOT>/api/health

# 2. Verificación de Meta. Con el WHATSAPP_VERIFY_TOKEN real debe responder: PRUEBA
curl -s "<URL_BOT>/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=PRUEBA"

# 3. Un POST sin firma debe ser rechazado. Debe responder: 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST -d '{}' <URL_BOT>/api/webhook/whatsapp
```

Si algo no da lo esperado:

| Síntoma | Causa |
|---|---|
| `missing` trae nombres de variables | Faltan esas variables en Vercel. Agregarlas y hacer **Redeploy** |
| `"botActive":false` | `BOT_ACTIVE` no está en `true`. Corregir y **Redeploy** |
| La prueba 2 responde 403 | El `WHATSAPP_VERIFY_TOKEN` de Vercel no es el de Infisical |
| Cualquier URL pide iniciar sesión en Vercel | **Settings → Deployment Protection → Vercel Authentication**: desactivarla. Meta tiene que poder entrar sin login |

Vercel solo toma una variable nueva en el siguiente deploy: después de cambiar cualquiera, **Deployments → Redeploy**.

## 3. Desplegar el portal

Otra vez **Add New → Project**, con el mismo repo.

| Ajuste | Valor |
|---|---|
| Project Name | por ejemplo `clapi-dispatch-portal` |
| Framework Preset | Next.js |
| **Root Directory** | `apps/portal` |

Variables (Infisical, carpeta `portal`):

| Variable | Notas |
|---|---|
| `DATABASE_URL` | La misma del bot |
| `INTERNAL_SECRET` | **Idéntica** a la del bot. Si difieren, el portal no puede enviar WhatsApp |
| `BOT_URL` | `<URL_BOT>`, la del paso 1, sin `/` al final. **No usar el valor que haya en Infisical**: es la URL del despliegue anterior. Actualizarlo también en Infisical |
| `NEXT_PUBLIC_CLIENT_NAME`, `NEXT_PUBLIC_CLIENT_INITIALS`, `NEXT_PUBLIC_CLIENT_COLOR` | Opcionales. Solo si están en Infisical |

Dar **Deploy** y anotar la URL: es `<URL_PORTAL>`.

Para verificarlo, abrir `<URL_PORTAL>` en el navegador:

- **Tarifas** debe mostrar la matriz de 5 zonas con precios. Si carga, la base de datos está conectada.
- **Flota** debe listar los motorizados registrados.

La conexión portal → bot se prueba al final, con el número ya conectado (paso 5).

## 4. Entregar la Callback URL

Enviarle a quien administra Meta estos dos datos:

```
Callback URL:  <URL_BOT>/api/webhook/whatsapp
Portal:        <URL_PORTAL>
```

La Callback URL lleva la ruta completa, `/api/webhook/whatsapp`. Con solo el dominio, Meta no verifica.

Hasta aquí llega el despliegue. El resto lo hace quien administra Meta.

## 5. Conectar el número (lo hace quien administra Meta)

1. **Meta for Developers → la app → WhatsApp → Configuración → Webhooks → Editar.**
2. Callback URL: la del paso 4. Verify token: el `WHATSAPP_VERIFY_TOKEN` de Infisical.
3. **Verify and save.** Si Meta lo rechaza, repetir la prueba 2 del paso 2.
4. En **Campos de webhook**, confirmar que `messages` está suscrito. Sin eso la URL se guarda sin error, pero no llega ningún mensaje.

Prueba final, entre los dos:

1. Escribir "Hola" al número desde un WhatsApp cualquiera. El bot debe responder en segundos con la plantilla del pedido.
2. En el portal, pestaña **Chats**: debe aparecer esa conversación.
3. En ese chat: **Intervenir**, escribir una respuesta y enviarla. Debe llegar al WhatsApp. Eso confirma que `BOT_URL` e `INTERNAL_SECRET` quedaron bien.

Si el bot no responde, revisar en este orden: que `messages` esté suscrito, los logs de la función en Vercel (**Logs** del proyecto del bot) y que `WHATSAPP_APP_SECRET` sea el correcto (si no lo es, el bot rechaza todo con 403).

## 6. Cierre

Solo cuando la prueba final funcione:

- Borrar los proyectos del despliegue anterior en Vercel (`demo-delivery-agency` y `demo-delivery-agency-portal`, team `carlos-ramirez`). Mientras existan, siguen desplegando con cada push y siguen teniendo las credenciales del número.
- Confirmar que en Infisical quedaron `BOT_URL` con la URL nueva y `BOT_ACTIVE=true`.

Cada push a `main` redespliega los dos proyectos nuevos automáticamente.
