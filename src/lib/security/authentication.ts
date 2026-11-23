import { Capacitor, registerPlugin } from "@capacitor/core";
// Retire the earlier app-specific plaintext PIN; device verification owns enabled checks.
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("life_atlas_guardian_pin");
  } catch {
    /* Restricted storage must not create a plaintext fallback. */
  }
}
export const authenticationScopes = [
  "app",
  "gallery",
  "privateSections",
  "cloudCredentials",
  "publishing",
  "deletion",
  "backups",
  "aiActions",
] as const;
export type AuthenticationScope = (typeof authenticationScopes)[number];
export type AuthenticationPolicy = Record<AuthenticationScope, boolean>;
export const defaultAuthenticationPolicy = (): AuthenticationPolicy =>
  Object.fromEntries(
    authenticationScopes.map((key) => [key, false]),
  ) as AuthenticationPolicy;
export function validateAuthenticationPolicy(
  value: unknown,
): AuthenticationPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Authentication settings are unavailable.");
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) => !authenticationScopes.includes(key as AuthenticationScope),
    )
  )
    throw Error("Unknown authentication setting.");
  const result = defaultAuthenticationPolicy();
  for (const key of authenticationScopes) {
    if (record[key] !== undefined && typeof record[key] !== "boolean")
      throw Error("Invalid authentication setting.");
    result[key] = record[key] === true;
  }
  return result;
}
interface SecurityPlugin {
  getPolicy(): Promise<AuthenticationPolicy>;
  setPolicy(input: {
    policy: AuthenticationPolicy;
  }): Promise<AuthenticationPolicy>;
  authorize(input: { scope: AuthenticationScope }): Promise<void>;
  lock(): Promise<void>;
  openAssistant(): Promise<{
    revision: number;
    data?: import("../atlas-ai/storage").AtlasData;
  }>;
  saveAssistant(input: {
    data: import("../atlas-ai/storage").AtlasData;
    revision: number;
  }): Promise<{
    revision: number;
    data: import("../atlas-ai/storage").AtlasData;
  }>;
}
export const Security = registerPlugin<SecurityPlugin>("AtlasSecurity");
export const supportsAuthenticationSettings = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("AtlasSecurity");
let prompts = 0;
export const authenticationInProgress = () => prompts > 0;
export async function securityOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  prompts++;
  try {
    return await operation();
  } finally {
    prompts--;
  }
}
export async function getAuthenticationPolicy() {
  if (!Capacitor.isNativePlatform()) return defaultAuthenticationPolicy();
  if (!supportsAuthenticationSettings())
    throw Error("Authentication settings need the updated Android app.");
  return validateAuthenticationPolicy(await Security.getPolicy());
}
export async function authorize(scope: AuthenticationScope) {
  if (!Capacitor.isNativePlatform()) return;
  if (!supportsAuthenticationSettings())
    throw Error("This operation needs the updated Android app.");
  await securityOperation(() => Security.authorize({ scope }));
}
export async function saveAuthenticationPolicy(policy: AuthenticationPolicy) {
  const next = validateAuthenticationPolicy(policy);
  if (!supportsAuthenticationSettings())
    throw Error("Use the updated Android app to change authentication.");
  const saved = validateAuthenticationPolicy(
    await securityOperation(() => Security.setPolicy({ policy: next })),
  );
  window.dispatchEvent(new Event("atlas:authentication-policy"));
  return saved;
}
export function routeAuthenticationScope(
  path: string,
): AuthenticationScope | undefined {
  if (/^\/secret\/gallery(?:\/|$)/.test(path)) return "gallery";
  if (/^\/secret\/(?:vault|music|finance|atlas)(?:\/|$)/.test(path))
    return "privateSections";
}
