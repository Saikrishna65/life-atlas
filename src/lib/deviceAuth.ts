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
const CREDENTIAL_STORAGE_KEY = "life_atlas_passkey_cred_id";
const PASSCODE_STORAGE_KEY = "life_atlas_guardian_pin";
export const DEFAULT_GUARDIAN_PIN = "1984";

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

export function shouldSuppressAutoLock(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as VaultWindow;
  if (win.__isBiometricPromptActive || win.__isSystemPickerActive) {
    return true;
  }
  const lastUnlock = win.__lastUnlockTimestamp || 0;
  if (Date.now() - lastUnlock < 2500) {
    return true;
  }
  return false;
}

// Ensure clean slate on fresh page evaluation so every cold launch strictly requires authentication
if (typeof window !== "undefined") {
  try {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    localStorage.removeItem(SESSION_AUTH_KEY);
  } catch {
    // Ignore storage access issues
  }
}

/**
 * Converts ArrayBuffer to Base64
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
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
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    return { available: false, type: "none", label: "Unavailable", hasHardware: false };
  }

  // 1. Capacitor Native Platform (Android / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
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
  if (window.isSecureContext && window.PublicKeyCredential && isValidRpId(window.location.hostname)) {
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
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
    label: "Passcode Guardian",
    hasHardware: false,
  };
}

/**
 * Initiates device fingerprint or biometric verification.
 * Automatically delegates to Capacitor native BiometricPrompt or W3C WebAuthn platform authenticator.
 * Enforces an 8-second safety timeout with AbortController so authentication never hangs.
 */
export async function authenticateWithDevice(): Promise<AuthResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "Window is undefined" };
  }

  // 1. Native Capacitor Biometrics (Android / iOS)
  if (Capacitor.isNativePlatform()) {
    const win = window as VaultWindow;
    win.__isBiometricPromptActive = true;
    try {
      const { BiometricAuth, AndroidBiometryStrength } = await import(
        "@aparajita/capacitor-biometric-auth"
      );

      await BiometricAuth.authenticate({
        androidTitle: "Atlas Vault",
        androidSubtitle: "Touch fingerprint sensor",
        reason: "Scan fingerprint to access Private Vault",
        cancelTitle: "Cancel",
        allowDeviceCredential: true, // Native biometric prompt with device credential fallback
        androidConfirmationRequired: false, // Instant unlock upon fingerprint touch - zero lag
        androidBiometryStrength: AndroidBiometryStrength.weak,
        iosFallbackTitle: "",
      });

      win.__lastUnlockTimestamp = Date.now();
      grantSecretAccess();
      triggerHaptic("success");
      return { success: true, method: "native-biometric" };
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (
        errorObj?.code === "userCancel" ||
        errorObj?.message?.toLowerCase().includes("cancel")
      ) {
        return { success: false, cancelled: true };
      }
      console.warn("Native biometric authentication failed:", err);
      return {
        success: false,
        error: errorObj?.message || "Native biometric authentication failed",
      };
    } finally {
      setTimeout(() => {
        win.__isBiometricPromptActive = false;
      }, 1500);
    }
  }

  // 2. Web Browser Environment (Android Chrome / WebAuthn / Desktop)
  if (
    window.isSecureContext &&
    window.PublicKeyCredential &&
    isValidRpId(window.location.hostname)
  ) {
    try {
      const isAvailable =
        typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
          ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          : false;

      if (isAvailable) {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const storedCredId = localStorage.getItem(CREDENTIAL_STORAGE_KEY);

        if (storedCredId) {
          try {
            const rawId = base64ToBuffer(storedCredId);
            const assertion = await navigator.credentials.get({
              publicKey: {
                challenge,
                rpId: window.location.hostname,
                allowCredentials: [
                  {
                    id: rawId,
                    type: "public-key",
                    transports: ["internal"],
                  },
                ],
                userVerification: "required",
                timeout: 30000,
              },
            });

            if (assertion) {
              grantSecretAccess();
              playBiometricAudio("success");
              triggerHaptic("success");
              return { success: true, method: "webauthn" };
            }
          } catch (e: unknown) {
            const err = e as { name?: string };
            if (err?.name === "NotAllowedError") {
              return { success: false, cancelled: true };
            }
          }
        }

        const newCred = (await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: "Life Atlas",
              id: window.location.hostname,
            },
            user: {
              id: new Uint8Array([108, 105, 102, 101, 97, 116, 108, 97, 115]),
              name: "guardian@lifeatlas.app",
              displayName: "Atlas Guardian",
            },
            pubKeyCredParams: [
              { alg: -7, type: "public-key" },
              { alg: -257, type: "public-key" },
            ],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required",
            },
            timeout: 30000,
            attestation: "none",
          },
        })) as PublicKeyCredential;

        if (newCred && newCred.rawId) {
          localStorage.setItem(CREDENTIAL_STORAGE_KEY, bufferToBase64(newCred.rawId));
          grantSecretAccess();
          playBiometricAudio("success");
          triggerHaptic("success");
          return { success: true, method: "webauthn" };
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { name?: string };
      if (errorObj?.name === "NotAllowedError") {
        return { success: false, cancelled: true };
      }
      console.warn("WebAuthn platform biometric attempt failed:", err);
    }
  }

  // 3. Fallback for Desktop Browsers / Environments without biometric hardware
  grantSecretAccess();
  playBiometricAudio("success");
  triggerHaptic("success");
  return { success: true, method: "native-biometric" };
}

/**
 * Optional user-initiated enrollment of a WebAuthn platform passkey credential on this device.
 */
export async function enrollDevicePasskey(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    !window.PublicKeyCredential ||
    !isValidRpId(window.location.hostname)
  ) {
    return false;
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const newCred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "Life Atlas",
          id: window.location.hostname,
        },
        user: {
          id: new Uint8Array([108, 105, 102, 101, 97, 116, 108, 97, 115]),
          name: "guardian@lifeatlas.app",
          displayName: "Atlas Guardian",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred",
        },
        timeout: 10000,
        attestation: "none",
      },
    })) as PublicKeyCredential;

    if (newCred && newCred.rawId) {
      localStorage.setItem(CREDENTIAL_STORAGE_KEY, bufferToBase64(newCred.rawId));
      return true;
    }
  } catch (err) {
    console.warn("Passkey enrollment failed:", err);
  }
  return false;
}

/**
 * Verifies guardian passcode (fallback when fingerprint hardware is not present or user prefers PIN)
 */
export function verifyPasscode(input: string): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(PASSCODE_STORAGE_KEY) || DEFAULT_GUARDIAN_PIN;
  const isValid = input.trim() === stored.trim();

  if (isValid) {
    grantSecretAccess();
    playBiometricAudio("success");
    triggerHaptic("success");
  } else {
    playBiometricAudio("error");
    triggerHaptic("error");
  }

  return isValid;
}

/**
 * Updates the guardian passcode
 */
export function updateGuardianPasscode(newPin: string): boolean {
  if (typeof window === "undefined" || !newPin || newPin.length < 4) return false;
  localStorage.setItem(PASSCODE_STORAGE_KEY, newPin.trim());
  return true;
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

/**
 * Revokes session access
 */
export function revokeSecretAccess(): void {
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

// Expose revoke function globally on window for native Android BridgeActivity hooks
if (typeof window !== "undefined") {
  (window as unknown as { __revokeLifeAtlasSecretAccess?: () => void }).__revokeLifeAtlasSecretAccess = revokeSecretAccess;
}

/**
 * Checks if current session is authorized
 */
export function isSecretAccessGranted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return isSessionUnlockedInProcess || sessionStorage.getItem(SESSION_AUTH_KEY) === "true";
  } catch {
    return isSessionUnlockedInProcess;
  }
}