// Minimal Cloudflare Workers ambient types for the party relay.
// The full @cloudflare/workers-types package is a deploy-time concern;
// these declarations cover exactly the surface PartyRoomRelay uses so
// the monorepo typecheck stays green without extra dependencies.

interface DurableObjectState {
  id: DurableObjectId;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectStub {
  fetch(req: Request): Promise<Response>;
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

interface ResponseInit {
  webSocket?: WebSocket;
}

// Workers-flavoured WebSocket has accept(); the DOM one does not.
interface WebSocket {
  accept(): void;
}
