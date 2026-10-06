/** Forma del webhook de la Cloud API — solo lo que usamos. Igual que CLAPI. */

export type WaTextMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: "text";
  text: { body: string };
};

/** Respuesta a un botón de respuesta rápida (el "Confirmar entrega"). */
export type WaInteractiveMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: "interactive";
  interactive: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
};

export type WaOtherMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
};

export type WaMessage = WaTextMessage | WaInteractiveMessage | WaOtherMessage;

export type WaContact = { wa_id: string; profile?: { name?: string } };

export type WaStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipient_id: string;
};

export type WaWebhookPayload = {
  object: string;
  entry?: {
    id: string;
    changes?: {
      field: string;
      value: {
        messaging_product: string;
        contacts?: WaContact[];
        messages?: WaMessage[];
        statuses?: WaStatus[];
      };
    }[];
  }[];
};

export type IncomingMessage = {
  waMessageId: string;
  phone: string;
  profileName: string | null;
  timestamp: Date;
} & (
  | { kind: "text"; text: string }
  | { kind: "button"; buttonId: string; title: string }
  | { kind: "unsupported"; type: string }
);
