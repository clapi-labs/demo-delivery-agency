import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * Mismo patrón que CLAPI (`demo-delivery-system/packages/shared/src/db/client.ts`):
 * Neon por HTTP en producción (sin conexión persistente, así una función
 * serverless que arranca y muere no agota un pool), `pg` por TCP contra un
 * Postgres local en desarrollo. El driver se elige por la forma de la
 * cadena, no por `NODE_ENV`.
 *
 * La conexión se construye en el primer uso, no al importar: Next.js
 * recolecta metadatos de cada ruta durante el build y ejecuta este módulo
 * sin que exista `DATABASE_URL` en ese entorno.
 */

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | null = null;

function getDb(): Database {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL. Copia .env.example a .env.local y llénala.");
  }

  const isNeon = url.includes("neon.tech");
  instance = (
    isNeon ? drizzleNeon(neon(url), { schema }) : drizzlePg(new Pool({ connectionString: url }), { schema })
  ) as Database;

  return instance;
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
