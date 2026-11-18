/** Atlas-only encrypted storage. No plaintext fallback, global key, or cloud sync. */
export interface Message {
  id: string; role: 'user' | 'assistant' | 'notice'; text: string; at: string;
  memoryIds?: string[]; status?: 'complete' | 'interrupted';
}
export interface Conversation { id: string; title: string; createdAt: string; updatedAt: string; messages: Message[]; }
export interface Memory { id: string; text: string; createdAt: string; updatedAt: string; }
export interface Personality { tone: string; behavior: string; }
export interface AtlasData { version: 1; conversations: Conversation[]; memories: Memory[]; personality: Personality; }
interface Envelope { format: 'atlas-local-encrypted-v1'; revision: number; salt: string; iv: string; ciphertext: string; }
const DB = 'life_atlas_ai_local_v1';
const ITERATIONS = 600000;
const MAX_BYTES = 16 * 1024 * 1024;
const initial = (): AtlasData => ({version: 1, conversations: [], memories: [], personality: {tone: 'Calm and concise', behavior: 'Ask when uncertain. Explain action results clearly.'}});
const base64 = (bytes: Uint8Array) => { let text = ''; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); };
const bytes = (text: string) => Uint8Array.from(atob(text), ch => ch.charCodeAt(0));
function bounded(text: string, max: number) { if (!text.trim() || text.length > max) throw new Error(`Enter between 1 and ${max} characters.`); return text.trim(); }
function validate(data: AtlasData): AtlasData {
  if (data?.version !== 1 || !Array.isArray(data.conversations) || !Array.isArray(data.memories) || !data.personality || typeof data.personality.tone !== 'string' || typeof data.personality.behavior !== 'string') throw new Error('Unsupported Atlas storage version. Existing data was preserved.');
  bounded(data.personality.tone,120); bounded(data.personality.behavior,1000);
  const ids = new Set<string>();
  for (const c of data.conversations) {
    if (!c.id || ids.has(c.id) || typeof c.title !== 'string' || !Array.isArray(c.messages) || !Number.isFinite(Date.parse(c.createdAt)) || !Number.isFinite(Date.parse(c.updatedAt))) throw new Error('Invalid conversation archive.');
    bounded(c.title,120); ids.add(c.id);
    const messageIds = new Set<string>();
    for (const m of c.messages) { if (!m.id || !['user','assistant','notice'].includes(m.role) || typeof m.text !== 'string' || !Number.isFinite(Date.parse(m.at))) throw new Error('Invalid message archive.');
      bounded(m.text,32000);
      if (messageIds.has(m.id) || (m.memoryIds !== undefined && (!Array.isArray(m.memoryIds) || m.memoryIds.some(id => typeof id !== 'string'))) || (m.status !== undefined && !['complete','interrupted'].includes(m.status))) throw new Error('Invalid message metadata.');
      messageIds.add(m.id);
    }
  }
  for (const m of data.memories) { if (!m.id || ids.has(m.id) || typeof m.text !== 'string' || !Number.isFinite(Date.parse(m.createdAt)) || !Number.isFinite(Date.parse(m.updatedAt))) throw new Error('Invalid memory archive.'); bounded(m.text,2000); ids.add(m.id); }
  return data;
}
async function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('vault')) r.result.createObjectStore('vault'); };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Close other Atlas windows and retry. No data was reset.'));
  });
}
async function readEnvelope(): Promise<Envelope | undefined> {
  const db = await openDB();
  try { return await new Promise<Envelope | undefined>((resolve, reject) => { const r = db.transaction('vault').objectStore('vault').get('content'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  finally { db.close(); }
}
async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  if (passphrase.length < 12 || passphrase.length > 1024) throw new Error('Use a unique passphrase of at least 12 characters. Keep it offline; it cannot be reset.');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256'}, material, {name: 'AES-GCM', length: 256}, false, ['encrypt','decrypt']);
}
const aad = new TextEncoder().encode('atlas-local-encrypted-v1:600000');
async function seal(data: AtlasData, key: CryptoKey, salt: string, revision: number): Promise<Envelope> {
  const plaintext = new TextEncoder().encode(JSON.stringify(validate(data)));
  if (plaintext.length > MAX_BYTES) throw new Error('Atlas storage is full. Export an encrypted archive before removing old conversations.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: aad}, key, plaintext);
  return {format: 'atlas-local-encrypted-v1', revision, salt, iv: base64(iv), ciphertext: base64(new Uint8Array(encrypted))};
}
async function unseal(envelope: Envelope, passphrase: string) {
  if (envelope?.format !== 'atlas-local-encrypted-v1' || typeof envelope.salt !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > MAX_BYTES * 1.4 || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1) throw new Error('Unsupported encrypted archive. Existing data was preserved.');
  const salt = bytes(envelope.salt), iv = bytes(envelope.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid encryption metadata.');
  const key = await derive(passphrase, salt);
  try {
    const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv, additionalData: aad}, key, bytes(envelope.ciphertext));
    return {key, data: validate(JSON.parse(new TextDecoder().decode(plain)))};
  } catch { throw new Error('Could not unlock Atlas. Check the passphrase or archive integrity. No data was changed.'); }
}
async function commit(envelope: Envelope, expected: number) {
  const db = await openDB();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite');
    const store = tx.objectStore('vault'), request = store.get('content');
    let conflict = false;
    request.onsuccess = () => { if ((request.result?.revision ?? 0) !== expected) { conflict = true; tx.abort(); } else store.put(envelope, 'content'); };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new Error(conflict ? 'Atlas changed in another window. Lock and unlock to reload before retrying.' : 'Write interrupted. The last saved Atlas data is intact.'));
    tx.onerror = () => reject(tx.error ?? new Error('Write interrupted. The last saved Atlas data is intact.'));
  }); } finally { db.close(); }
}
export class AtlasStore {
  private key: CryptoKey | null = null;
  private envelope: Envelope | undefined;
  private data: AtlasData | null = null;
  private serial: Promise<unknown> = Promise.resolve();
  private epoch = 0;
  static async exists() { return !!await readEnvelope(); }
  async unlock(passphrase: string) {
    this.lock();
    const epoch = this.epoch;
    const envelope = await readEnvelope();
    const salt = envelope?.salt ?? base64(crypto.getRandomValues(new Uint8Array(16)));
    const result = envelope ? await unseal(envelope, passphrase) : {key: await derive(passphrase, bytes(salt)), data: initial()};
    if (this.epoch !== epoch) throw new Error('Atlas was locked.');
    if (!envelope) {
      const created = await seal(result.data, result.key, salt, 1);
      if (this.epoch !== epoch) throw new Error('Atlas was locked.');
      await commit(created, 0);
      if (this.epoch !== epoch) throw new Error('Atlas was locked.');
      this.envelope = created;
    } else this.envelope = envelope;
    this.key = result.key; this.data = result.data;
  }
  lock() { this.epoch++; this.key = null; this.data = null; this.envelope = undefined; }
  snapshot() { if (!this.data || !this.key) throw new Error('Unlock encrypted Atlas storage first.'); return structuredClone(this.data); }
  private change<T>(fn: (data: AtlasData) => T): Promise<T> {
    const epoch = this.epoch;
    const work = this.serial.catch(() => {}).then(async () => {
      if (epoch !== this.epoch || !this.key || !this.envelope) throw new Error('Atlas is locked.');
      const copy = this.snapshot(), result = fn(copy);
      const next = await seal(copy, this.key, this.envelope.salt, this.envelope.revision + 1);
      if (epoch !== this.epoch) throw new Error('Atlas is locked.');
      await commit(next, this.envelope.revision);
      if (epoch === this.epoch) { this.data = copy; this.envelope = next; }
      return result;
    });
    this.serial = work; return work;
  }
  sessions(query = '') { const q = query.toLocaleLowerCase(); return this.snapshot().conversations.filter(c => `${c.title} ${c.messages.map(m => m.text).join(' ')}`.toLocaleLowerCase().includes(q)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map(({messages, ...c}) => ({...c, count: messages.length})); }
  history(id: string, offset = 0, limit = 30) {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid history page.');
    const messages = this.snapshot().conversations.find(c => c.id === id)?.messages ?? [];
    const end = Math.max(0, messages.length - offset), start = Math.max(0, end - limit);
    return {messages: messages.slice(start, end), hasMore: start > 0};
  }
  create(title = 'New conversation') { return this.change(data => { const id = crypto.randomUUID(), at = new Date().toISOString(); data.conversations.push({id, title: bounded(title, 120), createdAt: at, updatedAt: at, messages: []}); return id; }); }
  rename(id: string, title: string) { return this.change(data => { const c = data.conversations.find(c => c.id === id); if (!c) throw new Error('Conversation no longer exists.'); c.title = bounded(title,120); c.updatedAt = new Date().toISOString(); }); }
  deleteConversation(id: string) { return this.change(data => { data.conversations = data.conversations.filter(c => c.id !== id); }); }
  append(id: string, message: Omit<Message,'id'|'at'>) { return this.change(data => { const c = data.conversations.find(c => c.id === id); if (!c) throw new Error('Conversation no longer exists.'); bounded(message.text, 32000); const at = new Date().toISOString(); c.messages.push({...message, id: crypto.randomUUID(), at}); c.updatedAt = at; }); }
  memories(query = '') { return this.snapshot().memories.filter(m => m.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())); }
  saveMemory(text: string, id?: string) { return this.change(data => { const at = new Date().toISOString(), value = bounded(text, 2000); const existing = id ? data.memories.find(m => m.id === id) : undefined; if (id && !existing) throw new Error('Memory no longer exists.'); if (existing) { existing.text = value; existing.updatedAt = at; return existing.id; } const next = {id: crypto.randomUUID(), text: value, createdAt: at, updatedAt: at}; data.memories.push(next); return next.id; }); }
  deleteMemory(id: string) { return this.change(data => { data.memories = data.memories.filter(m => m.id !== id); }); }
  setPersonality(value: Personality) { return this.change(data => { data.personality = {tone: bounded(value.tone,120), behavior: bounded(value.behavior,1000)}; }); }
  async exportArchive() { await this.serial; this.snapshot(); return new Blob([JSON.stringify(this.envelope)], {type: 'application/octet-stream'}); }
  async importArchive(blob: Blob, passphrase: string) {
    if (blob.size > MAX_BYTES * 1.5) throw new Error('Archive exceeds the import limit.');
    const {data: imported} = await unseal(JSON.parse(await blob.text()), passphrase);
    // Merge under fresh IDs, never replace existing conversations or memories.
    return this.change(data => { for (const c of imported.conversations) { c.id = crypto.randomUUID(); c.messages = c.messages.map(m => ({...m, id: crypto.randomUUID(), memoryIds: []})); data.conversations.push(c); } for (const m of imported.memories) data.memories.push({...m, id: crypto.randomUUID()}); });
  }
}
