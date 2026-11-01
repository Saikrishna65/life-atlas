import type { TripRecord } from '../../vault/types';
import type { Transaction, RecurringRule, FinanceCategory } from '../domain/models';

export interface TripFinanceSettings {
  startAt: string;
  endAt: string;
  timeZone: string;
  confirmation: 'planned' | 'going' | 'cancelled';
  confirmedAt?: string;
}
export interface TripAssignment { mode: 'auto' | 'manual' | 'excluded'; tripId?: string; tripTitle?: string; }
export interface TripContext { trips: TripRecord[]; recurring: RecurringRule[]; categories: FinanceCategory[]; }

export function wallTime(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));
  const get=(key:string)=>parts.find(p=>p.type===key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function zonedInstant(value: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter a complete date and time.');
  const desired=Date.parse(value+'Z');
  let guess=desired;
  for(let i=0;i<4;i++) guess+=desired-Date.parse(wallTime(new Date(guess).toISOString(),timeZone)+'Z');
  const iso=new Date(guess).toISOString();
  if(wallTime(iso,timeZone)!==value)throw new Error('That local time does not exist in this timezone. Choose another time.');
  return iso;
}
export function defaultTripSettings(trip: TripRecord, timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'): TripFinanceSettings | null {
  if(trip.finance)return trip.finance;
  if(!trip.startDate || !trip.endDate)return null;
  const departure={MORNING:'08:00',AFTERNOON:'13:00',EVENING:'18:00',NIGHT:'21:00',OVERNIGHT:'23:00'};
  const arrival={EARLY_MORNING:'05:00',MORNING:'08:00',AFTERNOON:'13:00',EVENING:'18:00',NIGHT:'22:00'};
  try {
    const result:TripFinanceSettings={startAt:zonedInstant(`${trip.startDate.slice(0,10)}T${departure[trip.departureSlot || 'NIGHT']}`,timeZone),endAt:zonedInstant(`${trip.endDate.slice(0,10)}T${arrival[trip.returnSlot || 'MORNING']}`,timeZone),timeZone,confirmation:'planned'};
    validateTripSettings(result);return result;
  }catch{return null;}
}
export function validateTripSettings(settings: TripFinanceSettings) {
  if(!Number.isFinite(Date.parse(settings.startAt)) || !Number.isFinite(Date.parse(settings.endAt)) || Date.parse(settings.endAt)<=Date.parse(settings.startAt))throw new Error('The trip must end after it starts.');
  wallTime(settings.startAt,settings.timeZone);
}
export function tripReminderAt(settings:TripFinanceSettings):string {
  const day=wallTime(settings.startAt,settings.timeZone).slice(0,10);
  const previous=new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  return zonedInstant(previous+'T09:00',settings.timeZone);
}
export function needsTripConfirmation(trip:TripRecord, now=Date.now()):boolean {
  const settings=defaultTripSettings(trip);
  return !!settings && settings.confirmation==='planned' && trip.status!=='ARCHIVED' && now>=Date.parse(tripReminderAt(settings)) && now<Date.parse(settings.endAt);
}
export function eligibleTripExpense(t:Transaction,context:TripContext):boolean {
  if((t.paymentKind && t.paymentKind!=='purchase')||t.direction!=='outflow'||t.status!=='posted'||t.transferGroupId||t.originalTransactionId||t.recurringRuleId)return false;
  if(context.categories.find(c=>c.id===t.categoryId)?.type==='transfer')return false;
  if(/\b(refund|reversal|reversed|cashback|salary|autopay|auto[ -]?debit|standing instruction|mandate|emi)\b/i.test(`${t.description} ${t.merchant || ''} ${(t.tags || []).join(' ')}`))return false;
  const name=(t.merchant || t.description).trim().toLowerCase();
  return !context.recurring.some(rule=>rule.status==='confirmed' && rule.accountId===t.accountId && rule.direction===t.direction && ((rule.merchant || rule.description).trim().toLowerCase()===name || rule.evidenceTransactionIds?.includes(t.id)));
}
export function tripCandidates(t:Transaction,context:TripContext):TripRecord[] {
  if(!eligibleTripExpense(t,context))return [];
  const occurred=Date.parse(t.occurredAt);
  return context.trips.filter(trip=>{const s=trip.finance;return s?.confirmation==='going' && occurred>=Date.parse(s.startAt) && occurred<Date.parse(s.endAt) && trip.currency===t.currency;});
}
export function resolveTripAssignment(t:Transaction,context:TripContext):TripAssignment | undefined {
  if(t.tripAssignment?.mode==='manual'||t.tripAssignment?.mode==='excluded')return t.tripAssignment;
  const matches=tripCandidates(t,context);
  return matches.length===1?{mode:'auto',tripId:matches[0].id,tripTitle:matches[0].title}:undefined;
}
export function assignedTripId(t:Transaction):string|undefined {return t.tripAssignment?.mode==='excluded'?undefined:t.tripAssignment?.tripId;}
export function previewTripChanges(transactions:Transaction[],context:TripContext,nextTrips:TripRecord[]) {
  return transactions.flatMap(t=>{const before=t.tripAssignment;const after=resolveTripAssignment(t,{...context,trips:nextTrips});return JSON.stringify(before)===JSON.stringify(after)?[]:[{transaction:t,before,after}];});
}
