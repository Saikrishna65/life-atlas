import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SecretLayout from '../src/app/secret/layout';
import MusicLayout from '../src/app/secret/music/layout';
import MobileAppBridge from '../src/components/layout/MobileAppBridge';
import { ParamsContext, usePathname } from './navigation';
import { getEntries, flushStudioEntries, type StudioEntry } from './studio-storage';
import '../src/app/globals.css';
const lazyPage = (load: () => Promise<any>) => lazy(load);
const routes = [
  { pattern: /^\/secret\/atlas\/?$/, params: [], Page: lazyPage(() => import("../src/app/secret/atlas/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/plan/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/plan/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/money/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/money/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/checklist/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/checklist/page")) },

  { pattern: /^\/secret\/control-room\/?$/, params: [], Page: lazyPage(() => import("../src/app/secret/control-room/page")) },
  { pattern: new RegExp("^/secret/music/downloads/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/music/downloads/page")) },
  { pattern: new RegExp("^/secret/music/playlists/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/music/playlists/page")) },
  { pattern: new RegExp("^/secret/music/settings/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/music/settings/page")) },
  { pattern: new RegExp("^/secret/music/artists/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/music/artists/page")) },
  { pattern: new RegExp("^/secret/music/library/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/music/library/page")) },
  { pattern: new RegExp("^/secret/music/albums/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/music/albums/page")) },
  { pattern: new RegExp("^/secret/music/queue/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/music/queue/page")) },
  { pattern: new RegExp("^/secret/vault/new/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/vault/new/page")) },
  { pattern: new RegExp("^/secret/finance/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/finance/page")) },
  { pattern: new RegExp("^/secret/studio/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/studio/page")) },
  { pattern: new RegExp("^/secret/music/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/music/page")) },
  { pattern: new RegExp("^/secret/vault/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/vault/page")) },
  { pattern: new RegExp("^/secret/?$"), params: [], Page: lazyPage(() => import("../src/app/secret/page")) },
  { pattern: new RegExp("^/secret/music/playlists/([^/]+)/?$"), params: ["playlistId"], Page: lazyPage(() => import("../src/app/secret/music/playlists/[playlistId]/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/assistant/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/assistant/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/documents/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/documents/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/itinerary/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/itinerary/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/reminders/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/reminders/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/bookings/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/bookings/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/memories/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/memories/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/packing/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/packing/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/rentals/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/rentals/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/budget/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/budget/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/routes/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/routes/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/safety/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/safety/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/food/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/food/page")) },
  { pattern: new RegExp("^/secret/vault/([^/]+)/?$"), params: ["tripId"], Page: lazyPage(() => import("../src/app/secret/vault/[tripId]/page")) },
 ];
function SavedStudioEntries() {
 const [entries,setEntries] = useState<StudioEntry[]>([]);
 useEffect(() => { const refresh = () => { getEntries().then(setEntries).catch(console.error); }; refresh(); window.addEventListener('atlas-studio-change',refresh); return () => window.removeEventListener('atlas-studio-change',refresh); },[]);
 return <section className="max-w-3xl mx-auto mt-8 space-y-4" aria-label="Saved studio entries"><h2 className="font-display text-2xl">Saved on this device</h2><button className="px-4 py-2 rounded-xl border border-muted" onClick={() => void flushStudioEntries()}>Retry publishing</button>{entries.length === 0 ? <p>No entries yet. Your work will be saved offline here.</p> : entries.map(e => <article key={e.id} className="p-4 rounded-xl border border-muted space-y-2"><p className="text-xs text-muted-foreground">{e.section} · {new Date(e.createdAt).toLocaleDateString()} · {e.syncedAt ? "Published online" : "Saved locally · publishing pending"}</p>{e.syncError && <p role="status">{e.syncError}</p>}<h3 className="font-display text-xl">{e.fields.title || e.fields.name || e.fields.caption || e.section}</h3>{Object.entries(e.fields).filter(([k,v]) => v && !['title','name','coverImage','url'].includes(k)).map(([k,v]) => <p key={k}><span className="text-muted-foreground">{k}: </span>{v}</p>)}{(e.fields.coverImage || e.fields.url) && <img src={e.fields.coverImage || e.fields.url} alt={e.fields.caption || e.fields.title || e.fields.name || 'Saved image'} className="max-h-64 rounded-xl" />}</article>)}</section>;
}
class ScreenError extends React.Component<{children: React.ReactNode}, {error: string}> {
 state = {error:''};
 static getDerivedStateFromError(error: Error) { return {error:error.message}; }
 render() { return this.state.error ? <div role="alert" className="p-6"><h1>Unable to open this screen</h1><p>{this.state.error}</p><a href="/secret">Return to Atlas</a></div> : this.props.children; }
}
function App() {
 const path = usePathname();
 const route = routes.find(r => r.pattern.test(path));
 const match = route?.pattern.exec(path);
 const params = Object.fromEntries((route?.params || []).map((key,i) => [key,decodeURIComponent(match?.[i+1] || '')]));
 const Page = route?.Page;
 const screen = <ScreenError key={path}><Suspense fallback={<p role="status" className="p-8">Opening Atlas…</p>}>{Page ? <Page /> : <p>Screen not found. <a href="/secret">Return home</a></p>}{path === '/secret/studio' && <SavedStudioEntries />}</Suspense></ScreenError>;
 return <ParamsContext.Provider value={params}><MobileAppBridge /><SecretLayout>{path.startsWith('/secret/music') ? <MusicLayout>{screen}</MusicLayout> : screen}</SecretLayout></ParamsContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<App />);
