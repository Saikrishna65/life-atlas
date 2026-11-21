import type {AtlasAction, LocalAdapter} from './gateway';
import type {MusicTrack} from '../music/types';
import {isControlRestoreActive} from '../control-room/maintenance';
export interface LocalPlayback {
  playTrack(track: MusicTrack, queue?: MusicTrack[]): Promise<void>;
  pause(): void; resume(): void; nextTrack(): void;
  previousTrack?: () => void;
  setPlaybackRate?: (rate: number) => void;
  toggleShuffle?: () => void;
  cycleRepeatMode?: () => void;
  currentTrack: MusicTrack | null; isPlaying: boolean; queue: MusicTrack[]; queueIndex: number;
  isShuffle?: boolean;
  repeatMode?: string;
  playbackRate?: number;
}
export function createLocalAdapters(player: () => LocalPlayback, navigate: (href: string) => void): LocalAdapter {
  const music = () => import('../music/storage');
  const trips = () => import('../vault/storage');
  const reminders = () => import('./reminders');
  const finance = async () => { const {IndexedDBUnitOfWork} = await import('../finance/storage/indexeddb/unitOfWork'); return new IndexedDBUnitOfWork(); };
  const ensure = () => { if (isControlRestoreActive()) throw new Error('Wait for restore to finish.'); };
  return {
    async execute(action: AtlasAction, guard: () => void) {
      ensure(); guard();
      switch (action.kind) {
        case 'music.search': return (await (await music()).getAllTracks()).filter(t => `${t.title} ${t.artist} ${t.album} ${t.genre}`.toLocaleLowerCase().includes(action.query.toLocaleLowerCase())).slice(0,30).map(t => ({id: t.id, title: t.title, artist: t.artist, downloaded: !!t.audioBlob}));
        case 'music.state': {
          const playback = player();
          return {
            track: playback.currentTrack ? {id: playback.currentTrack.id, title: playback.currentTrack.title, artist: playback.currentTrack.artist} : null,
            playing: playback.isPlaying,
            isShuffle: Boolean(playback.isShuffle),
            repeatMode: playback.repeatMode ?? 'OFF',
            playbackRate: playback.playbackRate ?? 1.0,
          };
        }
        case 'music.play': {
          const t = await (await music()).getTrack(action.id);
          if (!t?.audioBlob || t.audioBlob.size <= 2500) throw new Error('A complete local audio download is required. Atlas will not fetch cloud media.');
          guard(); await player().playTrack(t, [t]); return {playing: t.id, title: t.title, artist: t.artist};
        }
        case 'music.pause': player().pause(); return {paused: true};
        case 'music.resume': {
          const t = player().currentTrack;
          if (!t?.audioBlob || t.audioBlob.size <= 2500) throw new Error('Current track is not a complete local download.');
          player().resume(); return {resumed: true, title: t.title};
        }
        case 'music.next': {
          const playback = player();
          const next = playback.queue.slice(playback.queueIndex + 1).find(t => t.audioBlob && t.audioBlob.size > 2500);
          if (!next) throw new Error('No more downloaded tracks in this queue.');
          guard(); await playback.playTrack(next, playback.queue.filter(t => t.audioBlob && t.audioBlob.size > 2500));
          return {playing: next.id, title: next.title};
        }
        case 'music.previous': {
          const playback = player();
          if (playback.previousTrack) {
            playback.previousTrack();
            return {previous: true, title: playback.currentTrack?.title ?? null};
          }
          const prev = [...playback.queue.slice(0, Math.max(0, playback.queueIndex))].reverse().find(t => t.audioBlob && t.audioBlob.size > 2500);
          if (!prev) throw new Error('No previous downloaded track in this queue.');
          guard(); await playback.playTrack(prev, playback.queue.filter(t => t.audioBlob && t.audioBlob.size > 2500));
          return {playing: prev.id, title: prev.title};
        }
        case 'music.setPlaybackRate': {
          const playback = player();
          if (!playback.setPlaybackRate) throw new Error('Playback speed control is unavailable in this player.');
          playback.setPlaybackRate(action.rate);
          return {playbackRate: action.rate};
        }
        case 'music.toggleShuffle': {
          const playback = player();
          if (!playback.toggleShuffle) throw new Error('Shuffle control is unavailable in this player.');
          playback.toggleShuffle();
          return {toggledShuffle: true};
        }
        case 'music.cycleRepeat': {
          const playback = player();
          if (!playback.cycleRepeatMode) throw new Error('Repeat control is unavailable in this player.');
          playback.cycleRepeatMode();
          return {cycledRepeat: true};
        }
        case 'music.playlist': {
          const musicStorage = await music();
          const playlist = await musicStorage.getPlaylist(action.id);
          if (!playlist) throw new Error('Playlist not found.');
          const allTracks = await Promise.all(playlist.trackIds.map(id => musicStorage.getTrack(id)));
          const playable = allTracks.filter((t): t is MusicTrack => Boolean(t && t.audioBlob && t.audioBlob.size > 2500));
          guard();
          if (playable.length > 0) {
            await player().playTrack(playable[0], playable);
          }
          navigate(`/secret/music/playlists/${encodeURIComponent(action.id)}`);
          return {opened: action.id, title: playlist.title, playingCount: playable.length};
        }
        case 'finance.summary': {
          const uow = await finance();
          const {BalanceService} = await import('../finance/application/balanceService');
          const service = new BalanceService(uow);
          return {categories: (await uow.categories.getAll()).filter(c => c.type !== 'transfer').map(c => ({id: c.id, name: c.name, type: c.type})), accounts: await Promise.all((await uow.accounts.getAll('active')).map(async a => ({id: a.id, name: a.name, currency: a.currency, balances: await service.getAccountBalances(a.id)}))), transactions: (await uow.transactions.query({limit: 20})).map(t => ({id: t.id, description: t.description, amountPaise: t.amountPaise, direction: t.direction, categoryId: t.categoryId, at: t.occurredAt}))};
        }
        case 'finance.searchExpenses': {
          const uow = await finance();
          const q = action.query.toLocaleLowerCase();
          const txns = await uow.transactions.query({limit: 100});
          return txns.filter(t => `${t.description} ${t.merchant ?? ''}`.toLocaleLowerCase().includes(q)).slice(0, 25).map(t => ({id: t.id, description: t.description, amountPaise: t.amountPaise, direction: t.direction, categoryId: t.categoryId, at: t.occurredAt}));
        }
        case 'finance.explainCategories': {
          const uow = await finance();
          const cats = (await uow.categories.getAll()).filter(c => c.type !== 'transfer');
          const txns = await uow.transactions.query({limit: 200});
          return cats.map(c => {
            const matches = txns.filter(t => t.categoryId === c.id && t.status !== 'reversed');
            const totalPaise = matches.reduce((sum, t) => sum + t.amountPaise, 0);
            return {id: c.id, name: c.name, type: c.type, count: matches.length, totalPaise};
          });
        }
        case 'finance.budgetHelp': {
          const uow = await finance();
          const budgets = await uow.budgets.getAll();
          const cats = await uow.categories.getAll();
          const catMap = new Map(cats.map(c => [c.id, c.name]));
          const entries: Array<{id: string; budgetName: string; categoryName: string; period: string; limitPaise: number}> = [];
          for (const b of budgets) {
            for (const [categoryId, allocatedPaise] of Object.entries(b.categoryAllocations ?? {})) {
              entries.push({
                id: `${b.id}:${categoryId}`,
                budgetName: b.name,
                categoryName: catMap.get(categoryId) ?? categoryId,
                period: b.period,
                limitPaise: allocatedPaise,
              });
            }
          }
          return entries;
        }
        case 'trips.list': {
          const all = await (await trips()).getAllTrips();
          return all.slice(0, 25).map(t => ({id: t.id, title: t.title, destination: t.destination, startDate: t.startDate, endDate: t.endDate, status: t.status, budgetTotal: t.budgetTotal, currency: t.currency}));
        }
        case 'trips.search': return (await (await trips()).getAllTrips()).filter(t => `${t.title} ${t.destination}`.toLocaleLowerCase().includes(action.query.toLocaleLowerCase())).slice(0,30).map(t => ({id: t.id, title: t.title, destination: t.destination, startDate: t.startDate, endDate: t.endDate, status: t.status}));
        case 'trips.getDetails': {
          const t = await (await trips()).getTrip(action.id);
          if (!t) throw new Error('Trip not found.');
          return {id: t.id, title: t.title, destination: t.destination, startDate: t.startDate, endDate: t.endDate, status: t.status, budgetTotal: t.budgetTotal, currency: t.currency, notes: t.notes};
        }
        case 'trips.open': {
          if (!await (await trips()).getTrip(action.id)) throw new Error('Trip not found.');
          guard(); navigate(`/secret/vault/${encodeURIComponent(action.id)}/itinerary`); return {opened: action.id};
        }
        case 'trips.itinerary': {
          if (!await (await trips()).getTrip(action.id)) throw new Error('Trip not found.');
          return (await (await trips()).getItinerariesForTrip(action.id)).map(d => ({id: d.id, day: d.dayIndex, title: d.title, date: d.date, activities: d.activities}));
        }
        case 'trips.addNote': {
          const storage = await trips();
          const existing = await storage.getTrip(action.id);
          if (!existing) throw new Error('Trip not found.');
          const nextNotes = existing.notes ? `${existing.notes}\n${action.note}` : action.note;
          await storage.saveTrip({...existing, notes: nextNotes});
          return {id: existing.id, notes: nextNotes};
        }
        case 'trips.createReminder': {
          const storage = await trips();
          const trip = await storage.getTrip(action.tripId);
          if (!trip) throw new Error('Trip not found.');
          const {createReminder, parseNaturalDueDate} = await reminders();
          const parsedIso = action.triggerAtIso ?? parseNaturalDueDate(action.dueText, trip.startDate)?.triggerAtIso;
          const item = createReminder(action.title, action.dueText, {tripId: trip.id, triggerAtIso: parsedIso});
          try {
            const triggerTime = parsedIso ?? new Date(Date.now() + 3600000).toISOString();
            const vaultReminder = {
              id: item.id,
              tripId: trip.id,
              title: item.title,
              body: `Trip reminder for ${trip.title}`,
              triggerTime,
              relatedType: 'CUSTOM' as const,
              isTriggered: false,
              isCancelled: false,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt ?? item.createdAt,
            };
            await storage.saveReminder(vaultReminder);
            const {scheduleNativeNotification} = await import('../vault/notifications');
            await scheduleNativeNotification({
              id: Math.floor(Date.now() % 1000000),
              title: vaultReminder.title,
              body: vaultReminder.body,
              scheduleAt: new Date(triggerTime),
              extra: { tripId: trip.id },
            }).catch(() => {});
          } catch {
            // In-memory / non-IndexedDB environments still keep reminders.ts entry.
          }
          return {reminder: item, tripId: trip.id, tripTitle: trip.title};
        }
        case 'reminder.create': {
          const remMod = await reminders();
          const item = remMod.createReminder(action.title, action.dueText, {tripId: action.tripId, triggerAtIso: action.triggerAtIso});
          if (action.tripId) {
            try {
              const storage = await trips();
              const trip = await storage.getTrip(action.tripId);
              if (trip) {
                const triggerTime = item.triggerAtIso ?? new Date(Date.now() + 3600000).toISOString();
                const vaultReminder = {
                  id: item.id,
                  tripId: action.tripId,
                  title: item.title,
                  body: `Reminder for ${trip.title}`,
                  triggerTime,
                  relatedType: 'CUSTOM' as const,
                  isTriggered: false,
                  isCancelled: false,
                  createdAt: item.createdAt,
                  updatedAt: item.updatedAt ?? item.createdAt,
                };
                await storage.saveReminder(vaultReminder);
                const {scheduleNativeNotification} = await import('../vault/notifications');
                await scheduleNativeNotification({
                  id: Math.floor(Date.now() % 1000000),
                  title: vaultReminder.title,
                  body: vaultReminder.body,
                  scheduleAt: new Date(triggerTime),
                  extra: { tripId: trip.id },
                }).catch(() => {});
              }
            } catch {
              // Ignore IndexedDB unavailability in headless tests.
            }
          }
          return {reminder: item};
        }
        case 'reminder.list': {
          const items = (await reminders()).listReminders(false);
          return {reminders: items};
        }
        case 'reminder.update': {
          const updated = (await reminders()).updateReminder(action.id, {title: action.title, dueText: action.dueText});
          if (!updated) throw new Error('Reminder not found.');
          return {reminder: updated};
        }
        case 'reminder.complete': {
          const done = (await reminders()).completeReminder(action.id);
          if (!done) throw new Error('Reminder not found.');
          return {completed: true, id: action.id};
        }
        case 'reminder.delete': {
          const deleted = (await reminders()).deleteReminder(action.id);
          if (!deleted) throw new Error('Reminder not found.');
          return {deleted: true, snapshot: deleted};
        }
        case 'control.status': {
          const {getVoiceCloudConsent, getVoiceCloudConfig} = await import('./voice-assistant');
          return {
            restoreActive: isControlRestoreActive(),
            cloudConsent: getVoiceCloudConsent(),
            cloudProvider: getVoiceCloudConfig().provider,
          };
        }
        case 'navigate': navigate({home: '/secret', music: '/secret/music', finance: '/secret/finance', trips: '/secret/vault', control: '/secret/control-room', atlas: '/secret/atlas'}[action.section]); return {opened: action.section};
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
