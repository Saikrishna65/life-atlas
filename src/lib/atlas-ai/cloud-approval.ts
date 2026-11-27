/** A separate, foreground-only online request. No vault/session arguments are accepted. */
export const CLOUD_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const SYSTEM_TEXT = 'Answer the supplied question directly. You have no access to Life Atlas records, tools, memories, or prior conversations. Do not claim actions were performed.';
export interface CloudPreview {
  readonly id: string;
  readonly expiresAt: number;
  readonly endpoint: string;
  readonly body: string;
}
export class CloudApprovalGate {
  private pending: CloudPreview | null = null;
  constructor(private readonly now: () => number = Date.now) {}
  preview(model: string, question: string): CloudPreview {
    this.cancel();
    const id = model.trim();
    const text = question.trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}:free$/.test(id)) {
      throw new Error('Choose a specific OpenRouter model ending in :free.');
    }
    if (!text || text.length > 8000) throw new Error('Enter a question of at most 8,000 characters.');
    const body = JSON.stringify({
      model: id,
      messages: [{role: 'system', content: SYSTEM_TEXT}, {role: 'user', content: text}],
      max_tokens: 512, stream: false,
      provider: {allow_fallbacks: false, max_price: {prompt: 0, completion: 0}, data_collection: 'deny', zdr: true},
    });
    this.pending = Object.freeze({id: crypto.randomUUID(), expiresAt: this.now() + 60000, endpoint: CLOUD_ENDPOINT, body});
    return this.pending;
  }
  cancel(): void { this.pending = null; }
  async execute(id: string, apiKey: string, signal: AbortSignal, transport: typeof fetch = fetch): Promise<string> {
    const approved = this.pending;
    // Consume before any asynchronous work. No retries and no reusable approvals.
    this.pending = null;
    if (!approved || approved.id !== id || this.now() >= approved.expiresAt || signal.aborted) throw new Error('Review and approve a fresh request.');
    const key = apiKey.trim();
    if (!key || key.length > 512 || /[\r\n]/.test(key)) throw new Error('A valid session API key is required.');
    const response = await transport(approved.endpoint, {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + key},
      body: approved.body, signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store',
    });
    if (!response.ok) throw new Error('Online request failed (HTTP ' + response.status + '). No fallback or automatic retry.');
    const payload = await response.json() as {choices?: Array<{message?: {content?: unknown}}>};
    if (signal.aborted) throw new Error('Request canceled.');
    const answer = payload.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('The provider returned no text.');
    return answer.trim().slice(0, 24000);
  }
}
