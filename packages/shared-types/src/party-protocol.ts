/**
 * HYPE RIOT — party room WebSocket protocol (Blueprint §6, §7).
 * The relay (packages/party-worker) is a dumb broadcast pipe: clients
 * exchange these JSON messages; the room's Durable Object fans them
 * out to every other socket. Room state lives on the host client.
 *
 * STATUS: protocol defined per spec; the relay is NOT deployed yet
 * (needs the owner's Cloudflare account — see repo README). The web
 * client ships with party mode gated off until VITE_PARTY_WS_URL is
 * set to a deployed relay.
 */
export type PartyMessage =
  | { t: "JOIN"; name: string; avatar: number }
  | { t: "LOBBY"; players: { name: string; avatar: number }[] }
  | { t: "START"; seed: number; packId: number }
  | { t: "R1_HIT"; player: string; points: number; total: number }
  | { t: "R2_ANSWER"; player: string; correct: boolean; total: number }
  | { t: "R3_PITCH"; player: string; pitch: string }
  | { t: "R3_VOTE"; voter: string; forPlayer: string }
  | { t: "SCORES"; scores: Record<string, number> }
  | { t: "PING" }
  | { t: "PONG" };

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1
export const MAX_PARTY_PLAYERS = 12;

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === 4 &&
    [...code.toUpperCase()].every((c) => ROOM_CODE_ALPHABET.includes(c))
  );
}
