"use client";

import { ArrowLeft, Bot, Check, Headset, MessagesSquare, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatCOP, formatPhone, initials } from "@/lib/format";
import type { ChatMessage, ConversationSummary, DraftFields } from "@/lib/types";
import { usePolling } from "@/lib/use-polling";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function name(c: ConversationSummary) {
  return c.displayName || formatPhone(c.phone);
}

const DRAFT_FIELDS: { key: keyof DraftFields; label: string }[] = [
  { key: "origenRestaurante", label: "Restaurante" },
  { key: "direccionEntrega", label: "Dirección" },
  { key: "telefonoCliente", label: "Teléfono" },
  { key: "valorACobrar", label: "Valor" },
  { key: "metodoPago", label: "Pago" },
];

/** Lo que el bot ya entendió del pedido en curso: la memoria entre mensajes. */
function DraftPanel({ draft }: { draft: DraftFields }) {
  const done = DRAFT_FIELDS.filter((f) => draft[f.key] !== null).length;
  return (
    <div className="border-b border-line bg-clapi-soft/60 px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-clapi-ink">
        <span className="flex items-center gap-1.5">
          <Bot size={14} /> El bot está armando el pedido
        </span>
        <span className="tabular-nums">{done}/5</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DRAFT_FIELDS.map((f) => {
          const value = draft[f.key];
          const text = value === null ? f.label : f.key === "valorACobrar" ? formatCOP(Number(value)) : String(value);
          return (
            <span
              key={f.key}
              className={`flex max-w-full items-center gap-1 truncate rounded-lg px-2 py-1 text-xs ${
                value === null ? "border border-dashed border-ink-3/40 text-ink-3" : "bg-surface font-medium text-ink shadow-sm"
              }`}
            >
              {value !== null && <Check size={12} className="shrink-0 text-ok" />}
              <span className="truncate">{text}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role !== "restaurant";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
          message.role === "restaurant"
            ? "rounded-bl-md bg-surface text-ink"
            : message.role === "bot"
              ? "rounded-br-md bg-clapi text-white"
              : "rounded-br-md bg-gold text-clapi-deep"
        }`}
      >
        {message.role !== "restaurant" && (
          <p className={`mb-0.5 text-[11px] font-semibold ${message.role === "bot" ? "text-white/70" : "text-clapi-deep/70"}`}>
            {message.role === "bot" ? "Bot" : "Asesor"}
          </p>
        )}
        {message.text}
        <p className={`mt-1 text-right text-[10px] ${message.role === "restaurant" ? "text-ink-3" : "opacity-70"}`}>
          {timeLabel(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function ConversacionesPage() {
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/conversations", { cache: "no-store" });
    if (!res.ok) return;
    const data: ConversationSummary[] = await res.json();
    setList(data);
    setLoaded(true);
    // En escritorio, abrir la conversación más reciente de entrada.
    if (data.length > 0 && window.matchMedia("(min-width: 1024px)").matches) {
      setSelectedId((current) => current ?? data[0].id);
    }
  }, []);

  const loadThread = useCallback(async (id: number) => {
    const res = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    if (res.ok) setThread(await res.json());
  }, []);

  usePolling(loadList, 2500);
  const pollThread = useCallback(() => {
    if (selectedId !== null) loadThread(selectedId);
  }, [selectedId, loadThread]);
  usePolling(pollThread, 2000, selectedId !== null);

  // Bajar al último mensaje solo cuando llega uno nuevo, no en cada sondeo.
  useEffect(() => {
    if (thread.length !== lastCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: lastCount.current === 0 ? "auto" : "smooth" });
      lastCount.current = thread.length;
    }
  }, [thread]);


  const selected = list.find((c) => c.id === selectedId) ?? null;

  async function resume() {
    if (!selected) return;
    await fetch(`/api/conversations/${selected.id}`, { method: "POST", body: JSON.stringify({ action: "resume" }) });
    loadList();
  }

  function open(id: number) {
    lastCount.current = 0;
    setThread([]);
    setSelectedId(id);
  }

  return (
    <div className="flex h-full lg:p-6">
      <div className="flex min-h-0 w-full overflow-hidden lg:card">
        {/* Lista de chats */}
        <aside className={`min-h-0 w-full flex-col border-line lg:flex lg:w-[340px] lg:border-r ${selected ? "hidden" : "flex"}`}>
          <div className="border-b border-line px-4 py-4">
            <h1 className="text-xl font-bold tracking-tight">Conversaciones</h1>
            <p className="text-sm text-ink-3">El bot atendiendo en vivo</p>
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto">
            {loaded && list.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-ink-3">
                <MessagesSquare size={22} className="opacity-60" />
                Cuando un restaurante escriba por WhatsApp, el chat aparece acá.
              </div>
            )}
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => open(c.id)}
                className={`ease-ui flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left ${
                  c.id === selectedId ? "bg-clapi-soft/70" : "can-hover:hover:bg-sunken"
                }`}
              >
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-bold text-ink-2">
                  {initials(name(c)) || "#"}
                  {c.botPaused && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold ring-2 ring-surface">
                      <Headset size={11} className="text-clapi-deep" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{name(c)}</span>
                    <span className="shrink-0 text-[11px] text-ink-3">{timeLabel(c.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {c.botPaused ? (
                      <span className="font-semibold text-gold-ink">Esperando un asesor</span>
                    ) : (
                      <>
                        {c.lastRole === "bot" && "Bot: "}
                        {c.lastText}
                      </>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Hilo */}
        <section className={`min-h-0 flex-1 flex-col bg-canvas ${selected ? "flex" : "hidden lg:flex"}`}>
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-ink-3">
              <MessagesSquare size={26} className="opacity-50" />
              Elige una conversación
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-3 lg:px-5">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 lg:hidden"
                  aria-label="Volver"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate font-semibold">{name(selected)}</p>
                  <p className="text-xs text-ink-3">{formatPhone(selected.phone)}</p>
                </div>
                {selected.botPaused ? (
                  <span className="flex items-center gap-1.5 rounded-lg bg-gold-soft px-2.5 py-1.5 text-xs font-semibold text-gold-ink">
                    <Headset size={13} /> Asesor
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-lg bg-clapi-soft px-2.5 py-1.5 text-xs font-semibold text-clapi-ink">
                    <span className="h-1.5 w-1.5 animate-live rounded-full bg-clapi" /> Bot activo
                  </span>
                )}
              </header>

              {selected.botPaused && (
                <div className="flex flex-wrap items-center gap-3 border-b border-gold/30 bg-gold-soft px-4 py-3">
                  <Headset size={18} className="shrink-0 text-gold-ink" />
                  <p className="min-w-0 flex-1 text-sm text-gold-ink">
                    <strong>El bot se apartó.</strong> {selected.escalationReason ?? "Un asesor debe tomar este pedido."}
                  </p>
                  <button
                    type="button"
                    onClick={resume}
                    className="ease-ui flex h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-xs font-semibold text-ink shadow-sm"
                  >
                    <RotateCcw size={13} /> Devolver al bot
                  </button>
                </div>
              )}

              {!selected.botPaused && selected.draft && <DraftPanel draft={selected.draft} />}

              <div className="no-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 lg:px-6">
                {thread.map((m) => (
                  <Bubble key={m.id} message={m} />
                ))}
                <div ref={bottomRef} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
