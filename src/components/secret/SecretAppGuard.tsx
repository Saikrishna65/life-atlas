"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { usePathname } from "next/navigation";
import {
  authorize,
  authenticationInProgress,
  getAuthenticationPolicy,
  routeAuthenticationScope,
  type AuthenticationPolicy,
} from "@/lib/security/authentication";
export default function SecretAppGuard({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [policy, setPolicy] = useState<AuthenticationPolicy>(),
    [verified, setVerified] = useState(false);
  const [passed, setPassed] = useState(""),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const native = Capacitor.isNativePlatform();
  useEffect(() => {
    if (!native) return;
    let live = true,
      protectedRoute = false;
    const check = async () => {
      try {
        const next = await getAuthenticationPolicy();
        if (live) setPolicy(next);
        const scope = routeAuthenticationScope(path);
        protectedRoute = next.app || !!(scope && next[scope]);
        await authorize("app");
        if (scope) await authorize(scope);
        if (live) {
          setPassed(path);
          setVerified(protectedRoute);
          setError("");
        }
      } catch {
        if (live) {
          setPolicy(undefined);
          setPassed("");
          setVerified(false);
          setError(
            "Atlas is locked. Use your phone’s fingerprint or device PIN to continue.",
          );
        }
      }
    };
    void check();
    const hide = () => {
      if (document.hidden && !authenticationInProgress()) {
        setVerified(false);
        if (protectedRoute) setPassed("");
      } else if (!document.hidden) void check();
    };
    const changed = () => {
      setPolicy(undefined);
      setPassed("");
      setVerified(false);
      void check();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("atlas:authentication-policy", changed);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("atlas:authentication-policy", changed);
    };
  }, [native, path, attempt]);
  const scope = routeAuthenticationScope(path);
  const unprotected = policy && !policy.app && (!scope || !policy[scope]);
  if (!native || passed === path || unprotected || verified)
    return <>{children}</>;
  return (
    <section className="max-w-md mx-auto p-8" aria-label="Atlas access">
      {error ? (
        <>
          <h1>Open Atlas</h1>
          <p role="status">{error}</p>
          <button
            className="oc-primary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Unlock with my device
          </button>
        </>
      ) : (
        <p role="status">Opening Atlas…</p>
      )}
    </section>
  );
}
