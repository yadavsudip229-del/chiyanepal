import { useEffect, useState } from "react";

export type StaffSession = { token: string; role: "owner" | "waiter"; name: string };

const KEY = "chiya_staff_session";

function readTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[0];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const claims = JSON.parse(window.atob(padded)) as { exp?: unknown };
    return typeof claims.exp === "number" ? claims.exp : null;
  } catch {
    return null;
  }
}

export function isStaffSessionExpired(session: StaffSession): boolean {
  const expiry = readTokenExpiry(session.token);
  return expiry === null || expiry <= Date.now();
}

export function handleStaffSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.toLowerCase().includes("session expired")) return false;
  clearStaffSession();
  window.dispatchEvent(new Event("chiya-staff-session-cleared"));
  return true;
}

export function getStaffSession(): StaffSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StaffSession;
    if (isStaffSessionExpired(session)) {
      clearStaffSession();
      return null;
    }
    return session;
  } catch {
    clearStaffSession();
    return null;
  }
}

export function setStaffSession(session: StaffSession) {
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearStaffSession() {
  window.localStorage.removeItem(KEY);
}

/** Returns undefined while hydrating, null when signed out. */
export function useStaffSession(requiredRole?: "owner" | "waiter") {
  const [session, setSession] = useState<StaffSession | null | undefined>(undefined);

  useEffect(() => {
    const refreshSession = () => {
      const found = getStaffSession();
      if (found && requiredRole && found.role !== requiredRole) {
        setSession(null);
        return;
      }
      setSession(found);
    };

    refreshSession();
    const interval = window.setInterval(refreshSession, 60_000);
    window.addEventListener("storage", refreshSession);
    window.addEventListener("chiya-staff-session-cleared", refreshSession);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refreshSession);
      window.removeEventListener("chiya-staff-session-cleared", refreshSession);
    };
  }, [requiredRole]);

  return { session, setSession };
}
