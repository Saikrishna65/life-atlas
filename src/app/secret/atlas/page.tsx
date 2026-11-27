'use client';
import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
import {Capacitor, type PluginListenerHandle} from '@capacitor/core';
import {App} from '@capacitor/app';
import {VoiceSession} from '@/lib/atlas-ai/voice-session';
import ModelManager from '@/components/secret/ModelManager';
import AtlasOnlineRequest from '@/components/secret/AtlasOnlineRequest';
import {useMusicPlayer} from '@/lib/music/MusicPlayerContext';
import {isControlRestoreActive} from '@/lib/control-room/maintenance';
import {assembleLocalContext} from '@/lib/atlas-ai/context';
import {AtlasStore, type AtlasData, type Message} from '@/lib/atlas-ai/storage';
import {ActionGateway, type ActionProposal, type Permission} from '@/lib/atlas-ai/gateway';
import {createLocalAdapters} from '@/lib/atlas-ai/local-adapters';
import {AtlasNative, generateLocal, requireNativeTrust, runtimeStatus, type RuntimeStatus} from '@/lib/atlas-ai/native';
import {resolveNativeUtility} from '@/lib/atlas-ai/native-utilities';
import {completeReminder, createReminder, deleteReminder, listReminders, type AtlasReminder} from '@/lib/atlas-ai/reminders';
import {loadPersonalityConfig, savePersonalityConfig, type AtlasPersonalityConfig, type ResponseLengthPref} from '@/lib/atlas-ai/personality';
import {deletePersistentMemory, loadPersistentMemories, resetPersistentMemories, savePersistentMemory, type PersistentMemoryItem} from '@/lib/atlas-ai/memory';
import {
  atlasWakeWordBridge,
  getEncryptedMemoriesNative,
  getVoiceLatencyMetricsNative,
  isWakeWordNativeSupported,
  saveEncryptedMemoriesNative,
  saveVoicePersonalityNative,
  type VoiceLatencyMetrics,
  type VoiceSessionStateName,
} from '@/lib/wakeword/atlasWakeWord';
import styles from './atlas.module.css';
type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
const permissionsList: Permission[] = ['music.read','music.control','finance.read','finance.write','trips.read','trips.write','reminders.read','reminders.write','control.read','navigate'];
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The local operation failed.';
const subscribePlatform=()=>()=>{};
export default function AtlasPage() {
  const router=useRouter();
  const native=useSyncExternalStore(subscribePlatform,()=>Capacitor.isNativePlatform(),()=>null);
  const [verified,setVerified]=useState(false),[checking,setChecking]=useState(false),[failure,setFailure]=useState('');
  useEffect(()=>{let alive=true;let handle:PluginListenerHandle|undefined;if(Capacitor.isNativePlatform())void App.addListener('appStateChange',event=>{if(alive&&!event.isActive)setVerified(false);}).then(h=>{if(alive)handle=h;else void h.remove();});return()=>{alive=false;if(handle)void handle.remove();};},[]);
  function close(){if(window.history.length>1)router.back();else router.replace('/secret');}
  if(native===null)return <p role="status">Opening Atlas…</p>;
  if(native&&!verified)return <section data-atlas-security-screen className={styles.shell}><button onClick={close}>Back to vault</button><h1>Unlock Atlas on this device</h1><p>Verify device ownership before accessing the assistant. Your encrypted conversations still require their passphrase.</p><button disabled={checking} onClick={()=>{setChecking(true);setFailure('');void requireNativeTrust().then(()=>setVerified(true)).catch(e=>setFailure(errorText(e))).finally(()=>setChecking(false));}}>Verify device</button>{failure&&<p role="alert">{failure}</p>}</section>;
  return <><div className={styles.back}><button onClick={close}>Back to vault</button></div><AtlasContent/></>;
}
function AtlasContent() {
  const router = useRouter();
  const player = useMusicPlayer();
  const playerRef = useRef(player);
  useEffect(() => {playerRef.current = player;}, [player]);
  const store = useRef(new AtlasStore());
  const gateway = useRef<ActionGateway | null>(null);
  const granted = useRef(new Set<Permission>());
  const unlocked = useRef(false);
  const voiceSession = useRef(new VoiceSession());
  const [readReplies, setReadReplies] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const [permissionState, setPermissionState] = useState(new Set<Permission>());
  const [data, setData] = useState<AtlasData | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [repeat, setRepeat] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [active, setActive] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [memorySearch, setMemorySearch] = useState('');
  const [selectedMemories, setSelectedMemories] = useState(new Set<string>());
  const [memoryDraft, setMemoryDraft] = useState('');
  const [editingMemory, setEditingMemory] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [stream, setStream] = useState('');
  const [limit, setLimit] = useState(30);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [state, setState] = useState<OrbState>('idle');
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [voice, setVoice] = useState({recognition: false, speech: false, reason: 'Offline voice requires the Android app.'});
  const [proposal, setProposal] = useState<ActionProposal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{kind: 'conversation' | 'memory'; id: string} | null>(null);
  const [actionKind, setActionKind] = useState('music.search');
  const [query, setQuery] = useState('');
  const [recordId, setRecordId] = useState('');
  const [extraId, setExtraId] = useState('');
  const [amount, setAmount] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPhrase, setImportPhrase] = useState('');
  const [reminders, setReminders] = useState<AtlasReminder[]>(() => listReminders(false));
  const [reminderDraft, setReminderDraft] = useState('');
  const [wakeVoiceState, setWakeVoiceState] = useState<VoiceSessionStateName>('IDLE');
  const [wakeTranscript, setWakeTranscript] = useState('');
  const [companionTraits, setCompanionTraits] = useState<AtlasPersonalityConfig>(() => loadPersonalityConfig());
  const [keystoreMemories, setKeystoreMemories] = useState<PersistentMemoryItem[]>([]);
  const [keystoreMemDraft, setKeystoreMemDraft] = useState('');
  const [latencyMetrics, setLatencyMetrics] = useState<VoiceLatencyMetrics | null>(null);
  const refreshReminders = useCallback(() => setReminders(listReminders(false)), []);
  const refresh = useCallback(() => { if (unlocked.current) setData(store.current.snapshot()); }, []);
  const cancelProposal = useCallback(() => { gateway.current?.revoke(); setProposal(null); }, []);
  const stop = useCallback(() => { voiceSession.current.stop(); controller.current?.abort(); if (Capacitor.isPluginAvailable('AtlasLocalAI')) void AtlasNative.stopVoice().catch(() => {}); setState('idle'); }, []);
  const lock = useCallback(() => {
    stop(); unlocked.current = false; store.current.lock(); gateway.current?.revoke(); granted.current.clear(); setPermissionState(new Set());
    setData(null); setDraft(''); setMemoryDraft(''); setStream(''); setPassphrase(''); setRepeat(''); setImportPhrase(''); setImportFile(null); setProposal(null); setDeleteTarget(null); setSelectedMemories(new Set()); setTitle(''); setQuery(''); setRecordId(''); setExtraId(''); setAmount(''); setError(''); setBusy(false); setExists(null);
    void AtlasStore.exists().then(setExists).catch(() => setError('Could not inspect local encrypted storage.'));
  }, [stop]);
  useEffect(() => {
    const currentStore = store.current;
    let alive = true; let listener: PluginListenerHandle | undefined; let appListener: PluginListenerHandle | undefined;
    if (Capacitor.isNativePlatform()) void App.addListener('appStateChange', event => {if (alive && !event.isActive) lock();}).then(handle => {if (alive) appListener = handle; else void handle.remove();});
    void AtlasStore.exists().then(value => { if (alive) setExists(value); }).catch(e => { if (alive) setError(errorText(e)); });
    void runtimeStatus().then(value => { if (alive) setRuntime(value); }).catch(e => { if (alive) setError(errorText(e)); });
    if (Capacitor.isPluginAvailable('AtlasLocalAI')) {
      void AtlasNative.voiceStatus().then(value => { if (alive) setVoice(value); }).catch(() => {});
      void AtlasNative.addListener('voice', event => {
        if (!alive || !unlocked.current) return;
        if (event.text && voiceSession.current.accept(event.requestId)) setDraft(event.text.slice(0,8000));
        if (event.error) setError(event.error);
        if (['idle','listening','thinking','speaking','error'].includes(event.state ?? '')) setState(event.state as OrbState);
      }).then(handle => { if (alive) listener = handle; else void handle.remove(); });
    }
    const hide = () => { if (document.visibilityState === 'hidden') lock(); };
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', lock);
    return () => { alive = false; document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', lock); controller.current?.abort(); unlocked.current = false; currentStore.lock(); gateway.current?.revoke(); if (listener) void listener.remove(); if (appListener) void appListener.remove(); if (Capacitor.isPluginAvailable('AtlasLocalAI')) { void AtlasNative.stopVoice().catch(() => {}); void AtlasNative.unload().catch(() => {}); } };
  }, [lock]);
  useEffect(() => {
    if (!isWakeWordNativeSupported()) return;
    let alive = true;
    const handles: PluginListenerHandle[] = [];
    void atlasWakeWordBridge.consumePendingNativeReminders().then(({reminders: pending}) => {
      for (const item of pending) {
        if (item.title) {
          try { createReminder(item.title); } catch {}
        }
      }
      if (alive) refreshReminders();
    });
    void atlasWakeWordBridge.getVoiceSessionStatus().then(st => { if (alive) setWakeVoiceState(st.state); }).catch(() => {});
    void loadPersistentMemories({ getEncryptedMemories: getEncryptedMemoriesNative }).then(items => {
      if (alive) setKeystoreMemories(items);
    }).catch(() => {});
    void getVoiceLatencyMetricsNative().then(m => { if (alive && m) setLatencyMetrics(m); }).catch(() => {});
    void atlasWakeWordBridge.addVoiceLatencyMetricsListener(m => {
      if (alive) setLatencyMetrics(m);
    }).then(h => { if (!alive) void h?.remove(); else if (h) handles.push(h); });
    void atlasWakeWordBridge.addVoiceSessionStateListener(ev => {
      if (!alive) return;
      setWakeVoiceState(ev.state);
      if (ev.state === 'COMMAND_LISTENING' || ev.state === 'FOLLOW_UP_LISTENING') setState('listening');
      else if (ev.state === 'THINKING' || ev.state === 'TRANSCRIBING') setState('thinking');
      else if (ev.state === 'SPEAKING') setState('speaking');
      else if (ev.state === 'ERROR_RECOVERY') setState('error');
      else setState('idle');
      if (ev.state === 'IDLE' || ev.state === 'WAKE_LISTENING') { setWakeTranscript(''); refreshReminders(); }
    }).then(h => { if (!alive) void h?.remove(); else if (h) handles.push(h); });
    void atlasWakeWordBridge.addVoiceTranscriptListener(ev => {
      if (alive && ev.text) setWakeTranscript(ev.text);
    }).then(h => { if (!alive) void h?.remove(); else if (h) handles.push(h); });
    return () => { alive = false; for (const h of handles) void h.remove(); };
  }, [refreshReminders]);
  async function run(operation: () => Promise<void>) {
    setBusy(true); setError('');
    try { await operation(); } catch (e) { if (unlocked.current || !data) { setError(errorText(e)); setState('error'); } }
    finally { setBusy(false); }
  }
  async function unlock() {
    if (exists === false && (!acknowledged || passphrase !== repeat)) throw new Error('Confirm your passphrase and acknowledge recovery before creating storage.');
    await store.current.unlock(passphrase); unlocked.current = true; setPassphrase(''); setRepeat('');
    gateway.current = new ActionGateway(createLocalAdapters(() => playerRef.current, href => router.push(href)), () => granted.current, requireNativeTrust, () => unlocked.current && !isControlRestoreActive());
    refresh(); const first = store.current.sessions()[0]; setActive(first?.id ?? ''); setTitle(first?.title ?? ''); setExists(true); setState('idle');
  }
  function switchSession(id: string, nextTitle: string) { stop(); cancelProposal(); setActive(id); setTitle(nextTitle); setLimit(30); setStream(''); setSelectedMemories(new Set()); }
  async function newSession() { const id = await store.current.create(); refresh(); switchSession(id, 'New conversation'); }
  async function send(regenerate = false) {
    const text = draft.trim(); if ((!regenerate && !text) || !active) return;
    const sessionId = active;
    if (!regenerate) {setDraft(''); await store.current.append(sessionId, {role: 'user', text}); refresh();}
    // Deterministic utilities are available even when the model is unloaded.
    const utility = !regenerate && unlocked.current ? resolveNativeUtility(text) : null;
    if (utility) {
      await store.current.append(sessionId, {role: 'assistant', text: utility.text, status: 'complete'});
      refresh();
      if (unlocked.current && readReplies && voice.speech) {playerRef.current.pause(); await AtlasNative.speak({text: utility.text}).catch(e => setError(errorText(e)));}
      return;
    }
    if (!runtime?.available) { setError(runtime?.reason ?? 'Local model unavailable. Your message was saved encrypted; no AI response was generated.'); return; }
    const abort = new AbortController(); controller.current = abort;
    const context = assembleLocalContext(store.current.snapshot(), sessionId, selectedMemories, regenerate);
    const prompt = context.prompt;
    let output = ''; setState('thinking'); setStream('');
    try {
      await generateLocal(prompt, abort.signal, token => { if (!abort.signal.aborted && unlocked.current && output.length < 24000) { output = (output + token).slice(0,24000); setStream(output); } });
      if (unlocked.current && output) await store.current.append(sessionId, {role: 'assistant', text: output, memoryIds: context.memoryIds, status: abort.signal.aborted ? 'interrupted' : 'complete'});
      if (unlocked.current && output && !abort.signal.aborted && readReplies && voice.speech) {playerRef.current.pause(); await AtlasNative.speak({text: output.slice(0,4000)}).catch(e => setError(errorText(e)));}
    } catch (e) {
      if (unlocked.current && output) await store.current.append(sessionId, {role: 'assistant', text: output, memoryIds: context.memoryIds, status: 'interrupted'});
      if (unlocked.current) setError(errorText(e));
    } finally { if (controller.current === abort) controller.current = null; setStream(''); setState('idle'); refresh(); }
  }
  async function summarize() {
    if (!active || !runtime?.available) throw new Error('A local model is required for summarization.');
    const context = assembleLocalContext(store.current.snapshot(), active, new Set());
    const abort = new AbortController(); controller.current = abort;
    const sessionId = active; let output = ''; setState('thinking');
    try {
      await generateLocal('Summarize this conversation faithfully. Do not invent facts or execute actions. Return only a concise summary.\n' + context.prompt, abort.signal, token => {if (!abort.signal.aborted && unlocked.current) {output = (output + token).slice(0,12000); setStream(output);}});
      if (!abort.signal.aborted && unlocked.current && output) await store.current.append(sessionId,{role:'notice',text:'Local model summary (recent bounded context):\n'+output});
    } finally {if (controller.current === abort) controller.current = null; setStream(''); setState('idle'); refresh();}
  }
  async function voiceAction(speakText?: string) {
    if (!Capacitor.isPluginAvailable('AtlasLocalAI')) throw new Error('Offline voice is available only in a supported Android build.');
    playerRef.current.pause(); // Explicitly interrupt Music; never resume it unexpectedly.
    if (speakText) await AtlasNative.speak({text: speakText.slice(0,4000)}); else await AtlasNative.listen({requestId: voiceSession.current.begin()});
  }
  function actionInput() {
    switch (actionKind) {
      case 'music.search': case 'trips.search': return {kind: actionKind, query};
      case 'music.play': case 'music.playlist': case 'trips.itinerary': case 'trips.open': return {kind: actionKind, id: recordId};
      case 'finance.expense': return {kind: actionKind, accountId: recordId, amountPaise: Math.round(Number(amount) * 100), description: query};
      case 'finance.categorize': return {kind: actionKind, id: recordId, categoryId: extraId};
      case 'trips.editTitle': return {kind: actionKind, tripId: recordId, dayId: extraId, title: query};
      case 'navigate': return {kind: actionKind, section: query};
      default: return {kind: actionKind};
    }
  }
  async function requestAction() {
    if (!gateway.current || !active) throw new Error('Create or open a conversation first.');
    cancelProposal(); const result = await gateway.current.request(active, actionInput());
    if (result.proposal) setProposal(result.proposal);
    else if (unlocked.current) { await store.current.append(active, {role: 'notice', text: `Local action result\n${JSON.stringify(result.result, null, 2).slice(0,28000)}`}); refresh(); }
  }
  const sessions = (data?.conversations ?? []).filter(c => `${c.title} ${c.messages.map(m => m.text).join(' ')}`.toLocaleLowerCase().includes(sessionSearch.toLocaleLowerCase())).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map(c => ({...c, count: c.messages.length}));
  const conversation = data?.conversations.find(c => c.id === active);
  const messages: Message[] = conversation?.messages.slice(-limit) ?? [];
  const memories = data?.memories.filter(m => m.text.toLocaleLowerCase().includes(memorySearch.toLocaleLowerCase())) ?? [];
  return <main className={styles.shell}>
    <header className={styles.header}><div><h1>Atlas</h1><p>Local conversations. Your memory. Your permissions.</p></div>{data && <button onClick={lock}>Lock Atlas</button>}</header>
    {!data ? <section className={styles.card}><h2>{exists ? 'Unlock encrypted Atlas' : 'Create encrypted Atlas storage'}</h2><p>Your passphrase protects chat, memory and personality on this device. It is never saved or sent online. This browser encryption is not Android Keystore protection.</p><p>Keep the passphrase offline. There is no reset or account recovery. Exported archives need the same passphrase.</p><form onSubmit={e => {e.preventDefault(); void run(unlock);}}><label>Passphrase<input type="password" minLength={12} maxLength={1024} autoComplete="off" value={passphrase} onChange={e => setPassphrase(e.target.value)}/></label>{exists === false && <><label>Repeat passphrase<input type="password" autoComplete="off" value={repeat} onChange={e => setRepeat(e.target.value)}/></label><label><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/> I have stored my passphrase safely and understand it cannot be reset.</label></>}<button disabled={busy || exists === null}>{busy ? 'Unlocking…' : exists ? 'Unlock locally' : 'Create local vault'}</button></form></section> : <>
      <AtlasOnlineRequest key={active}/>
      <ModelManager/><label><input type="checkbox" checked={readReplies} onChange={e => setReadReplies(e.target.checked)}/> Read completed replies aloud offline</label><p>Recognized speech is inserted into the message field. Review it, then press Send.</p><div className={styles.workspace}>
        <aside className={styles.card}><h2>Conversations</h2><input aria-label="Search conversations" placeholder="Search titles and messages" value={sessionSearch} onChange={e => setSessionSearch(e.target.value)}/><button disabled={busy} onClick={() => void run(newSession)}>New conversation</button><nav aria-label="Atlas conversations">{sessions.map(s => <button className={styles.session} aria-current={s.id === active ? 'page' : undefined} disabled={busy} key={s.id} onClick={() => switchSession(s.id, s.title)}>{s.title}<small>{new Date(s.updatedAt).toLocaleString()} · {s.count} messages</small></button>)}</nav></aside>
        <section className={styles.card} hidden={!open} aria-label="Atlas conversation panel"><div className={styles.row}><input aria-label="Conversation title" maxLength={120} value={title} onChange={e => setTitle(e.target.value)}/><button disabled={busy || !active} onClick={() => void run(async () => {await store.current.rename(active,title); refresh();})}>Rename</button><button disabled={busy || !active} onClick={() => setDeleteTarget({kind: 'conversation', id: active})}>Delete</button></div>
          <div className={styles.messages} role="log" aria-live="polite">{(conversation?.messages.length ?? 0) > limit && <button onClick={() => setLimit(n => n + 30)}>Load older messages</button>}{!active && <p>Create a conversation to start.</p>}{messages.map(m => <article className={styles.message} key={m.id}><small>{m.role === 'assistant' ? 'Atlas' : m.role === 'user' ? 'You' : 'Local action'} · {new Date(m.at).toLocaleString()}{m.status === 'interrupted' ? ' · interrupted' : ''}</small><p>{m.text}</p>{!!m.memoryIds?.length && <details><summary>Memories used ({m.memoryIds.length})</summary>{m.memoryIds.map(id => <p key={id}>{data.memories.find(memory => memory.id === id)?.text ?? 'Memory deleted from active retrieval'}</p>)}</details>}{m.role === 'assistant' && <button disabled={!voice.speech || busy} onClick={() => void run(() => voiceAction(m.text))}>Read aloud offline</button>}</article>)}{stream && <article className={styles.message}><small>Atlas · generating locally</small><p>{stream}</p></article>}</div>
          <form onSubmit={e => {e.preventDefault(); void run(send);}}><textarea aria-label="Message to Atlas" maxLength={8000} placeholder="Message stays on this device" value={draft} onChange={e => setDraft(e.target.value)}/><div className={styles.row}><button disabled={busy || !active || !draft.trim()}>{runtime?.available ? 'Send' : 'Save message'}</button><button type="button" disabled={!voice.recognition || busy} aria-pressed={state === 'listening'} onClick={() => void run(() => voiceAction())}>Push to talk</button><button type="button" disabled={busy || !runtime?.available || !conversation?.messages.some(m => m.role === 'user')} onClick={() => void run(() => send(true))}>Regenerate last response</button><button type="button" disabled={busy || !runtime?.available || !active} onClick={() => void run(summarize)}>Summarize recent context</button><button type="button" onClick={stop}>Stop voice / generation</button></div></form><p role="status">{runtime?.available ? 'Local model ready' : runtime?.reason ?? 'Checking local runtime…'}</p><small>{voice.reason}</small><button disabled={busy} onClick={() => void run(async () => {setRuntime(await runtimeStatus()); if (Capacitor.isPluginAvailable('AtlasLocalAI')) setVoice(await AtlasNative.voiceStatus());})}>Refresh device capabilities</button>
        </section>
      </div>
      <details className={styles.card}><summary>Memory · explicitly saved facts and preferences</summary><p>Nothing is saved as memory automatically. Select memories below to include them in the next local AI response. Avoid passwords, banking details and other secrets.</p><input aria-label="Search memories" value={memorySearch} onChange={e => setMemorySearch(e.target.value)}/><form onSubmit={e => {e.preventDefault(); void run(async () => {await store.current.saveMemory(memoryDraft, editingMemory); setMemoryDraft(''); setEditingMemory(undefined); refresh();});}}><textarea aria-label="Memory text" value={memoryDraft} maxLength={2000} onChange={e => setMemoryDraft(e.target.value)}/><button disabled={busy || !memoryDraft.trim()}>{editingMemory ? 'Save edited memory' : 'Explicitly save memory'}</button>{editingMemory && <button type="button" onClick={() => {setEditingMemory(undefined); setMemoryDraft('');}}>Cancel edit</button>}</form>{memories.map(m => <article key={m.id} className={styles.message}><label><input type="checkbox" checked={selectedMemories.has(m.id)} disabled={busy} onChange={e => setSelectedMemories(old => {const next = new Set(old); if (e.target.checked) next.add(m.id); else next.delete(m.id); return next;})}/> Include in next response</label><p>{m.text}</p><small>{new Date(m.updatedAt).toLocaleString()}</small><button disabled={busy} onClick={() => {setEditingMemory(m.id); setMemoryDraft(m.text);}}>Edit</button><button disabled={busy} onClick={() => setDeleteTarget({kind: 'memory', id: m.id})}>Delete memory</button></article>)}<p>Deleting a memory removes it from active retrieval. Older exported encrypted archives may still contain it, and past chat messages may quote it. Delete those copies separately if needed.</p></details>
      <details className={styles.card}><summary>Personality Studio (Companion &amp; Vault)</summary>
        <div className={styles.message}>
          <strong>Companion Voice Traits</strong>
          <p>Tune how Atlas sounds in hands-free and chat conversations. Never overrides privacy locks or confirmations.</p>
          {(
            [
              ['humor', 'Humor'],
              ['playfulness', 'Playfulness'],
              ['sweetness', 'Sweetness & Warmth'],
              ['directness', 'Directness'],
              ['energy', 'Conversational Energy'],
              ['formality', 'Formality (Casual → Formal)'],
              ['teasing', 'Playful Teasing'],
              ['proactivity', 'Proactive Follow-ups'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 6}}>
              <span>{label}: {companionTraits[key]}/10</span>
              <input
                type="range"
                min={0}
                max={10}
                value={companionTraits[key]}
                onChange={e => {
                  const next = savePersonalityConfig({[key]: Number(e.target.value)});
                  setCompanionTraits(next);
                  if (isWakeWordNativeSupported()) void saveVoicePersonalityNative(next as unknown as Record<string, unknown>);
                }}
              />
            </label>
          ))}
          <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 8}}>
            <span>Response Length</span>
            <select
              value={companionTraits.responseLength}
              onChange={e => {
                const next = savePersonalityConfig({responseLength: e.target.value as ResponseLengthPref});
                setCompanionTraits(next);
                if (isWakeWordNativeSupported()) void saveVoicePersonalityNative(next as unknown as Record<string, unknown>);
              }}
            >
              <option value="brief">Brief (1 sentence)</option>
              <option value="balanced">Balanced (1–3 sentences)</option>
              <option value="detailed">Detailed (2–4 sentences)</option>
            </select>
          </label>
        </div>
        <form onSubmit={e => {e.preventDefault(); const form = new FormData(e.currentTarget); void run(async () => {await store.current.setPersonality({tone: String(form.get('tone')), behavior: String(form.get('behavior'))}); refresh();});}}><label>Vault Tone<input key={data.personality.tone} name="tone" defaultValue={data.personality.tone} maxLength={120}/></label><label>Vault Behavior<textarea key={data.personality.behavior} name="behavior" defaultValue={data.personality.behavior} maxLength={1000}/></label><button disabled={busy}>Save vault personality</button></form><p>Personality cannot grant module access or approve actions.</p>
      </details>
      <details className={styles.card}><summary>Keystore Companion Memories ({keystoreMemories.length})</summary>
        <p>Only explicitly approved preferences are kept here (passwords, PINs, OTPs, and API keys are rejected). Encrypted with Android Keystore AES-256-GCM on device.</p>
        <form onSubmit={e => {
          e.preventDefault();
          if (!keystoreMemDraft.trim()) return;
          void run(async () => {
            await savePersistentMemory(
              { text: keystoreMemDraft, category: 'preference', approvedByUser: true },
              isWakeWordNativeSupported() ? { saveEncryptedMemories: saveEncryptedMemoriesNative } : undefined
            );
            setKeystoreMemDraft('');
            setKeystoreMemories(await loadPersistentMemories({ getEncryptedMemories: getEncryptedMemoriesNative }));
          });
        }}>
          <input aria-label="Companion preference memory" placeholder="e.g. Prefer aisle seats and quiet homestays" value={keystoreMemDraft} onChange={e => setKeystoreMemDraft(e.target.value)} maxLength={400}/>
          <button disabled={!keystoreMemDraft.trim() || busy}>Approve &amp; Save</button>
        </form>
        {keystoreMemories.map(item => (
          <article key={item.id} className={styles.message}>
            <p>{item.text}</p>
            <small>{item.category} · {new Date(item.updatedAt).toLocaleString()}</small>
            <button type="button" onClick={() => void run(async () => {
              await deletePersistentMemory(item.id, isWakeWordNativeSupported() ? { saveEncryptedMemories: saveEncryptedMemoriesNative } : undefined);
              setKeystoreMemories(await loadPersistentMemories({ getEncryptedMemories: getEncryptedMemoriesNative }));
            })}>Delete</button>
          </article>
        ))}
        {keystoreMemories.length > 0 && (
          <button type="button" onClick={() => void run(async () => {
            await resetPersistentMemories(undefined, isWakeWordNativeSupported() ? { saveEncryptedMemories: saveEncryptedMemoriesNative } : undefined);
            setKeystoreMemories([]);
          })}>Reset all companion memories</button>
        )}
      </details>
      <details className={styles.card}><summary>Voice Pipeline Latency Telemetry</summary>
        {!latencyMetrics || latencyMetrics.updatedAt === 0 ? (
          <p>Not measured yet on this session. Trigger &quot;Hey Atlas&quot; or Start Hands-Free Voice on the Android device to record real monotonic timings.</p>
        ) : (
          <ul>
            <li>Wake → Greeting: {latencyMetrics.wakeToGreetingMs >= 0 ? `${latencyMetrics.wakeToGreetingMs} ms` : 'Not recorded'}</li>
            <li>Greeting → Command Listening: {latencyMetrics.greetingToListenMs >= 0 ? `${latencyMetrics.greetingToListenMs} ms` : 'Not recorded'}</li>
            <li>Speech End → Final Transcript: {latencyMetrics.speechEndToTranscriptMs >= 0 ? `${latencyMetrics.speechEndToTranscriptMs} ms` : 'Not recorded'}</li>
            <li>Transcript → AI Response Ready: {latencyMetrics.transcriptToAiResponseMs >= 0 ? `${latencyMetrics.transcriptToAiResponseMs} ms` : 'Not recorded'}</li>
            <li>AI Response → First TTS Audio: {latencyMetrics.aiResponseToFirstAudioMs >= 0 ? `${latencyMetrics.aiResponseToFirstAudioMs} ms` : 'Not recorded'}</li>
            <li>Session End → Wake Resumed: {latencyMetrics.sessionEndToWakeMs >= 0 ? `${latencyMetrics.sessionEndToWakeMs} ms` : 'Not recorded'}</li>
          </ul>
        )}
      </details>
      <details className={styles.card}><summary>Local module actions</summary><p>Every action requires Android device authentication. Grants last only while Atlas is unlocked. Financial writes and itinerary changes require a separate confirmation.</p><fieldset><legend>Allow local access</legend>{permissionsList.map(permission => <label className={styles.grant} key={permission}><input disabled={busy} type="checkbox" checked={permissionState.has(permission)} onChange={e => {if (e.target.checked) granted.current.add(permission); else granted.current.delete(permission); setPermissionState(new Set(granted.current)); cancelProposal();}}/>{permission}</label>)}</fieldset><form onSubmit={e => {e.preventDefault(); void run(requestAction);}}><label>Action<select value={actionKind} onChange={e => {cancelProposal(); setActionKind(e.target.value);}}>{['music.search','music.play','music.pause','music.resume','music.next','music.state','music.playlist','finance.summary','finance.expense','finance.categorize','trips.search','trips.itinerary','trips.open','trips.editTitle','navigate'].map(kind => <option key={kind}>{kind}</option>)}</select></label>{['music.search','trips.search','finance.expense','trips.editTitle','navigate'].includes(actionKind) && <label>{actionKind === 'navigate' ? 'Section: home, music, finance or trips' : actionKind === 'finance.expense' ? 'Expense description' : actionKind === 'trips.editTitle' ? 'New day title' : 'Search'}<input value={query} maxLength={240} onChange={e => {cancelProposal(); setQuery(e.target.value);}}/></label>}{['music.play','music.playlist','finance.expense','finance.categorize','trips.itinerary','trips.open','trips.editTitle'].includes(actionKind) && <label>{actionKind === 'finance.expense' ? 'Account ID' : actionKind === 'trips.editTitle' ? 'Trip ID' : 'Record ID (from local search results)'}<input value={recordId} maxLength={180} onChange={e => {cancelProposal(); setRecordId(e.target.value);}}/></label>}{['finance.categorize','trips.editTitle'].includes(actionKind) && <label>{actionKind === 'finance.categorize' ? 'Category ID' : 'Itinerary day ID'}<input value={extraId} maxLength={180} onChange={e => {cancelProposal(); setExtraId(e.target.value);}}/></label>}{actionKind === 'finance.expense' && <label>Amount in account currency<input type="number" min="0.01" step="0.01" max="1000000" value={amount} onChange={e => {cancelProposal(); setAmount(e.target.value);}}/></label>}<button disabled={busy || !active}>Run / review proposal</button></form>{proposal && <section role="alert"><h3>Confirm this exact local change</h3><p>{proposal.description}</p><pre>{JSON.stringify(proposal.action,null,2)}</pre><p>Expires at {new Date(proposal.expiresAt).toLocaleTimeString()}.</p><button disabled={busy} onClick={() => void run(async () => {const receipt = await gateway.current!.confirm(active,proposal.token); setProposal(null); try {await store.current.append(active,{role: 'notice',text: `Action receipt\n${JSON.stringify(receipt,null,2)}`}); refresh();} catch {throw new Error(`Action completed (${receipt.id}), but the encrypted receipt could not be saved. Check the module before retrying.`);}})}>Confirm and authenticate</button><button onClick={cancelProposal}>Cancel</button></section>}</details>
      <details className={styles.card}><summary>Voice Reminders ({reminders.length})</summary><p>Reminders saved by saying &quot;Hey Atlas, remind me to...&quot; or added manually here stay offline on this device.</p>{isWakeWordNativeSupported() && <div className={styles.row}><span>Hands-free state: {wakeVoiceState}{wakeTranscript ? ` · "${wakeTranscript}"` : ''}</span><button type="button" onClick={() => void atlasWakeWordBridge.startManualVoiceSession().catch(e => setError(errorText(e)))}>Start Hands-Free Voice</button><button type="button" onClick={() => void atlasWakeWordBridge.stopVoiceSession()}>Stop Hands-Free Voice</button></div>}<form onSubmit={e => {e.preventDefault(); if (!reminderDraft.trim()) return; createReminder(reminderDraft); setReminderDraft(''); refreshReminders();}}><input aria-label="New reminder" placeholder="Add reminder" maxLength={180} value={reminderDraft} onChange={e => setReminderDraft(e.target.value)}/><button disabled={!reminderDraft.trim()}>Save reminder</button></form>{reminders.length === 0 ? <p>No active reminders.</p> : reminders.map(r => <article key={r.id} className={styles.message}><p>{r.title}</p><small>{new Date(r.createdAt).toLocaleString()}</small><div className={styles.row}><button type="button" onClick={() => {completeReminder(r.id); refreshReminders();}}>Complete</button><button type="button" onClick={() => {deleteReminder(r.id); refreshReminders();}}>Delete</button></div></article>)}</details>
      <details className={styles.card}><summary>Encrypted export / import</summary><p>Archives contain conversations, memories and personality encrypted with your Atlas passphrase. Keep exports private. Import merges copies and does not overwrite current records.</p><button disabled={busy} onClick={() => void run(async () => {const url = URL.createObjectURL(await store.current.exportArchive()); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `atlas-local-${new Date().toISOString().slice(0,10)}.atlasai`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);})}>Export encrypted archive</button><input aria-label="Encrypted Atlas archive" type="file" accept=".atlasai" onChange={e => setImportFile(e.target.files?.[0] ?? null)}/><label>Archive passphrase<input type="password" autoComplete="off" value={importPhrase} onChange={e => setImportPhrase(e.target.value)}/></label><button disabled={busy || !importFile || !importPhrase} onClick={() => void run(async () => {await store.current.importArchive(importFile!,importPhrase); setImportPhrase(''); setImportFile(null); refresh();})}>Decrypt and merge locally</button></details>
      {deleteTarget && <section className={styles.card} role="alert"><p>Delete this {deleteTarget.kind} from active local storage? Exported archives remain unchanged.</p><button disabled={busy} onClick={() => void run(async () => {if (deleteTarget.kind === 'memory') {await store.current.deleteMemory(deleteTarget.id); setSelectedMemories(old => {const next = new Set(old); next.delete(deleteTarget.id); return next;});} else {await store.current.deleteConversation(deleteTarget.id); if (active === deleteTarget.id) switchSession('','');} setDeleteTarget(null); refresh();})}>Delete selected item</button><button onClick={() => setDeleteTarget(null)}>Cancel</button></section>}
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button className={`${styles.orb} ${styles[state]}`} aria-label={`Atlas ${state}; ${open ? 'collapse' : 'expand'} conversation`} aria-expanded={open} onClick={() => setOpen(value => !value)}><span aria-hidden="true">✦</span><small>{state === 'listening' ? 'Mic active' : state}</small></button>
  </main>;
}
