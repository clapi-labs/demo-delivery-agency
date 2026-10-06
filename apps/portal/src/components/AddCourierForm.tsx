"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";

import { BOGOTA_CENTER } from "@/lib/geo";

export function AddCourierForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setBusy(true);
    // Coordenada aleatoria cerca del centro de Bogotá: no pedimos GPS real en
    // el alta — el motorizado la reporta solo cuando abre su pantalla.
    const jitter = () => (Math.random() - 0.5) * 0.06;
    await fetch("/api/couriers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        lat: BOGOTA_CENTER.lat + jitter(),
        lng: BOGOTA_CENTER.lng + jitter(),
      }),
    });
    setName("");
    setPhone("");
    setBusy(false);
    onCreated();
  }

  return (
    <form onSubmit={submit} className="card flex items-center gap-2 p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del motorizado"
        className="ease-ui min-w-0 flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Teléfono (573...)"
        className="ease-ui w-44 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy}
        className="ease-ui flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        <UserPlus size={15} />
        Agregar
      </button>
    </form>
  );
}
