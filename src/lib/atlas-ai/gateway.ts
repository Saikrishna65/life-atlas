export type Permission = 'music.read' | 'music.control' | 'finance.read' | 'finance.write' | 'trips.read' | 'trips.write' | 'navigate';
export type AtlasAction =
  | {kind: 'music.search'; query: string}
  | {kind: 'music.play'; id: string}
  | {kind: 'music.pause' | 'music.resume' | 'music.next' | 'music.state'}
  | {kind: 'music.playlist'; id: string}
  | {kind: 'finance.summary'}
  | {kind: 'finance.expense'; accountId: string; amountPaise: number; description: string}
  | {kind: 'finance.categorize'; id: string; categoryId: string}
  | {kind: 'trips.search'; query: string}
  | {kind: 'trips.itinerary' | 'trips.open'; id: string}
  | {kind: 'trips.editTitle'; tripId: string; dayId: string; title: string}
  | {kind: 'navigate'; section: 'home' | 'music' | 'finance' | 'trips'};
export interface Receipt {id: string; action: AtlasAction; at: string; result: unknown;}
export interface ActionProposal {token: string; action: AtlasAction; expiresAt: number; description: string;}
export interface LocalAdapter {
  execute(action: AtlasAction, guard: () => void): Promise<unknown>;
  /** Capture an optimistic precondition and commit closure using existing services. */
  prepare(action: AtlasAction, guard: () => void): Promise<{description: string; commit: () => Promise<unknown>}>;
}
function text(value: unknown, max = 180) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error('Invalid action field.'); return value.trim(); }
export function parseAction(value: unknown): AtlasAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Atlas action.');
  const a = value as Record<string, unknown>;
  let result: AtlasAction;
  switch (a.kind) {
    case 'music.search': case 'trips.search': result = {kind: a.kind, query: text(a.query,120)}; break;
    case 'music.play': case 'music.playlist': case 'trips.itinerary': case 'trips.open': result = {kind: a.kind, id: text(a.id)}; break;
    case 'music.pause': case 'music.resume': case 'music.next': case 'music.state': case 'finance.summary': result = {kind: a.kind}; break;
    case 'finance.expense':
      if (!Number.isSafeInteger(a.amountPaise) || (a.amountPaise as number) <= 0 || (a.amountPaise as number) > 100000000) throw new Error('Expense must be between 0.01 and 1,000,000 in the account currency.');
      result = {kind: a.kind, accountId: text(a.accountId), amountPaise: a.amountPaise as number, description: text(a.description,240)}; break;
    case 'finance.categorize': result = {kind: a.kind, id: text(a.id), categoryId: text(a.categoryId)}; break;
    case 'trips.editTitle': result = {kind: a.kind, tripId: text(a.tripId), dayId: text(a.dayId), title: text(a.title,120)}; break;
    case 'navigate':
      if (!['home','music','finance','trips'].includes(String(a.section))) throw new Error('Unknown Atlas section.');
      result = {kind: a.kind, section: a.section as 'home' | 'music' | 'finance' | 'trips'}; break;
    default: throw new Error('Unsupported Atlas action.');
  }
  if (Object.keys(a).some(key => !(key in result))) throw new Error('Unexpected action fields.');
  return result;
}
export function permissionFor(action: AtlasAction): Permission {
  if (action.kind === 'navigate') return 'navigate';
  if (action.kind.startsWith('finance.')) return action.kind === 'finance.summary' ? 'finance.read' : 'finance.write';
  if (action.kind.startsWith('trips.')) return action.kind === 'trips.editTitle' ? 'trips.write' : 'trips.read';
  return ['music.search','music.state'].includes(action.kind) ? 'music.read' : 'music.control';
}
export class ActionGateway {
  private pending = new Map<string, {session: string; proposal: ActionProposal; commit: () => Promise<unknown>}>();
  private generation = 0;
  constructor(private adapter: LocalAdapter, private permissions: () => ReadonlySet<Permission>, private authorize: () => Promise<void>, private available: () => boolean = () => true, private now = Date.now) {}
  private check(action: AtlasAction) { if (!this.available()) throw new Error('Unlock Atlas and wait for recovery to finish.'); if (!this.permissions().has(permissionFor(action))) throw new Error(`Permission required: ${permissionFor(action)}`); }
  async request(session: string, raw: unknown): Promise<{result?: unknown; proposal?: ActionProposal}> {
    text(session); const action = Object.freeze(parseAction(raw)), generation = this.generation;
    const deadline = this.now() + 60000;
    const guard = () => { this.check(action); if (generation !== this.generation || this.now() >= deadline) throw new Error('Atlas action was canceled or expired.'); };
    guard(); await this.authorize(); guard();
    if (generation !== this.generation) throw new Error('Atlas action was canceled.');
    if (['finance.expense','finance.categorize','trips.editTitle'].includes(action.kind)) {
      const prepared = await this.adapter.prepare(action, guard);
      if (generation !== this.generation) throw new Error('Atlas action was canceled.');
      this.check(action);
      const proposal = {token: crypto.randomUUID(), action, expiresAt: deadline, description: prepared.description};
      this.pending.set(proposal.token, {session, proposal: structuredClone(proposal), commit: prepared.commit});
      return {proposal: structuredClone(proposal)};
    }
    const result = await this.adapter.execute(action, guard);
    guard(); // Do not publish late read results after permission revocation or lock.
    return {result};
  }
  async confirm(session: string, token: string): Promise<Receipt> {
    const pending = this.pending.get(token); const generation = this.generation;
    if (!pending || pending.session !== session || pending.proposal.expiresAt <= this.now()) throw new Error('Confirmation expired or does not match this conversation.');
    this.pending.delete(token); // Consume before awaits to prevent simultaneous confirmations.
    this.check(pending.proposal.action); await this.authorize(); this.check(pending.proposal.action);
    if (generation !== this.generation || pending.proposal.expiresAt <= this.now()) throw new Error('Confirmation was canceled or expired.');
    const result = await pending.commit();
    return {id: crypto.randomUUID(), action: pending.proposal.action, at: new Date(this.now()).toISOString(), result};
  }
  cancel(token: string) { this.pending.delete(token); }
  revoke() { this.generation++; this.pending.clear(); }
}
