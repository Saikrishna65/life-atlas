import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
export type ActivationMode = "microphone" | "google-bridge" | "off";
export interface ActivationStatus {
  supported: boolean;
  mode: ActivationMode;
  changing: boolean;
  listenerRunning: boolean;
  listenerCapturing: boolean;
  microphoneGranted: boolean;
  accessibilityEnabled: boolean;
  bridgeConnected: boolean;
  observeOnly: boolean;
  disclosureAccepted: boolean;
  overlayPackage: string;
  overlayClass: string;
  observedPackage: string;
  observedClass: string;
  phase: string;
  reason: string;
  attempts: number;
  opened: number;
  failures: number;
  lastHandoffMs: number;
  averageHandoffMs: number;
  listeningMs: number;
}
interface ActivationPlugin {
  getActivationStatus(): Promise<ActivationStatus>;
  setActivationMode(input: {
    mode: ActivationMode;
    acknowledgeBridge?: boolean;
  }): Promise<ActivationStatus>;
  configureGoogleBridge(input: {
    observeOnly: boolean;
    packageName?: string;
    className?: string;
    confirmOverlay?: boolean;
  }): Promise<ActivationStatus>;
  openActivationAccessibilitySettings(): Promise<{ opened: boolean }>;
  consumeGoogleActivation(): Promise<{ started: boolean }>;
  clearActivationMetrics(): Promise<ActivationStatus>;
  addListener(
    name: "activationRequested" | "statusChanged",
    callback: () => void,
  ): Promise<PluginListenerHandle>;
}
const native = registerPlugin<ActivationPlugin>("AtlasWakeWord");
export const activationSupported = () =>
  Capacitor.getPlatform() === "android" &&
  Capacitor.isPluginAvailable("AtlasWakeWord");
export const unavailableActivation: ActivationStatus = {
  supported: false,
  mode: "off",
  changing: false,
  listenerRunning: false,
  listenerCapturing: false,
  microphoneGranted: false,
  accessibilityEnabled: false,
  bridgeConnected: false,
  observeOnly: true,
  disclosureAccepted: false,
  overlayPackage: "",
  overlayClass: "",
  observedPackage: "",
  observedClass: "",
  phase: "IDLE",
  reason: "Voice activation is available in the Android app.",
  attempts: 0,
  opened: 0,
  failures: 0,
  lastHandoffMs: 0,
  averageHandoffMs: 0,
  listeningMs: 0,
};
const requireNative = () => {
  if (!activationSupported()) throw Error("ANDROID_REQUIRED");
};
export const voiceActivation = {
  status: () =>
    activationSupported()
      ? native.getActivationStatus()
      : Promise.resolve(unavailableActivation),
  setMode: (mode: ActivationMode, acknowledgeBridge = false) => {
    requireNative();
    return native.setActivationMode({ mode, acknowledgeBridge });
  },
  configure: (
    input: Parameters<ActivationPlugin["configureGoogleBridge"]>[0],
  ) => {
    requireNative();
    return native.configureGoogleBridge(input);
  },
  openAccessibility: () => {
    requireNative();
    return native.openActivationAccessibilitySettings();
  },
  clearMetrics: () => {
    requireNative();
    return native.clearActivationMetrics();
  },
  consume: () =>
    activationSupported()
      ? native.consumeGoogleActivation()
      : Promise.resolve({ started: false }),
  onStatus: (callback: () => void) =>
    activationSupported()
      ? native.addListener("statusChanged", callback)
      : Promise.resolve(undefined),
  onRequest: (callback: () => void) =>
    activationSupported()
      ? native.addListener("activationRequested", callback)
      : Promise.resolve(undefined),
};
export function activationLabel(value: ActivationStatus) {
  if (!value.supported) return "Android app required";
  if (value.changing) return "Releasing audio before switching…";
  if (value.mode === "off") return "Automatic activation is off";
  if (value.mode === "microphone")
    return value.listenerCapturing
      ? "Microphone wake-word listener active"
      : value.listenerRunning
        ? "Listener running; check experiment diagnostics"
        : "Microphone listener selected, currently stopped";
  if (value.listenerRunning || value.listenerCapturing)
    return "Listener is still stopping; bridge cannot activate";
  if (!value.accessibilityEnabled)
    return "Enable Atlas Google voice bridge in Android Accessibility";
  if (!value.bridgeConnected)
    return "Waiting for Android to connect the accessibility service";
  if (value.observeOnly)
    return "Observe only: identify and confirm the assistant overlay";
  if (!value.microphoneGranted)
    return "Allow the microphone in Android app permissions before giving commands";
  return value.phase === "IDLE"
    ? "Experimental bridge armed; device validation pending"
    : "Google handoff or conversation in progress";
}
export function activationError(error: unknown) {
  const value =
    error && typeof error === "object"
      ? (error as { code?: string; message?: string })
      : {};
  const messages: Record<string, string> = {
    ANDROID_REQUIRED: "Use Voice activation in the installed Android app.",
    BRIDGE_DISCLOSURE_REQUIRED:
      "Review and accept the Google bridge disclosure first.",
    MICROPHONE_PERMISSION_REQUIRED:
      "Allow the microphone so Atlas can hear commands after activation.",
    MODE_SWITCH_IN_PROGRESS:
      "A mode change is already finishing. Refresh its status in a moment.",
    AUDIO_RELEASE_TIMEOUT:
      "The previous audio session has not released. Activation remains off; retry.",
    OBSERVED_OVERLAY_REQUIRED:
      "Observe the assistant overlay again, then confirm its exact package and class.",
    INVALID_OVERLAY_CLASS:
      "That window is too generic or unsupported. Observe the assistant overlay again.",
    ACTIVATION_STOP_FAILED:
      "Android could not stop the previous voice service. Activation remains off; reopen Atlas and retry.",
    ACTIVATION_START_FAILED:
      "Android could not start the selected mode. Refresh status; no automatic fallback was enabled.",
    UNIMPLEMENTED:
      "This APK does not include voice activation switching yet. Use the updated build when available.",
  };
  return (
    messages[value.code || ""] ||
    messages[value.message || ""] ||
    "Could not finish the activation change. Refresh status before retrying."
  );
}
