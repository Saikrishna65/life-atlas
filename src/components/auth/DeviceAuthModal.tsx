"use client";
import { useEffect, useState } from "react";
import { authorize } from "@/lib/security/authentication";
export default function DeviceAuthModal({
  isOpen,
  onSuccess,
  onClose,
}: {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    void authorize("app")
      .then(() => {
        if (live) onSuccess();
      })
      .catch(() => {
        if (live) setError("Device verification was cancelled or unavailable.");
      });
    return () => {
      live = false;
    };
  }, [isOpen, onSuccess, attempt]);
  if (!isOpen || !error) return null;
  return (
    <section role="dialog" aria-modal="true" aria-label="Atlas access">
      <p>{error}</p>
      <button onClick={() => setAttempt((value) => value + 1)}>
        Try device verification again
      </button>
      <button onClick={onClose}>Back</button>
    </section>
  );
}
