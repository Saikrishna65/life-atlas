/** Only reviewed, immutable entries belong here. No fabricated digest or mutable download URL. */
export interface ModelEntry {
  id: string; name: string; repository: string; revision: string; filename: string;
  sha256: string; bytes: number; license: string; licenseUrl: string; contextTokens: number;
}
export function validateModelEntry(input: ModelEntry): Readonly<ModelEntry> {
  if (!/^[a-z0-9-]{1,80}$/.test(input.id) || !/^[\w.-]+\/[\w.-]+$/.test(input.repository) || !/^[a-f0-9]{40}$/.test(input.revision)) throw new Error('Immutable model identity required.');
  if (!/^[\w.-]+\.gguf$/.test(input.filename) || !/^[a-f0-9]{64}$/.test(input.sha256) || /^0+$/.test(input.sha256)) throw new Error('Verified GGUF filename and SHA-256 required.');
  if (!Number.isSafeInteger(input.bytes) || input.bytes <= 0 || input.bytes > 1500000000) throw new Error('Model exceeds the supported storage budget.');
  if (!Number.isInteger(input.contextTokens) || input.contextTokens < 512 || input.contextTokens > 2048) throw new Error('Unsupported context limit.');
  if (!input.name.trim() || !input.license.trim()) throw new Error('Verified model name and license required.');
  const license = new URL(input.licenseUrl);
  if (license.protocol !== 'https:' || license.username || license.password) throw new Error('HTTPS license provenance required.');
  return Object.freeze({...input});
}
// Deliberately empty: source/revision/license/digest have not been independently verified.
// Validation checks structure; it does not establish provenance or approve an artifact.
export const MODEL_CATALOGUE: readonly Readonly<ModelEntry>[] = Object.freeze([]);
export function requireCataloguedModel(id: string) {
  const entry = MODEL_CATALOGUE.find(m => m.id === id);
  if (!entry) throw new Error('No verified catalogue entry is available. Downloads are disabled.');
  return entry;
}
export function modelDownloadUrl(entry: ModelEntry) {
  const valid = validateModelEntry(entry);
  return `https://huggingface.co/${valid.repository}/resolve/${valid.revision}/${valid.filename}`;
}
export function requiredInstallBytes(entry: ModelEntry) {
  validateModelEntry(entry);
  // Reserve temporary + committed copies and headroom; keep the previous verified model intact.
  return entry.bytes * 2 + 256 * 1024 * 1024;
}
