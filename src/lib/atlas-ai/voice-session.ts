/** Discards callbacks from canceled recordings and previous conversations. */
export class VoiceSession {
  private current: string | null = null;
  begin() { this.current = crypto.randomUUID(); return this.current; }
  accept(id: string | undefined) { return !!id && id === this.current; }
  stop() { this.current = null; }
}
