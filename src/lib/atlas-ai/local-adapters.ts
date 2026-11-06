import type {AtlasAction, LocalAdapter} from './gateway';
import type {MusicTrack} from '../music/types';
import {isControlRestoreActive} from '../control-room/maintenance';
export interface LocalPlayback {
  playTrack(track: MusicTrack, queue?: MusicTrack[]): Promise<void>;
  pause(): void; resume(): void; nextTrack(): void;
  currentTrack: MusicTrack | null; isPlaying: boolean; queue: MusicTrack[]; queueIndex: number;
}
export function createLocalAdapters(player: () => LocalPlayback, navigate: (href: string) => void): LocalAdapter {
  const music = () => import('../music/storage');
  const trips = () => import('../vault/storage');
  const finance = async () => { const {IndexedDBUnitOfWork} = await import('../finance/storage/indexeddb/unitOfWork'); return new IndexedDBUnitOfWork(); };
  const ensure = () => { if (isControlRestoreActive()) throw new Error('Wait for restore to finish.'); };
  return {
    async execute(action: AtlasAction, guard: () => void) {
      ensure(); guard();
      switch (action.kind) {
        case 'music.search': return (await (await music()).getAllTracks()).filter(t => `${t.title} ${t.artist}`.toLocaleLowerCase().includes(action.query.toLocaleLowerCase())).slice(0,30).map(t => ({id: t.id, title: t.title, artist: t.artist, downloaded: !!t.audioBlob}));
        case 'music.state': return {track: player().currentTrack ? {id: player().currentTrack!.id, title: player().currentTrack!.title} : null, playing: player().isPlaying};
        case 'music.play': {
          const t = await (await music()).getTrack(action.id);
          if (!t?.audioBlob || t.audioBlob.size <= 2500) throw new Error('A complete local audio download is required. Atlas will not fetch cloud media.');
          guard(); await player().playTrack(t, [t]); return {playing: t.id};
        }
        case 'music.pause': player().pause(); return {paused: true};
        case 'music.resume': {
          const t = player().currentTrack;
          if (!t?.audioBlob || t.audioBlob.size <= 2500) throw new Error('Current track is not a complete local download.');
          player().resume(); return {resumed: true};
        }
        case 'music.next': {
          const playback = player();
          const next = playback.queue.slice(playback.queueIndex + 1).find(t => t.audioBlob && t.audioBlob.size > 2500);
          if (!next) throw new Error('No more downloaded tracks in this queue.');
          guard(); await playback.playTrack(next, playback.queue.filter(t => t.audioBlob && t.audioBlob.size > 2500));
          return {playing: next.id};
        }
        case 'music.playlist': {
          if (!await (await music()).getPlaylist(action.id)) throw new Error('Playlist not found.');
          guard(); navigate(`/secret/music/playlists/${encodeURIComponent(action.id)}`); return {opened: action.id};
        }
        case 'finance.summary': {
          const uow = await finance();
          const {BalanceService} = await import('../finance/application/balanceService');
          const service = new BalanceService(uow);
          return {categories: (await uow.categories.getAll()).filter(c => c.type !== 'transfer').map(c => ({id: c.id, name: c.name, type: c.type})), accounts: await Promise.all((await uow.accounts.getAll('active')).map(async a => ({id: a.id, name: a.name, currency: a.currency, balances: await service.getAccountBalances(a.id)}))), transactions: (await uow.transactions.query({limit: 20})).map(t => ({id: t.id, description: t.description, amountPaise: t.amountPaise, direction: t.direction, categoryId: t.categoryId, at: t.occurredAt}))};
        }
        case 'trips.search': return (await (await trips()).getAllTrips()).filter(t => `${t.title} ${t.destination}`.toLocaleLowerCase().includes(action.query.toLocaleLowerCase())).slice(0,30).map(t => ({id: t.id, title: t.title, destination: t.destination}));
        case 'trips.open': {
          if (!await (await trips()).getTrip(action.id)) throw new Error('Trip not found.');
          guard(); navigate(`/secret/vault/${encodeURIComponent(action.id)}/itinerary`); return {opened: action.id};
        }
        case 'trips.itinerary': {
          if (!await (await trips()).getTrip(action.id)) throw new Error('Trip not found.');
          return (await (await trips()).getItinerariesForTrip(action.id)).map(d => ({id: d.id, day: d.dayIndex, title: d.title, date: d.date, activities: d.activities}));
        }
        case 'navigate': navigate({home: '/secret', music: '/secret/music', finance: '/secret/finance', trips: '/secret/vault'}[action.section]); return {opened: action.section};
        default: throw new Error('A confirmed proposal is required.');
      }
    },
    async prepare(action: AtlasAction, guard: () => void) {
      ensure(); guard();
      if (action.kind === 'finance.expense') {
        const uow = await finance(), account = await uow.accounts.getById(action.accountId);
        if (!account || account.status !== 'active') throw new Error('Active local account required.');
        return {description: `Record ${account.currency} ${(action.amountPaise / 100).toFixed(2)} expense in ${account.name}: ${action.description}`, commit: async () => {
          ensure(); guard(); guard(); const latest = await uow.accounts.getById(account.id);
          if (JSON.stringify(latest) !== JSON.stringify(account)) throw new Error('Account changed. Review a new proposal.');
          const {TransactionService} = await import('../finance/application/transactionService');
          guard(); const t = await new TransactionService(uow).recordTransaction({accountId: account.id, amountPaise: action.amountPaise, description: action.description, direction: 'outflow', source: 'manual'});
          return {transactionId: t.id};
        }};
      }
      if (action.kind === 'finance.categorize') {
        const uow = await finance(), transaction = await uow.transactions.getById(action.id), category = await uow.categories.getById(action.categoryId);
        if (!transaction || !category || transaction.transferGroupId || transaction.status === 'reversed' || category.type === 'transfer' || category.type !== (transaction.direction === 'outflow' ? 'expense' : 'income')) throw new Error('Compatible non-transfer transaction and category required.');
        return {description: `Categorize “${transaction.description}” as “${category.name}”`, commit: async () => {
          ensure(); guard(); guard(); if (JSON.stringify(await uow.transactions.getById(transaction.id)) !== JSON.stringify(transaction) || JSON.stringify(await uow.categories.getById(category.id)) !== JSON.stringify(category)) throw new Error('Transaction or category changed. Review a new proposal.');
          const {TransactionService} = await import('../finance/application/transactionService');
          guard(); const t = await new TransactionService(uow).correctTransaction(transaction.id, {categoryId: category.id}, 'Explicitly confirmed Atlas local categorization');
          return {transactionId: t.id, categoryId: t.categoryId};
        }};
      }
      if (action.kind === 'trips.editTitle') {
        const storage = await trips(), day = (await storage.getItinerariesForTrip(action.tripId)).find(d => d.id === action.dayId);
        if (!day || !await storage.getTrip(action.tripId)) throw new Error('Local trip and itinerary day required.');
        return {description: `Rename itinerary day ${day.dayIndex} from “${day.title}” to “${action.title}”`, commit: async () => {
          ensure(); guard(); guard(); const current = (await storage.getItinerariesForTrip(action.tripId)).find(d => d.id === day.id);
          if (JSON.stringify(current) !== JSON.stringify(day) || !await storage.getTrip(action.tripId)) throw new Error('Itinerary changed. Review a new proposal.');
          guard(); await storage.saveItineraryDay({...day, title: action.title}); return {tripId: action.tripId, dayId: day.id, title: action.title};
        }};
      }
      throw new Error('Unsupported mutation.');
    }
  };
}
