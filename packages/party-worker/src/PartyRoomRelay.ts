/**
 * HYPE RIOT — PartyRoomRelay (Blueprint §6, §7).
 * A Cloudflare Durable Object WebSocket relay: one object per room
 * code, a dumb broadcast pipe for up to 12 players. Room state lives
 * on the host client; the relay fans messages out and tracks the
 * socket roster for lobby presence.
 *
 * STATUS: code complete per spec, NOT DEPLOYED. Deployment needs the
 * owner's Cloudflare account (Workers Paid plan for Durable Objects
 * at scale; the free tier includes limited DO usage). Deploy with:
 *   cd packages/party-worker && npx wrangler deploy
 * then build the web app with VITE_PARTY_WS_URL=wss://<worker>/room
 */

interface Env {
  PARTY_ROOM: DurableObjectNamespace;
}

const MAX_PLAYERS = 12;
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

export class PartyRoom {
  private state: DurableObjectState;
  private sockets = new Map<WebSocket, { name: string }>();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket upgrade", { status: 426 });
    }
    if (this.sockets.size >= MAX_PLAYERS) {
      return new Response("room full", { status: 403 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sockets.set(server, { name: "?" });
    server.addEventListener("message", (ev: MessageEvent) => {
      let msg: { t?: string; name?: string };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.t === "PING") {
        server.send(JSON.stringify({ t: "PONG" }));
        return;
      }
      if (msg.t === "JOIN" && typeof msg.name === "string") {
        this.sockets.set(server, { name: msg.name.slice(0, 12) });
        this.broadcastLobby();
      }
      // dumb pipe: fan everything else out to the other sockets
      for (const [ws] of this.sockets) {
        if (ws !== server) {
          try { ws.send(String(ev.data)); } catch { /* dropped socket */ }
        }
      }
    });
    const close = () => {
      this.sockets.delete(server);
      this.broadcastLobby();
    };
    server.addEventListener("close", close);
    server.addEventListener("error", close);
    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcastLobby(): void {
    const players = [...this.sockets.values()].map((p) => ({
      name: p.name,
      avatar: 0,
    }));
    const payload = JSON.stringify({ t: "LOBBY", players });
    for (const [ws] of this.sockets) {
      try { ws.send(payload); } catch { /* dropped socket */ }
    }
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    // /room/<CODE>
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "room" || !CODE_RE.test(parts[1] ?? "")) {
      return new Response("usage: /room/<4-LETTER-CODE>", { status: 404 });
    }
    const id = env.PARTY_ROOM.idFromName(parts[1]);
    const stub = env.PARTY_ROOM.get(id);
    return stub.fetch(req);
  },
};
