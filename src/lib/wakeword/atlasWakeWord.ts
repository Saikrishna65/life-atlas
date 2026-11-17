import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface WakeWordModelInfo {
  modelId: string;
  displayName: string;
  targetPhrase: string;
  isCustomHeyAtlasModel: boolean;
  sourceType: "imported_custom" | "bundled_custom" | "bundled_test" | string;
  modelPathOrAsset: string;
  isAsset: boolean;
  sha256: string;
  threshold: number;
  cooldownMs: number;
  requiredEmbeddingFrames: number;
  licenseNote: string;
}

export interface DeviceEnvironmentSnapshot {
  interactive: boolean;
  keyguardLocked: boolean;
  batterySaverOn: boolean;
  ignoringBatteryOptimizations: boolean;
  networkOnline: boolean;
  musicActive: boolean;
  inCallOrCommunication: boolean;
  bluetoothAudioConnected: boolean;
}

export interface WakeWordDetectionEvent {
  at: string;
  modelId: string;
  displayName: string;
  targetPhrase: string;
  isCustomHeyAtlasModel: boolean;
  score: number;
  threshold: number;
  inferenceLatencyMs?: number;
  latencyMs?: number;
  environment: DeviceEnvironmentSnapshot;
}

export interface WakeWordListeningStatus {
  running: boolean;
  paused: boolean;
  micSilenced: boolean;
  serviceState: string;
  lastStateReason: string;
  microphoneGranted: boolean;
  notificationsGranted: boolean;
  ignoringBatteryOptimizations: boolean;
  loadedModel: WakeWordModelInfo;
  environment: DeviceEnvironmentSnapshot;
}

export interface WakeWordLifecycleEvent {
  at: string;
  kind: string;
  detail: string;
}

export interface WakeWordScenarioResult {
  status: "untested" | "passed" | "partial" | "failed" | "blocked" | string;
  notes: string;
  updatedAt: string;
  environment?: DeviceEnvironmentSnapshot;
}

export interface WakeWordStats {
  running: boolean;
  paused: boolean;
  micSilenced: boolean;
  serviceState: string;
  lastStateReason: string;
  detectionCount: number;
  falsePositiveCount: number;
  missedActivationCount: number;
  framesProcessed: number;
  lastDetectionLatencyMs: number;
  avgDetectionLatencyMs: number;
  lastScore: number;
  peakScore: number;
  micCompetitionCount: number;
  cpuPercentEstimate: number;
  memoryMbEstimate: number;
  loadedModel: WakeWordModelInfo;
  detections: WakeWordDetectionEvent[];
}

export interface AssistantRoleStatus {
  roleAvailable: boolean;
  roleHeld: boolean;
  voiceInteractionServiceBound: boolean;
}

export interface WakeWordDiagnosticReport extends WakeWordStats {
  sdkInt: number;
  deviceModel: string;
  totalInferenceMs?: number;
  environment: DeviceEnvironmentSnapshot;
  lifecycleEvents: WakeWordLifecycleEvent[];
  scenarioResults: Record<string, WakeWordScenarioResult>;
  listeningStatus?: WakeWordListeningStatus;
  assistantRole?: AssistantRoleStatus;
}

export interface WakeWordScenarioDefinition {
  id: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
  title: string;
  expectedHonestOutcome: string;
  steps: string[];
}

export interface OvernightSnapshot {
  timestamp: string;
  elapsedRealtimeMs: number;
  elapsedMinutes: number;
  batteryPercent: number;
  isCharging: boolean;
  plugType: string;
  interactive: boolean;
  keyguardLocked: boolean;
  serviceRunning: boolean;
  micActuallyCapturing: boolean;
  confirmedListeningDurationMs: number;
  serviceRunningDurationMs: number;
  detectionsSoFar: number;
  interruptionsSoFar: number;
}

export interface OvernightDetection {
  at: string;
  elapsedRealtimeMs: number;
  targetPhrase: string;
  score: number;
  latencyMs: number;
  interactive: boolean;
  keyguardLocked: boolean;
}

export interface OvernightInterruption {
  at: string;
  elapsedRealtimeMs: number;
  kind: string;
  reason: string;
}

export interface OvernightMonitoringGap {
  gapMinutes: number;
  startAt: string;
  endAt: string;
  reasonNote: string;
}

export interface OvernightTestRun {
  testId: string;
  isBaseline: boolean;
  status: "running" | "completed" | string;
  startedAt: string;
  endedAt?: string;
  startElapsedRealtimeMs: number;
  endElapsedRealtimeMs?: number;
  durationMs: number;
  durationHours: number;
  serviceRunningDurationMs: number;
  confirmedActiveListeningDurationMs: number;
  pausedOrSilencedDurationMs: number;
  batteryStartPct: number;
  batteryEndPct?: number;
  batteryCurrentPct: number;
  batteryDrainPct: number;
  drainPerHour: number;
  isChargingStart: boolean;
  isChargingEnd?: boolean;
  plugTypeStart: string;
  plugTypeEnd?: string;
  interactiveStart: boolean;
  keyguardLockedStart: boolean;
  deviceModel: string;
  sdkInt: number;
  snapshots: OvernightSnapshot[];
  detections: OvernightDetection[];
  interruptions: OvernightInterruption[];
  monitoringGaps: OvernightMonitoringGap[];
  attributionDisclaimer: string;
}

export interface OvernightTestReport {
  isTestRunning: boolean;
  activeTest?: OvernightTestRun | null;
  lastCompletedTest?: OvernightTestRun | null;
  lastCompletedBaseline?: OvernightTestRun | null;
  lastCompletedActive?: OvernightTestRun | null;
}

export type VoiceSessionStateName =
  | "IDLE"
  | "WAKE_LISTENING"
  | "WAKE_DETECTED"
  | "SESSION_STARTING"
  | "COMMAND_LISTENING"
  | "TRANSCRIBING"
  | "THINKING"
  | "SPEAKING"
  | "FOLLOW_UP_LISTENING"
  | "SESSION_ENDING"
  | "ERROR_RECOVERY";

export interface VoiceSessionStateEvent {
  state: VoiceSessionStateName;
  sessionId?: string | null;
  detail?: string;
}

export interface VoiceTranscriptEvent {
  sessionId?: string | null;
  text: string;
  isFinal: boolean;
}

export interface VoiceCommandEvent {
  sessionId: string;
  turnId: string;
  transcript: string;
  isLocked: boolean;
  isFollowUp: boolean;
}

export interface VoiceSessionStatus {
  state: VoiceSessionStateName;
  sessionId?: string | null;
  audioOwner: string;
  voiceAssistantEnabled: boolean;
  greetOnWake?: boolean;
  overlayPermissionGranted?: boolean;
  onDeviceSpeechAvailable: boolean;
  systemSpeechAvailable: boolean;
  speechReason: string;
}

export interface AtlasWakeWordNativePlugin {
  startListening(options?: { useAssistantSession?: boolean }): Promise<WakeWordListeningStatus>;
  stopListening(): Promise<WakeWordListeningStatus>;
  pauseListening(): Promise<WakeWordListeningStatus>;
  resumeListening(): Promise<WakeWordListeningStatus>;
  getListeningStatus(): Promise<WakeWordListeningStatus>;
  getWakeWordStats(): Promise<WakeWordStats>;
  getDiagnosticReport(): Promise<WakeWordDiagnosticReport>;
  importCustomModel(options?: { threshold?: number }): Promise<{ imported: boolean; loadedModel: WakeWordModelInfo }>;
  resetToTestModel(): Promise<{ loadedModel: WakeWordModelInfo }>;
  markFalsePositive(): Promise<{ falsePositiveCount: number }>;
  markMissedActivation(options?: { note?: string }): Promise<{ missedActivationCount: number }>;
  recordScenarioResult(options: {
    scenarioId: string;
    status: string;
    notes: string;
  }): Promise<WakeWordDiagnosticReport>;
  clearDiagnostics(): Promise<WakeWordDiagnosticReport>;
  requestNotificationPermission(): Promise<WakeWordListeningStatus>;
  getAssistantRoleStatus(): Promise<AssistantRoleStatus>;
  requestAssistantRole(): Promise<AssistantRoleStatus>;
  openAssistantSettings(): Promise<{ opened: boolean }>;
  openBatteryOptimizationSettings(): Promise<{ opened: boolean }>;
  openOverlayPermissionSettings(): Promise<{ opened: boolean }>;
  startOvernightTest(options?: { isBaseline?: boolean; useAssistantSession?: boolean }): Promise<OvernightTestReport>;
  stopOvernightTest(): Promise<OvernightTestReport>;
  getOvernightReport(): Promise<OvernightTestReport>;
  exportOvernightCsv(): Promise<{ csv: string }>;
  clearOvernightData(): Promise<OvernightTestReport>;
  submitVoiceReply(options: {
    sessionId: string;
    turnId: string;
    replyText: string;
    endSession?: boolean;
  }): Promise<{ accepted: boolean }>;
  stopVoiceSession(): Promise<VoiceSessionStatus>;
  startManualVoiceSession(): Promise<VoiceSessionStatus>;
  getVoiceSessionStatus(): Promise<VoiceSessionStatus>;
  setVoiceAssistantConfig(options: {
    voiceAssistantEnabled?: boolean;
    allowOnlineSpeechFallback?: boolean;
    greetOnWake?: boolean;
    cloudConsent?: boolean;
    cloudProvider?: string;
    cloudApiKey?: string;
  }): Promise<VoiceSessionStatus>;
  consumePendingNativeReminders(): Promise<{ reminders: Array<{ title: string; createdAt: string }> }>;
  addListener(
    eventName: "wakeWordDetected",
    listenerFunc: (event: WakeWordDetectionEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "statusChanged",
    listenerFunc: (status: WakeWordListeningStatus) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "voiceSessionState",
    listenerFunc: (event: VoiceSessionStateEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "voiceTranscript",
    listenerFunc: (event: VoiceTranscriptEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "voiceCommand",
    listenerFunc: (event: VoiceCommandEvent) => void
  ): Promise<PluginListenerHandle>;
}

const NativePlugin = registerPlugin<AtlasWakeWordNativePlugin>("AtlasWakeWord");

export const DEFAULT_UNAVAILABLE_MODEL: WakeWordModelInfo = {
  modelId: "unavailable_web_preview",
  displayName: "Native Android Only (Web Preview)",
  targetPhrase: "N/A",
  isCustomHeyAtlasModel: false,
  sourceType: "bundled_test",
  modelPathOrAsset: "wakeword/hey_jarvis_v0.1.onnx",
  isAsset: true,
  sha256: "",
  threshold: 0.5,
  cooldownMs: 1500,
  requiredEmbeddingFrames: 16,
  licenseNote: "Offline openWakeWord ONNX inference runs only inside the Android APK.",
};

export const DEFAULT_ENVIRONMENT: DeviceEnvironmentSnapshot = {
  interactive: true,
  keyguardLocked: false,
  batterySaverOn: false,
  ignoringBatteryOptimizations: false,
  networkOnline: false,
  musicActive: false,
  inCallOrCommunication: false,
  bluetoothAudioConnected: false,
};

export const EXPERIMENT_SCENARIOS: WakeWordScenarioDefinition[] = [
  {
    id: "A",
    title: "Test A: Foreground (screen on)",
    expectedHonestOutcome:
      "Baseline expected to pass reliably while the app is open on screen and the microphone foreground service is active.",
    steps: [
      "Enable Listening on this screen.",
      "Verify Android microphone indicator & persistent notification appear.",
      "Speak \"Hey Atlas\" (or the currently loaded wake phrase) 5 times.",
      "Record observed detections, missed phrases, and latency below.",
    ],
  },
  {
    id: "B",
    title: "Test B: Backgrounded app",
    expectedHonestOutcome:
      "Expected to continue listening while Foreground Service remains active; OEM battery limits may still affect extended sessions.",
    steps: [
      "Start listening, then press Home or switch to another app (without swiping Life Atlas away).",
      "Speak the active wake phrase 3 times and note whether vibration/chime/notification triggers.",
    ],
  },
  {
    id: "C",
    title: "Test C: Screen off (short window, 1–2 min)",
    expectedHonestOutcome:
      "Must be verified on Motorola Edge 50 Fusion. Partial wake lock may keep AudioRecord alive for short windows, or OEM Doze may gate it.",
    steps: [
      "Start listening while in Foreground, press the Power button to turn off the screen.",
      "Wait 60–120 seconds, then speak the active wake phrase.",
      "Record whether detection fires while screen is dark and what appears in diagnostics.",
    ],
  },
  {
    id: "D",
    title: "Test D: Screen off (prolonged idle / Doze, 10–30+ min)",
    expectedHonestOutcome:
      "Sideloaded apps without privileged hotword DSP hardware frequently get throttled or silenced in deep Doze / Motorola sleep.",
    steps: [
      "Test both with Default battery setting and with Unrestricted battery optimization.",
      "Leave phone motionless screen-off for 15–30 minutes, then speak the phrase.",
      "Record whether notification stayed alive and whether audio was still captured.",
    ],
  },
  {
    id: "E",
    title: "Test E: Locked phone (PIN / pattern / fingerprint)",
    expectedHonestOutcome:
      "Foreground chime/notification may fire, while unlocking private data or launching full activity UI stays blocked by Android Keyguard security.",
    steps: [
      "Lock device completely with biometric/PIN.",
      "Speak the active wake phrase and note whether chime/notification/assistant overlay renders on lock screen.",
    ],
  },
  {
    id: "F",
    title: "Test F: Music playback / Bluetooth headset",
    expectedHonestOutcome:
      "Android audio focus / Bluetooth SCO routing can reduce accuracy or prevent simultaneous mic capture depending on codec.",
    steps: [
      "Play music on speaker and separately on Bluetooth headset while service runs.",
      "Speak wake phrase and record false positives or missed detections.",
    ],
  },
  {
    id: "G",
    title: "Test G: Phone call / voice recorder / other mic app",
    expectedHonestOutcome:
      "Android gives higher priority to phone calls and active foreground recorders; service should pause or detect micSilenced cleanly without crashing.",
    steps: [
      "Start listening, then open Voice Recorder or place a call.",
      "Verify micSilenced / paused state updates cleanly, then finish the call and test recovery.",
    ],
  },
  {
    id: "H",
    title: "Test H: After reboot / after swiping app away",
    expectedHonestOutcome:
      "Expected NOT to auto-start silently: Android 14–16 prohibits background microphone FGS start on BOOT_COMPLETED, and START_NOT_STICKY stops on explicit task swipe.",
    steps: [
      "Swipe Life Atlas from Recents (or reboot phone).",
      "Confirm no silent background restart happens and user re-enables manually.",
    ],
  },
];

export interface WakeModelClassification {
  isTrueHeyAtlas: boolean;
  badgeText: string;
  warningText: string | null;
  spokenPhraseLabel: string;
}

export function classifyActiveWakeModel(model: WakeWordModelInfo | null | undefined): WakeModelClassification {
  if (!model || model.modelId === "unavailable_web_preview") {
    return {
      isTrueHeyAtlas: false,
      badgeText: "Android Native Required",
      warningText:
        "Wake-word audio capture and ONNX Runtime inference run only inside the Android APK build.",
      spokenPhraseLabel: "Hey Jarvis (Pipeline Test Model)",
    };
  }
  if (model.isCustomHeyAtlasModel) {
    return {
      isTrueHeyAtlas: true,
      badgeText: "Custom Hey Atlas Model Active",
      warningText: null,
      spokenPhraseLabel: model.targetPhrase || "Hey Atlas",
    };
  }
  return {
    isTrueHeyAtlas: false,
    badgeText: `TEST MODEL ONLY — "${model.targetPhrase}"`,
    warningText:
      `Active ONNX classifier is openWakeWord's bundled "${model.targetPhrase}" test model, NOT a trained "Hey Atlas" model. Say "${model.targetPhrase}" to test the pipeline, or train & import a custom hey_atlas.onnx model.`,
    spokenPhraseLabel: model.targetPhrase,
  };
}

export function isWakeWordNativeSupported(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function webUnavailableStatus(): WakeWordListeningStatus {
  return {
    running: false,
    paused: false,
    micSilenced: false,
    serviceState: "unavailable_web",
    lastStateReason: "Android native APK required for offline AudioRecord + ONNX Runtime.",
    microphoneGranted: false,
    notificationsGranted: false,
    ignoringBatteryOptimizations: false,
    loadedModel: DEFAULT_UNAVAILABLE_MODEL,
    environment: DEFAULT_ENVIRONMENT,
  };
}

function webUnavailableStats(): WakeWordStats {
  const status = webUnavailableStatus();
  return {
    ...status,
    detectionCount: 0,
    falsePositiveCount: 0,
    missedActivationCount: 0,
    framesProcessed: 0,
    lastDetectionLatencyMs: 0,
    avgDetectionLatencyMs: 0,
    lastScore: 0,
    peakScore: 0,
    micCompetitionCount: 0,
    cpuPercentEstimate: 0,
    memoryMbEstimate: 0,
    detections: [],
  };
}

function webUnavailableReport(): WakeWordDiagnosticReport {
  return {
    ...webUnavailableStats(),
    sdkInt: 0,
    deviceModel: "Browser / Non-Android Runtime",
    environment: DEFAULT_ENVIRONMENT,
    lifecycleEvents: [],
    scenarioResults: {},
    listeningStatus: webUnavailableStatus(),
    assistantRole: {
      roleAvailable: false,
      roleHeld: false,
      voiceInteractionServiceBound: false,
    },
  };
}

export const atlasWakeWordBridge = {
  isNativeSupported(): boolean {
    return isWakeWordNativeSupported();
  },

  async startListening(options?: { useAssistantSession?: boolean }): Promise<WakeWordListeningStatus> {
    if (!isWakeWordNativeSupported()) return webUnavailableStatus();
    return NativePlugin.startListening(options);
  },

  async stopListening(): Promise<WakeWordListeningStatus> {
    if (!isWakeWordNativeSupported()) return webUnavailableStatus();
    return NativePlugin.stopListening();
  },

  async pauseListening(): Promise<WakeWordListeningStatus> {
    if (!isWakeWordNativeSupported()) return webUnavailableStatus();
    return NativePlugin.pauseListening();
  },

  async resumeListening(): Promise<WakeWordListeningStatus> {
    if (!isWakeWordNativeSupported()) return webUnavailableStatus();
    return NativePlugin.resumeListening();
  },

  async getListeningStatus(): Promise<WakeWordListeningStatus> {
    if (!isWakeWordNativeSupported()) return webUnavailableStatus();
    return NativePlugin.getListeningStatus();
  },

  async getWakeWordStats(): Promise<WakeWordStats> {
    if (!isWakeWordNativeSupported()) return webUnavailableStats();
    return NativePlugin.getWakeWordStats();
  },

  async getDiagnosticReport(): Promise<WakeWordDiagnosticReport> {
    if (!isWakeWordNativeSupported()) return webUnavailableReport();
    return NativePlugin.getDiagnosticReport();
  },

  async importCustomModel(threshold = 0.5): Promise<{ imported: boolean; loadedModel: WakeWordModelInfo }> {
    if (!isWakeWordNativeSupported()) {
      throw new Error("Importing a custom .onnx model requires the Android APK build.");
    }
    return NativePlugin.importCustomModel({ threshold });
  },

  async resetToTestModel(): Promise<{ loadedModel: WakeWordModelInfo }> {
    if (!isWakeWordNativeSupported()) return { loadedModel: DEFAULT_UNAVAILABLE_MODEL };
    return NativePlugin.resetToTestModel();
  },

  async markFalsePositive(): Promise<{ falsePositiveCount: number }> {
    if (!isWakeWordNativeSupported()) return { falsePositiveCount: 0 };
    return NativePlugin.markFalsePositive();
  },

  async markMissedActivation(note = ""): Promise<{ missedActivationCount: number }> {
    if (!isWakeWordNativeSupported()) return { missedActivationCount: 0 };
    return NativePlugin.markMissedActivation({ note });
  },

  async recordScenarioResult(
    scenarioId: string,
    status: string,
    notes: string
  ): Promise<WakeWordDiagnosticReport> {
    if (!isWakeWordNativeSupported()) return webUnavailableReport();
    return NativePlugin.recordScenarioResult({ scenarioId, status, notes });
  },

  async clearDiagnostics(): Promise<WakeWordDiagnosticReport> {
    if (!isWakeWordNativeSupported()) return webUnavailableReport();
    return NativePlugin.clearDiagnostics();
  },

  async requestNotificationPermission(): Promise<WakeWordListeningStatus> {
    if (!isWakeWordNativeSupported()) return webUnavailableStatus();
    return NativePlugin.requestNotificationPermission();
  },

  async getAssistantRoleStatus(): Promise<AssistantRoleStatus> {
    if (!isWakeWordNativeSupported()) {
      return { roleAvailable: false, roleHeld: false, voiceInteractionServiceBound: false };
    }
    return NativePlugin.getAssistantRoleStatus();
  },

  async requestAssistantRole(): Promise<AssistantRoleStatus> {
    if (!isWakeWordNativeSupported()) {
      return { roleAvailable: false, roleHeld: false, voiceInteractionServiceBound: false };
    }
    return NativePlugin.requestAssistantRole();
  },

  async openAssistantSettings(): Promise<{ opened: boolean }> {
    if (!isWakeWordNativeSupported()) return { opened: false };
    return NativePlugin.openAssistantSettings();
  },

  async openBatteryOptimizationSettings(): Promise<{ opened: boolean }> {
    if (!isWakeWordNativeSupported()) return { opened: false };
    return NativePlugin.openBatteryOptimizationSettings();
  },

  async openOverlayPermissionSettings(): Promise<{ opened: boolean }> {
    if (!isWakeWordNativeSupported()) return { opened: false };
    return NativePlugin.openOverlayPermissionSettings();
  },

  async startOvernightTest(options?: {
    isBaseline?: boolean;
    useAssistantSession?: boolean;
  }): Promise<OvernightTestReport> {
    if (!isWakeWordNativeSupported()) return { isTestRunning: false };
    return NativePlugin.startOvernightTest(options);
  },

  async stopOvernightTest(): Promise<OvernightTestReport> {
    if (!isWakeWordNativeSupported()) return { isTestRunning: false };
    return NativePlugin.stopOvernightTest();
  },

  async getOvernightReport(): Promise<OvernightTestReport> {
    if (!isWakeWordNativeSupported()) return { isTestRunning: false };
    return NativePlugin.getOvernightReport();
  },

  async exportOvernightCsv(): Promise<{ csv: string }> {
    if (!isWakeWordNativeSupported()) return { csv: "# Android native APK required for Overnight Endurance Test." };
    return NativePlugin.exportOvernightCsv();
  },

  async clearOvernightData(): Promise<OvernightTestReport> {
    if (!isWakeWordNativeSupported()) return { isTestRunning: false };
    return NativePlugin.clearOvernightData();
  },

  async submitVoiceReply(options: {
    sessionId: string;
    turnId: string;
    replyText: string;
    endSession?: boolean;
  }): Promise<{ accepted: boolean }> {
    if (!isWakeWordNativeSupported()) return { accepted: false };
    return NativePlugin.submitVoiceReply(options);
  },

  async stopVoiceSession(): Promise<VoiceSessionStatus> {
    if (!isWakeWordNativeSupported()) {
      return {
        state: "IDLE",
        audioOwner: "NONE",
        voiceAssistantEnabled: false,
        onDeviceSpeechAvailable: false,
        systemSpeechAvailable: false,
        speechReason: "Android native APK required.",
      };
    }
    return NativePlugin.stopVoiceSession();
  },

  async startManualVoiceSession(): Promise<VoiceSessionStatus> {
    if (!isWakeWordNativeSupported()) {
      return {
        state: "IDLE",
        audioOwner: "NONE",
        voiceAssistantEnabled: false,
        onDeviceSpeechAvailable: false,
        systemSpeechAvailable: false,
        speechReason: "Android native APK required.",
      };
    }
    return NativePlugin.startManualVoiceSession();
  },

  async getVoiceSessionStatus(): Promise<VoiceSessionStatus> {
    if (!isWakeWordNativeSupported()) {
      return {
        state: "IDLE",
        audioOwner: "NONE",
        voiceAssistantEnabled: false,
        onDeviceSpeechAvailable: false,
        systemSpeechAvailable: false,
        speechReason: "Android native APK required.",
      };
    }
    return NativePlugin.getVoiceSessionStatus();
  },

  async setVoiceAssistantConfig(options: {
    voiceAssistantEnabled?: boolean;
    allowOnlineSpeechFallback?: boolean;
    greetOnWake?: boolean;
    cloudConsent?: boolean;
    cloudProvider?: string;
    cloudApiKey?: string;
  }): Promise<VoiceSessionStatus> {
    if (!isWakeWordNativeSupported()) {
      return {
        state: "IDLE",
        audioOwner: "NONE",
        voiceAssistantEnabled: false,
        onDeviceSpeechAvailable: false,
        systemSpeechAvailable: false,
        speechReason: "Android native APK required.",
      };
    }
    return NativePlugin.setVoiceAssistantConfig(options);
  },

  async consumePendingNativeReminders(): Promise<{ reminders: Array<{ title: string; createdAt: string }> }> {
    if (!isWakeWordNativeSupported()) return { reminders: [] };
    return NativePlugin.consumePendingNativeReminders();
  },

  async addVoiceSessionStateListener(
    listener: (event: VoiceSessionStateEvent) => void
  ): Promise<PluginListenerHandle | null> {
    if (!isWakeWordNativeSupported()) return null;
    return NativePlugin.addListener("voiceSessionState", listener);
  },

  async addVoiceTranscriptListener(
    listener: (event: VoiceTranscriptEvent) => void
  ): Promise<PluginListenerHandle | null> {
    if (!isWakeWordNativeSupported()) return null;
    return NativePlugin.addListener("voiceTranscript", listener);
  },

  async addVoiceCommandListener(
    listener: (event: VoiceCommandEvent) => void
  ): Promise<PluginListenerHandle | null> {
    if (!isWakeWordNativeSupported()) return null;
    return NativePlugin.addListener("voiceCommand", listener);
  },

  async addWakeWordDetectedListener(
    listener: (event: WakeWordDetectionEvent) => void
  ): Promise<PluginListenerHandle | null> {
    if (!isWakeWordNativeSupported()) return null;
    return NativePlugin.addListener("wakeWordDetected", listener);
  },

  async addStatusChangedListener(
    listener: (status: WakeWordListeningStatus) => void
  ): Promise<PluginListenerHandle | null> {
    if (!isWakeWordNativeSupported()) return null;
    return NativePlugin.addListener("statusChanged", listener);
  },
};
