/** Kept for startup compatibility. Opening Atlas must never reset user storage. */
export const CLEAN_EPOCH='atlas-cloud-clean-20261102-v2';
export async function ensureCleanStart():Promise<void>{
 // Historical epoch values are preserved; recovery must be an explicit user operation.
}
