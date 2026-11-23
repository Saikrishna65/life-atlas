"use client";
import { useState } from "react";
import { AtlasStore } from "@/lib/atlas-ai/storage";
import {
  authorize,
  supportsAuthenticationSettings,
} from "@/lib/security/authentication";
export default function LegacyAssistantRecovery() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <details className="oc-panel">
      <summary>Recover older protected Atlas conversations</summary>
      <p>
        Earlier versions required a passphrase. Their encrypted data is
        preserved separately. This optional one-time import needs the existing
        phrase; new Atlas never requires you to create one.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            field = form.elements.namedItem("legacyPhrase") as HTMLInputElement;
          let phrase = field.value;
          field.value = "";
          const file = (
            form.elements.namedItem("legacyArchive") as HTMLInputElement
          ).files?.[0];
          setBusy(true);
          setMessage("");
          void (async () => {
            const legacy = new AtlasStore(),
              device = new AtlasStore();
            try {
              await authorize("backups");
              await device.openDevice();
              if (file) await device.importArchive(file, phrase);
              else {
                await legacy.unlock(phrase);
                await device.mergeRecovered(legacy.snapshot());
              }
              setMessage(
                "Conversations copied into device-secured Atlas. The older encrypted copy is preserved.",
              );
              form.reset();
            } catch {
              setMessage(
                "Could not import this copy. Check the existing phrase and archive. Your saved data is unchanged.",
              );
            } finally {
              phrase = "";
              legacy.lock();
              device.lock();
              setBusy(false);
            }
          })();
        }}
      >
        <label>
          Existing phrase
          <input
            name="legacyPhrase"
            type="password"
            autoComplete="off"
            required
            minLength={12}
          />
        </label>
        <label>
          Older archive (optional; leave empty to use this device’s earlier
          vault)
          <input name="legacyArchive" type="file" accept=".atlasai" />
        </label>
        <button
          className="oc-secondary"
          disabled={busy || !supportsAuthenticationSettings()}
        >
          Import older conversations
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
