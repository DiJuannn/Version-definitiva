// Conecta el documento Yjs del guion con las demás personas que lo tienen
// abierto, por un canal de Supabase Realtime (el mismo sistema que ya usan
// el moodboard y el plan de rodaje). No hay servidor propio de websockets:
// cada navegador emite sus cambios y aplica los de los demás; Yjs garantiza
// que todos acaban con el mismo texto aunque escriban a la vez.
//
// Mensajes del canal (broadcast):
//   "y"     → { u }      cambio de texto (update Yjs en base64)
//   "sync"  → { sv, to? } "esto es lo que tengo": quien lo recibe contesta
//                         con lo que le falta al otro (y pide lo suyo)
//   "aw"    → { u }      cursores y nombres (awareness)

import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export type ConnectionStatus = "connecting" | "online" | "offline";

// Origen de los cambios que llegan de otra persona (para no reenviarlos).
export const REMOTE_ORIGIN = Symbol("remote");
const REMOTE = REMOTE_ORIGIN;
// Las teclas se agrupan en un mensaje cada pocos ms para no saturar el canal.
const FLUSH_MS = 40;

export class SupabaseYjsProvider {
  status: ConnectionStatus = "connecting";

  private _awareness: Awareness | null = null;
  private channel: RealtimeChannel | null = null;
  private pending: Uint8Array[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(s: ConnectionStatus) => void>();

  // Crear el proveedor no abre nada: la conexión se abre con connect() desde
  // un efecto y se cierra con disconnect() al salir de la página.
  constructor(
    private supabase: SupabaseClient,
    private doc: Y.Doc,
    private room: string,
  ) {}

  // Cursores y nombres. Se crea al primer uso (lo pide el editor al montarse).
  get awareness(): Awareness {
    this._awareness ??= new Awareness(this.doc);
    return this._awareness;
  }

  connect() {
    if (this.destroyTimer) clearTimeout(this.destroyTimer);
    this.destroyTimer = null;
    if (this.channel) return;

    const doc = this.doc;
    const channel = this.supabase.channel(this.room, { config: { broadcast: { self: false } } });
    this.channel = channel;
    doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);

    channel
      .on("broadcast", { event: "y" }, ({ payload }) => {
        if (typeof payload?.u !== "string") return;
        try {
          Y.applyUpdate(doc, base64ToBytes(payload.u), REMOTE);
        } catch {
          // Un mensaje corrupto no debe tumbar el editor.
        }
      })
      .on("broadcast", { event: "sync" }, ({ payload }) => {
        if (typeof payload?.sv !== "string") return;
        if (payload.to && payload.to !== doc.clientID) return;
        try {
          const diff = Y.encodeStateAsUpdate(doc, base64ToBytes(payload.sv));
          if (diff.byteLength > 2) this.send("y", { u: bytesToBase64(diff) });
        } catch {
          return;
        }
        // Quien acaba de llegar no tiene nuestros cursores todavía.
        this.send("aw", { u: bytesToBase64(encodeAwarenessUpdate(this.awareness, [doc.clientID])) });
        // Y le pedimos lo que tenga él que no tengamos nosotros.
        if (!payload.to && typeof payload.from === "number") {
          this.send("sync", { sv: bytesToBase64(Y.encodeStateVector(doc)), to: payload.from, from: doc.clientID });
        }
      })
      .on("broadcast", { event: "aw" }, ({ payload }) => {
        if (typeof payload?.u !== "string") return;
        try {
          applyAwarenessUpdate(this.awareness, base64ToBytes(payload.u), REMOTE);
        } catch {
          // ignorado
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.setStatus("online");
          this.send("sync", { sv: bytesToBase64(Y.encodeStateVector(doc)), from: doc.clientID });
          this.send("aw", { u: bytesToBase64(encodeAwarenessUpdate(this.awareness, [doc.clientID])) });
          // Lo escrito mientras no había conexión sale ahora.
          this.flush();
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.setStatus("offline");
        }
      });

    if (typeof window !== "undefined") window.addEventListener("beforeunload", this.onUnload);
  }

  // Se cierra un instante después: si React vuelve a montar el editor justo
  // a continuación (modo estricto en desarrollo), connect() lo cancela.
  disconnect() {
    if (this.destroyTimer) clearTimeout(this.destroyTimer);
    this.destroyTimer = setTimeout(() => this.destroy(), 0);
  }

  onStatus(fn: (s: ConnectionStatus) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private setStatus(s: ConnectionStatus) {
    this.status = s;
    this.listeners.forEach((fn) => fn(s));
  }

  private send(event: string, payload: Record<string, unknown>) {
    // Solo por el websocket ya unido: lo que no sale ahora (texto) se manda
    // al reconectar con flush(), y los cursores se reenvían al unirse.
    if (this.status !== "online" || !this.channel) return;
    void this.channel.send({ type: "broadcast", event, payload });
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE || origin === "db") return;
    this.pending.push(update);
    if (!this.flushTimer) this.flushTimer = setTimeout(this.flush, FLUSH_MS);
  };

  private flush = () => {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (!this.pending.length || this.status !== "online") return;
    const merged = Y.mergeUpdates(this.pending);
    this.pending = [];
    this.send("y", { u: bytesToBase64(merged) });
  };

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === REMOTE) return;
    const changed = [...added, ...updated, ...removed];
    this.send("aw", { u: bytesToBase64(encodeAwarenessUpdate(this.awareness, changed)) });
  };

  private onUnload = () => {
    removeAwarenessStates(this.awareness, [this.doc.clientID], "unload");
  };

  destroy() {
    if (this.destroyTimer) clearTimeout(this.destroyTimer);
    this.destroyTimer = null;
    this.flush();
    if (this._awareness) {
      removeAwarenessStates(this._awareness, [this.doc.clientID], "destroy");
      this._awareness.off("update", this.onAwarenessUpdate);
      this._awareness.destroy();
      this._awareness = null;
    }
    this.doc.off("update", this.onDocUpdate);
    if (typeof window !== "undefined") window.removeEventListener("beforeunload", this.onUnload);
    if (this.channel) void this.supabase.removeChannel(this.channel);
    this.channel = null;
    this.setStatus("offline");
  }
}
