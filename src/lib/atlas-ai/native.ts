import {Capacitor, registerPlugin, type PluginListenerHandle} from '@capacitor/core';
export interface RuntimeStatus {available: boolean; reason: string; engine: string;}
interface AtlasNativePlugin {
  runtimeStatus(): Promise<RuntimeStatus>;
  generate(options: {requestId: string; prompt: string; maxTokens: number}): Promise<void>;
  cancel(options: {requestId: string}): Promise<void>;
  unload(): Promise<void>;
  voiceStatus(): Promise<{recognition: boolean; speech: boolean; reason: string}>;
  listen(options: {requestId: string}): Promise<void>;
  speak(options: {text: string}): Promise<void>;
  stopVoice(): Promise<void>;
  addListener(event: 'token' | 'voice', listener: (event: {requestId?: string; token?: string; state?: string; text?: string; error?: string}) => void): Promise<PluginListenerHandle>;
}
export const AtlasNative = registerPlugin<AtlasNativePlugin>('AtlasLocalAI');
export async function requireNativeTrust() {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('BiometricAuthNative')) throw new Error('Local module actions require Android device authentication. Browser access is disabled.');
  const {BiometricAuth, AndroidBiometryStrength} = await import('@aparajita/capacitor-biometric-auth');
  await BiometricAuth.authenticate({reason: 'Authorize this Atlas local action', androidTitle: 'Atlas local access', androidSubtitle: 'Verify device owner', allowDeviceCredential: true, androidBiometryStrength: AndroidBiometryStrength.strong});
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') throw new Error('Return to Atlas to authorize this action.');
}
export async function runtimeStatus(): Promise<RuntimeStatus> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AtlasLocalAI')) return {available: false, engine: 'none', reason: 'On-device inference is unavailable. This build has no local model runtime; prompts stay on this device.'};
  return AtlasNative.runtimeStatus();
}
export async function generateLocal(prompt: string, signal: AbortSignal, onToken: (token: string) => void) {
  if (prompt.length > 24000) throw new Error('Conversation context exceeds the local model limit.');
  const status = await runtimeStatus(); if (!status.available) throw new Error(status.reason);
  if (signal.aborted) throw new Error('Generation canceled.');
  const requestId = crypto.randomUUID();
  const listener = await AtlasNative.addListener('token', event => { if (event.requestId === requestId && !signal.aborted && typeof event.token === 'string') onToken(event.token); });
  let rejectCanceled: (reason: Error) => void = () => {};
  const canceled = new Promise<never>((_resolve, reject) => { rejectCanceled = reject; });
  const cancel = () => { void AtlasNative.cancel({requestId}).catch(() => {}); rejectCanceled(new Error('Generation canceled.')); };
  signal.addEventListener('abort', cancel, {once: true});
  try { if (signal.aborted) throw new Error('Generation canceled.'); await Promise.race([AtlasNative.generate({requestId, prompt, maxTokens: 512}), canceled]); }
  finally { signal.removeEventListener('abort', cancel); await listener.remove(); }
}
