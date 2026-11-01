import type { IUnitOfWork } from '../storage/interfaces';
import type { TripRecord } from '../../vault/types';
import type { Transaction } from '../domain/models';
import { applyTripCategory, previewTripChanges, validateTripSettings, type TripAssignment, type TripContext, type TripFinanceSettings } from './policy';

export async function loadFinanceTrips():Promise<TripRecord[]> {
  if(typeof window==='undefined'||!window.indexedDB)return [];
  const { getAllTrips }=await import('../../vault/storage');
  return getAllTrips();
}
export class TripFinanceService {
  constructor(private uow:IUnitOfWork,private loadTrips:()=>Promise<TripRecord[]>=loadFinanceTrips){}
  async context():Promise<TripContext>{const [trips,recurring,categories]=await Promise.all([this.loadTrips(),this.uow.recurringRules.getAll(),this.uow.categories.getAll()]);return {trips,recurring,categories};}
  async writeAssignment(t:Transaction,assignment:TripAssignment|undefined,reason:string){
    const now=new Date().toISOString();const updated={...t,...applyTripCategory(t,assignment),updatedAt:now,version:(t.version||1)+1};
    if(this.uow.transactions.saveIfVersion){
      if(!await this.uow.transactions.saveIfVersion(updated,t.version))throw new Error('This payment changed in another view. Refresh and try again.');
    }else await this.uow.transactions.save(updated);
    await this.uow.audit.record({id:crypto.randomUUID(),entityType:'transaction',entityId:t.id,action:'update',changes:{tripAssignment:{oldVal:t.tripAssignment,newVal:updated.tripAssignment},categoryId:{oldVal:t.categoryId,newVal:updated.categoryId}},reason,performedAt:now});
    await this.uow.outbox.enqueue({id:crypto.randomUUID(),entityType:'transaction',entityId:t.id,action:'update',payloadJson:JSON.stringify(updated),timestamp:now,status:'pending',retryCount:0,idempotencyKey:`trip_${t.id}_${updated.version}`});
    return updated;
  }
  async reconcile(){
    const context=await this.context();const all=await this.uow.transactions.query({});
    const changes=previewTripChanges(all,context,context.trips);
    let saved=0;
    for(const change of changes){const current=await this.uow.transactions.getById(change.transaction.id);if(current&&current.version===change.transaction.version){try{await this.writeAssignment(current,change.after,'Automatic trip assignment');saved++;}catch(error){if(!(error instanceof Error)||!error.message.includes('changed in another view'))throw error;}}}
    return saved;
  }
  async setAssignment(id:string,tripId:string|null){
    const t=await this.uow.transactions.getById(id);if(!t)throw new Error('Transaction not found.');
    if(tripId){const trips=await this.loadTrips();const trip=trips.find(t=>t.id===tripId);if(!trip)throw new Error('Trip not found.');if(t.direction!=='outflow'||t.transferGroupId||t.status==='reversed')throw new Error('Only an expense can be attached to a trip.');if(t.currency!==trip.currency)throw new Error('The trip and payment currencies must match.');return this.writeAssignment(t,{mode:'manual',tripId,tripTitle:trip.title},'User attached trip expense or advance booking');}
    return this.writeAssignment(t,{mode:'excluded'},'User removed transaction from trip; keep normal category');
  }
  async preview(trip:TripRecord,settings:TripFinanceSettings){validateTripSettings(settings);const context=await this.context();const transactions=await this.uow.transactions.query({});return previewTripChanges(transactions,context,context.trips.map(t=>t.id===trip.id?{...trip,finance:settings}:t));}
}
