"use client";

import { useEffect } from "react";

/**
 * Corre `fn` ya y luego cada `ms`, mientras el componente esté montado.
 * La primera corrida va en un `setTimeout(0)` y no directa en el efecto: así
 * el `setState` que hace `fn` al volver del servidor nunca ocurre dentro del
 * render del efecto (regla de React, y evita renders en cascada).
 */
export function usePolling(fn: () => unknown, ms: number, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(fn, 0);
    const id = setInterval(fn, ms);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [fn, ms, enabled]);
}
