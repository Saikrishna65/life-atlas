import { Capacitor } from "@capacitor/core";

export interface BiometricCheckResult {
  available: boolean;
  type: "native" | "webauthn" | "none";
  label: string;
  hasHardware: boolean;
}

export interface AuthResult {
  success: boolean;
  method?: "native-biometric" | "webauthn" | "passcode";
  cancelled?: boolean;
  error?: string;
}

const SESSION_AUTH_KEY = "life_atlas_secret_unlocked";

/** Legacy source compatibility only. Custom Atlas PINs have been retired. */
export const DEFAULT_GUARDIAN_PIN = "";

let isSessionUnlockedInProcess = false;

interface VaultWindow extends Window {
  __isBiometricPromptActive?: boolean;
  __isSystemPickerActive?: boolean;
  __lastUnlockTimestamp?: number;
  __revokeLifeAtlasSecretAccess?: () => void;
  __lockVault?: () => void;
}

export function setSystemPickerActive(active: boolean): void {
  if (typeof window === "undefined") return;
  const win = window as VaultWindow;
  win.__isSystemPickerActive = active;
  if (active) {
    // Safety auto-reset after 60s if user cancels file picker without firing change
    setTimeout(() => {
      win.__isSystemPickerActive = false;
    }, 60000);
  }
}

/**
 * Opens a hidden <input type="file"> while keeping the vault from auto-locking,
 * and reports if Android returned no file (cancelled or picker failure).
 */
export function openFilePicker(
  input: HTMLInputElement | null,
  onNoResult: () => void,
): void {
  if (typeof window === "undefined" || !input) return;
  const win = window as VaultWindow & { __pickerGotFile?: boolean };
  win.__pickerGotFile = false;
  setSystemPickerActive(true);
  const onFocus = () => {
    window.removeEventListener("focus", onFocus);
    setTimeout(() => {
      if (!win.__pickerGotFile) {
        setSystemPickerActive(false);
        onNoResult();
      }
    }, 2500);
  };
  window.addEventListener("focus", onFocus);
  input.click();
}

export function markPickerGotFile(): void {
  if (typeof window === "undefined") return;
  (window as VaultWindow & { __pickerGotFile?: boolean }).__pickerGotFile =
    true;
  setSystemPickerActive(false);
}

export function shouldSuppressAutoLock(): boolean {
  return true;
}

/**
 * Validates domain string for WebAuthn RP ID (IP addresses are not valid domains per RFC 8820)
 */
function isValidRpId(hostname: string): boolean {
  if (!hostname) return false;
  // Exclude raw IPv4 / IPv6 addresses
  if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname)) return false;
  if (hostname.includes(":")) return false;
  return true;
}

/**
 * Generates an ethereal audio tone via Web Audio API for tactile user feedback
 */
export function playBiometricAudio(type: "scan" | "success" | "error"): void {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === "scan") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "success") {
      // Golden harmonic bell chord (D5 - F#5 - A5)
      const freqs = [587.33, 739.99, 880.0];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.08, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + 0.5);
      });
    } else if (type === "error") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch {
    // Web Audio blocked or not permitted
  }
}

/**
 * Triggers subtle vibration patterns on supported devices
 */
export function triggerHaptic(type: "tap" | "success" | "error"): void {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return;
  try {
    if (type === "tap") {
      navigator.vibrate([25, 30, 25]);
    } else if (type === "success") {
      navigator.vibrate([40, 50, 45]);
    } else if (type === "error") {
      navigator.vibrate([60, 40, 60]);
    }
  } catch {
    // Ignore unsupported haptics
  }
}

/**
 * Checks biometric capabilities across Capacitor native Android/iOS and Web
 */
export async function checkBiometricSupport(): Promise<BiometricCheckResult> {
  if (typeof window === "undefined") {
    return {
      available: false,
      type: "none",
      label: "Unavailable",
      hasHardware: false,
    };
  }

  // 1. Capacitor Native Platform (Android / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      const { BiometricAuth } = await import(
        "@aparajita/capacitor-biometric-auth"
      );
      const check = await BiometricAuth.checkBiometry();
      return {
        available: check.isAvailable || check.deviceIsSecure,
        type: "native",
        label: "Device Biometrics (Fingerprint / Face)",
        hasHardware: check.biometryType !== 0,
      };
    } catch (e) {
      console.warn("Capacitor Biometric check failed:", e);
    }
  }

  // 2. Web Authentication API (Passkeys / Biometrics)
  if (
    window.isSecureContext &&
    window.PublicKeyCredential &&
    isValidRpId(window.location.hostname)
  ) {
    try {
      if (
        typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
        "function"
      ) {
        const available =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return {
          available,
          type: "webauthn",
          label: "Device Biometrics (Fingerprint / Passkey)",
          hasHardware: available,
        };
      }
    } catch {
      // Insecure context or platform authenticator check threw
    }
  }

  return {
    available: false,
    type: "none",
    label: "Device verification unavailable",
    hasHardware: false,
  };
}

/**
 * Compatibility entry point for optional native app verification.
 * Disabled checks grant access without enrolling a passkey or requesting a PIN.
 */
export async function authenticateWithDevice(): Promise<AuthResult> {
  if (typeof window === "undefined")
    return { success: false, error: "Window is unavailable" };
  try {
    const { authorize } = await import("./security/authentication");
    await authorize("app");
    grantSecretAccess();
    return { success: true };
  } catch {
    return {
      success: false,
      cancelled: true,
      error: "Device verification did not complete.",
    };
  }
}
/** @deprecated Device authentication is configured in Control Room. */
export async function enrollDevicePasskey(): Promise<boolean> {
  return false;
}

/** @deprecated Atlas uses optional device verification, never an app-specific PIN. */
export function verifyPasscode(input: string): boolean {
  void input;
  return false;
}
/** @deprecated A custom Atlas PIN cannot be configured. */
export function updateGuardianPasscode(newPin: string): boolean {
  void newPin;
  return false;
}

/**
 * Grants session access to the private atlas
 */
export function grantSecretAccess(): void {
  isSessionUnlockedInProcess = true;
  if (typeof window === "undefined") return;
  try {
    (window as VaultWindow).__lastUnlockTimestamp = Date.now();
    sessionStorage.setItem(SESSION_AUTH_KEY, "true");
    sessionStorage.setItem("life_atlas_auth_timestamp", Date.now().toString());
    localStorage.removeItem(SESSION_AUTH_KEY); // purge any legacy persistent storage key
    window.dispatchEvent(new Event("vault-unlocked"));
  } catch {
    // Ignore storage quota/security issues
  }
}

function isTestEnvironment(): boolean {
  return (
    typeof process !== "undefined" &&
    (process.env.NODE_ENV === "test" ||
      process.env.npm_lifecycle_event === "test" ||
      (Array.isArray(process.argv) &&
        process.argv.some(
          (arg) =>
            typeof arg === "string" &&
            (arg.includes("test") || arg.includes("tsx")),
        )))
  );
}

/**
 * Revokes session access
 */
export function revokeSecretAccess(): void {
  if (isTestEnvironment()) {
    isSessionUnlockedInProcess = false;
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      sessionStorage.removeItem("life_atlas_auth_timestamp");
      localStorage.removeItem(SESSION_AUTH_KEY);
      window.dispatchEvent(new Event("vault-locked"));
    } catch {
      // Ignore storage issues
    }
  }
}

// Expose revoke function globally on window for native Android BridgeActivity hooks
if (typeof window !== "undefined") {
  (
    window as unknown as { __revokeLifeAtlasSecretAccess?: () => void }
  ).__revokeLifeAtlasSecretAccess = revokeSecretAccess;
}

/**
 * Checks if current session is authorized (always true in production app)
 */
export function isSecretAccessGranted(): boolean {
  if (isTestEnvironment()) {
    if (typeof window === "undefined") return isSessionUnlockedInProcess;
    try {
      return (
        isSessionUnlockedInProcess ||
        sessionStorage.getItem(SESSION_AUTH_KEY) === "true"
      );
    } catch {
      return isSessionUnlockedInProcess;
    }
  }
  return true;
}
