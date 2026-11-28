'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {Capacitor} from '@capacitor/core';
import type {CloudAccount} from '@/lib/cloud-vault/protocol';
import {CLOUD_SECTIONS} from '@/lib/cloud-vault/protocol';
import '@/components/control-room/control-room.css';

function signIn() {
  // OAuth requires a full browser navigation, not a Next.js RSC request.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  location.assign('/api/account/sign-in');
}
export default function AccountPage() {
  const [status,setStatus]=useState<{configured:boolean;account:{email:string}|null}|null>(null);
  const [backup,setBackup]=useState<CloudAccount|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [automatic,setAutomatic]=useState(false),[ready,setReady]=useState(false),[confirmRestore,setConfirmRestore]=useState(false);
  const [native,setNative]=useState(false);
  useEffect(()=>{let live=true;
    Promise.resolve().then(()=>{if(live){setNative(Capacitor.isNativePlatform());if(new URLSearchParams(location.search).get('signin')==='failed')setError('Sign-in did not complete. Use your configured Atlas Google account.');}});
    if(Capacitor.isNativePlatform())return()=>{live=false;};
    fetch('/api/account/status',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(live)setStatus(data);}).catch(()=>{if(live)setError('Account service is unavailable. Your local data is still available.');});
    return()=>{live=false;};
  },[]);
  async function run(action:()=>Promise<void>) {
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{await action();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
  }
  async function refresh() {
    const client=await import('@/lib/cloud-vault/client');
    setBackup(await client.connectAccountBackup());
    setAutomatic(!!client.getCloudLink()?.automatic);setReady(!!client.getCloudLink()?.ready);
  }
  const saved=CLOUD_SECTIONS.filter(s=>backup?.sections[s]);
  return <main className="oc-room" style={{maxWidth:760,margin:'0 auto',padding:'32px 20px 100px'}}>
    <Link href="/secret/control-room">← Control Room</Link>
    <h1 style={{fontSize:'clamp(28px,6vw,42px)',margin:'28px 0 12px'}}>Backup &amp; Restore</h1>
    <p>Your Atlas account. Your saved app data.</p>
    <section className="oc-panel">
      {native?<><h2>Account recovery is being connected</h2><p>Android sign-in and private gallery recovery still need migration. Keep using your existing Cloud Storage backup and recovery kit for now.</p><Link href="/secret/control-room?tab=storage">Open Cloud Storage</Link></>:
      !status?<p role="status">{error?'Unable to check your account.':'Checking your account…'}</p>:
      !status.configured?<><h2>One-time setup remaining</h2><p>Google sign-in needs to be configured on the Atlas server before account recovery can be used. Existing local data and backups are unchanged.</p></>:
      !status.account?<><h2>Welcome to your Atlas</h2><p>Sign in with your Google account to connect encrypted app-data backup. No Atlas recovery code to type.</p><button className="oc-primary" onClick={signIn}>Continue with Google</button></>:
      <><h2>Your account</h2><p>{status.account.email}</p>
        {!backup?<button className="oc-primary" disabled={busy} onClick={()=>void run(refresh)}>Connect app-data backup</button>:<>
          <p>{saved.length?`Saved sections: ${saved.join(', ')}.`:'No app-data backup saved yet.'}</p>
          <p>Trips, Finance, Music records, Creator Studio and preferences. Phone photo/video originals and native gallery organisation are not included in this account backup yet.</p>
          {!ready&&<p>There is a backup on this account. Restore it before enabling uploads on this device.</p>}
          <div className="oc-actions">
            <button className="oc-primary" disabled={busy||!ready} onClick={()=>void run(async()=>{const c=await import('@/lib/cloud-vault/client');await c.uploadSections();await refresh();setMessage('App data saved and verified. Media backup is separate.');})}>Back up now</button>
            <button className="oc-secondary" disabled={busy||!saved.length} onClick={()=>setConfirmRestore(true)}>Restore my Atlas</button>
          </div>
          <label className="oc-rule"><span>Back up app-data changes automatically while Atlas is open</span><input type="checkbox" checked={automatic} disabled={busy||!ready} onChange={e=>{const value=e.target.checked;void run(async()=>{const c=await import('@/lib/cloud-vault/client');c.setAutomaticUploads(value);setAutomatic(value);});}}/></label>
          {confirmRestore&&<section className="oc-panel" aria-label="Confirm restore"><h3>Restore saved app data?</h3><p>This replaces local records in {saved.join(', ')}. Local phone photos are not deleted. Existing native R2 backups are unchanged.</p><div className="oc-actions"><button className="oc-primary" disabled={busy} onClick={()=>void run(async()=>{const c=await import('@/lib/cloud-vault/client');await c.restoreSections(saved);await refresh();setConfirmRestore(false);setMessage('Saved app data restored.');})}>Restore saved data</button><button disabled={busy} onClick={()=>setConfirmRestore(false)}>Cancel</button></div></section>}
        </>}
        <button className="oc-text" disabled={busy} onClick={()=>void run(async()=>{const r=await fetch('/api/account/sign-out',{method:'POST',headers:{'X-Atlas-Account':'1'}});if(!r.ok)throw new Error('Sign-out did not finish.');const c=await import('@/lib/cloud-vault/client');if(c.getCloudLink()?.accountManaged)c.disconnectCloud();setStatus({...status,account:null});setBackup(null);setConfirmRestore(false);})}>Sign out</button>
      </>}
      {busy&&<p role="status">Working… Keep Atlas open until this finishes.</p>}
      {message&&<p role="status">{message}</p>}
      {error&&<p role="alert">{error}</p>}
    </section>
    <p>Existing backups are preserved. Private R2 media and gallery recovery remain in Cloud Storage until their account migration is complete.</p>
  </main>;
}
