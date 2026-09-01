import { createHmac, createHash, timingSafeEqual } from "crypto";

export type StaffRole = "owner" | "waiter";
export type StaffClaims = { sid: string; role: StaffRole; name: string; exp: number };

function secret() {
  return process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_URL"] ?? "chiya-dev";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

export function issueToken(claims: Omit<StaffClaims, "exp">) {
  const full: StaffClaims = { ...claims, exp: Date.now() + 1000 * 60 * 60 * 24 * 365 };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined | null): StaffClaims {
  if (!token) throw new Error("Not signed in");
  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new Error("Invalid session");
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid session");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as StaffClaims;
  if (claims.exp < Date.now()) throw new Error("Session expired");
  return claims;
}

export function requireRole(token: string | undefined, roles: StaffRole[]) {
  const claims = verifyToken(token);
  if (!roles.includes(claims.role)) throw new Error("Not allowed");
  return claims;
}
