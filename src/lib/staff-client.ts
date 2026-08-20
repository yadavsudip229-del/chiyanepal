import { useEffect, useState } from "react";

export type StaffSession = { token: string; role: "owner" | "waiter"; name: string };

const KEY = "chiya_staff_session";

export function getStaffSession(): StaffSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
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
    const found = getStaffSession();
    if (found && requiredRole && found.role !== requiredRole) {
      setSession(null);
      return;
    }
    setSession(found);
  }, [requiredRole]);

  return { session, setSession };
}
