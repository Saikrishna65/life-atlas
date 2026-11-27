'use client';
import {useEffect, useRef, useState} from 'react';
import {CloudApprovalGate, type CloudPreview} from '@/lib/atlas-ai/cloud-approval';

/** Mounted only inside the unlocked encrypted Atlas screen. Online replies are not automatically saved. */
export default function AtlasOnlineRequest() {
  const gate = useRef(new CloudApprovalGate());
  const inFlight = useRef<AbortController | null>(null);
  const [model, setModel] = useState('');
  const [question, setQuestion] = useState('');
  const [key, setKey] = useState('');
  const [preview, setPreview] = useState<CloudPreview | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function cancel() {
    gate.current.cancel(); inFlight.current?.abort(); inFlight.current = null;
    setPreview(null); setKey(''); setBusy(false);
  }
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== 'visible') {
        gate.current.cancel(); inFlight.current?.abort(); inFlight.current = null;
        setPreview(null); setKey(''); setQuestion(''); setAnswer(''); setBusy(false);
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    const g = gate.current;
    return () => {document.removeEventListener('visibilitychange', onHidden); g.cancel(); inFlight.current?.abort(); inFlight.current = null;};
  }, []);
  function review() {
    setError(''); setAnswer(''); setPreview(null);
    if (document.visibilityState !== 'visible') return;
    try { setPreview(gate.current.preview(model, question)); }
    catch (e) {setError(e instanceof Error ? e.message : 'Unable to prepare request.');}
  }
  async function send() {
    if (!preview || busy || inFlight.current || document.visibilityState !== 'visible') return;
    const abort = new AbortController(); inFlight.current = abort;
    const timer = setTimeout(() => abort.abort(), 30000);
    const requestId = preview.id;
    setPreview(null); setBusy(true); setError(''); setAnswer('');
    try {
      const pending = gate.current.execute(requestId, key, abort.signal);
      setKey('');
      const result = await pending;
      if (inFlight.current === abort && !abort.signal.aborted) setAnswer(result);
    } catch {
      if (inFlight.current === abort) setError('Online request failed, expired or was canceled. Review a new request to retry. No automatic fallback.');
    } finally {
      clearTimeout(timer);
      if (inFlight.current === abort) {inFlight.current = null; setBusy(false);}
    }
  }
  return <details>
    <summary>Optional online question — explicit approval only</summary>
    <p>Local chat and voice never fall back to cloud automatically. Only text you enter here is sent to OpenRouter and its selected model provider. Do not include secrets or private vault records. The provider may process this text outside your device.</p>
    <p>Use a dedicated API key without paid balance or a paid-provider key configured. Free availability is not guaranteed. No history, memory, tools or files are attached. The key is held only for this request, not saved.</p>
    <label>Exact free model ID<input maxLength={210} placeholder="provider/model:free" value={model} disabled={busy} onChange={e=>{gate.current.cancel();setPreview(null);setModel(e.target.value);}}/></label>
    <label>Question to send<textarea maxLength={8000} value={question} disabled={busy} onChange={e=>{gate.current.cancel();setPreview(null);setQuestion(e.target.value);}}/></label>
    <label>OpenRouter session key<input type="password" autoComplete="off" maxLength={512} value={key} disabled={busy} onChange={e=>{gate.current.cancel();setPreview(null);setKey(e.target.value);}}/></label>
    <button type="button" disabled={busy || !key.trim() || !question.trim()} onClick={review}>Review exact online request</button>
    {preview && <section role="alert"><p>Destination: {preview.endpoint}. Your API key is sent as an authorization header (not shown below). Approval expires in 60 seconds.</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(JSON.parse(preview.body),null,2)}</pre><button type="button" onClick={()=>void send()}>Approve and send once</button></section>}
    {(preview || busy || key) && <button type="button" onClick={cancel}>Cancel / clear key</button>}
    {busy && <p role="status">Sending approved online request. Cancel cannot recall data already transmitted.</p>}
    {error && <p role="alert">{error}</p>}{answer && <article><strong>Online model reply (not saved)</strong><p style={{whiteSpace:'pre-wrap'}}>{answer}</p><button type="button" onClick={()=>setAnswer('')}>Clear online reply</button></article>}
  </details>;
}
