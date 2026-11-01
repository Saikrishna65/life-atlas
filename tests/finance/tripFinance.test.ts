import { KotakNotificationParser } from "@/lib/finance/infrastructure/kotakNotificationParser";
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { IndexedDBUnitOfWork, AccountService, TransactionService, BalanceService, BudgetService, NotificationTrackingService, CategorizationService, deleteFinanceDB } from '@/lib/finance';
import type { Transaction } from '@/lib/finance/domain/models';
import type { TripRecord } from '@/lib/vault/types';
import { TripFinanceService } from '@/lib/finance/trips/service';
import { assignedTripId, defaultTripSettings, eligibleTripExpense, needsTripConfirmation, resolveTripAssignment, tripReminderAt, wallTime, zonedInstant, type TripContext } from '@/lib/finance/trips/policy';
import { categoryComparisons } from '@/lib/finance/categoryComparison';
const settings={startAt:'2026-11-06T15:30:00.000Z',endAt:'2026-11-09T23:30:00.000Z',timeZone:'Asia/Kolkata',confirmation:'going' as const};
const trip=(id='goa'):TripRecord=>({id,title:id,destination:'Goa',startDate:'2026-11-06T00:00:00Z',endDate:'2026-11-10T00:00:00Z',departureSlot:'NIGHT',returnSlot:'EARLY_MORNING',status:'PLANNING',travelStyle:'LEISURE',budgetTotal:20000,currency:'INR',createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z',finance:{...settings}});
const expense=(updates:Partial<Transaction>={}):Transaction=>({id:'test',accountId:'bank',description:'Cafe',merchant:'Cafe',amountPaise:10000,currency:'INR',direction:'outflow',status:'posted',source:'notification',occurredAt:'2026-11-07T10:00:00Z',reviewRequired:false,createdAt:'2026-12-01T00:00:00Z',updatedAt:'2026-12-01T00:00:00Z',version:1,...updates});
const ctx=(trips=[trip()]):TripContext=>({trips,recurring:[],categories:[]});

test('exact instants use payment time, including a late-approved message; end is exclusive',()=>{
 assert.equal(resolveTripAssignment(expense({occurredAt:settings.startAt}),ctx())?.tripId,'goa');
 assert.equal(resolveTripAssignment(expense({occurredAt:settings.endAt}),ctx()),undefined);
 assert.equal(resolveTripAssignment(expense({occurredAt:'2026-11-06T15:29:59.999Z'}),ctx()),undefined);
 assert.equal(resolveTripAssignment(expense(),ctx())?.tripId,'goa');
 assert.equal(resolveTripAssignment(expense({occurredAt:'2026-11-10T01:00:00Z'}),ctx()),undefined);
});
test('requires explicit going confirmation and refuses to guess overlapping trips',()=>{
 assert.equal(resolveTripAssignment(expense(),ctx([{...trip(),finance:{...settings,confirmation:'planned'}}])),undefined);
 assert.equal(resolveTripAssignment(expense(),ctx([{...trip(),finance:{...settings,confirmation:'cancelled'}}])),undefined);
 assert.equal(resolveTripAssignment(expense(),ctx([trip(),trip('another')])),undefined);
});
test('excludes salary, transfer legs, refunds, recurring bills, pending and reversed payments',()=>{
 for(const change of [{direction:'inflow'},{transferGroupId:'transfer'},{originalTransactionId:'refund'},{recurringRuleId:'rent'},{status:'pending'},{status:'reversed'},{description:'Credit card autopay'},{description:'EMI payment'},{description:'refund reversed'}] as Partial<Transaction>[]){assert.equal(eligibleTripExpense(expense(change),ctx()),false,JSON.stringify(change));}
 const rule={id:'netflix',accountId:'bank',merchant:'Cafe',description:'Cafe',status:'confirmed',direction:'outflow'} as any;
 assert.equal(eligibleTripExpense(expense(),{...ctx(),recurring:[rule]}),false);
 assert.equal(resolveTripAssignment(expense({currency:'USD'}),ctx()),undefined);
});
test('timezone conversion and reminder use the previous calendar day at 9 AM, including DST',()=>{
 assert.equal(zonedInstant('2026-11-06T21:00','Asia/Kolkata'),settings.startAt);
 assert.equal(tripReminderAt(settings),'2026-11-05T03:30:00.000Z');
 const planned={...trip(),finance:{...settings,confirmation:'planned' as const}};
 assert.equal(needsTripConfirmation(planned,Date.parse('2026-11-05T03:29:00Z')),false);
 assert.equal(needsTripConfirmation(planned,Date.parse('2026-11-05T03:30:00Z')),true);
 assert.equal(needsTripConfirmation(planned,Date.parse(settings.endAt)),false);
 const s={...settings,startAt:zonedInstant('2026-11-01T20:00','America/New_York'),timeZone:'America/New_York'};
 assert.equal(wallTime(tripReminderAt(s),s.timeZone),'2026-10-31T09:00');
 assert.throws(()=>zonedInstant('2026-03-08T02:30','America/New_York'),/does not exist/);
 assert.equal(defaultTripSettings({...trip(),finance:undefined},'Asia/Kolkata')?.endAt,settings.endAt);
});

let uow:IndexedDBUnitOfWork,tx:TransactionService,service:TripFinanceService,trips:TripRecord[],accountId:string;
beforeEach(async()=>{await deleteFinanceDB();uow=new IndexedDBUnitOfWork();await uow.categories.seedDefaults();trips=[trip()];const load=async()=>trips;tx=new TransactionService(uow,load);service=new TripFinanceService(uow,load);accountId=(await new AccountService(uow).createAccount({name:'Trip bank',accountType:'bank',openingBalancePaise:1000000})).id;});
afterEach(async()=>{await deleteFinanceDB();});
const record=(description:string,occurredAt='2026-11-07T10:00:00Z')=>tx.recordTransaction({accountId,description,amountPaise:10000,direction:'outflow',categoryId:'cat_food_dining',occurredAt});
test('manual advance bookings and removals persist; attachment never duplicates ledger entries',async()=>{
 const booking=await record('Advance hotel','2026-11-02T10:00:00Z');assert.equal(assignedTripId(booking),undefined);
 await service.setAssignment(booking.id,'goa');assert.equal(await service.reconcile(),0);
 assert.equal((await uow.transactions.query({})).length,1);
 assert.equal((await new BalanceService(uow).getNetWorth()).netWorthPaise,990000);
 const ordinary=await record('Trip lunch');assert.equal(assignedTripId(ordinary),'goa');await service.setAssignment(ordinary.id,null);await service.reconcile();assert.equal(assignedTripId((await uow.transactions.getById(ordinary.id))!),undefined);
 trips=[{...trip(),finance:{...settings,confirmation:'cancelled'}}];await service.reconcile();assert.equal(assignedTripId((await uow.transactions.getById(booking.id))!),'goa');
});
test('timing preview does not mutate; shortening and extending reclassify only automatic expenses',async()=>{
 const first=await record('First dinner');const second=await record('Last breakfast','2026-11-09T10:00:00Z');const later=await record('Extra night','2026-11-11T10:00:00Z');
 const shortened={...settings,endAt:'2026-11-08T00:00:00Z'};const preview=await service.preview(trips[0],shortened);assert.deepEqual(preview.map(c=>c.transaction.id),[second.id]);assert.equal(assignedTripId((await uow.transactions.getById(second.id))!),'goa');
 trips=[{...trip(),finance:shortened}];await service.reconcile();assert.equal(assignedTripId((await uow.transactions.getById(second.id))!),undefined);assert.equal(assignedTripId((await uow.transactions.getById(first.id))!),'goa');
 trips=[{...trip(),finance:{...settings,endAt:'2026-11-12T00:00:00Z'}}];await service.reconcile();assert.equal(assignedTripId((await uow.transactions.getById(later.id))!),'goa');assert.equal(await service.reconcile(),0);
});
test('editing the actual timestamp recalculates automatic assignment and preserves the account balance',async()=>{
 const t=await record('Correct date');await tx.correctTransaction(t.id,{occurredAt:'2026-11-12T01:00:00Z'},'Wrong payment time');const edited=(await uow.transactions.getById(t.id))!;assert.equal(edited.occurredAt,'2026-11-12T01:00:00Z');assert.equal(assignedTripId(edited),undefined);assert.equal((await new BalanceService(uow).getNetWorth()).netWorthPaise,990000);
});
test('trip expenses count once and appear in Travel & Leisure budgets, reports and cards',async()=>{
 await new BudgetService(uow).setCategoryMonthlyBudget('cat_food_dining',50000);
 await new BudgetService(uow).setCategoryMonthlyBudget('cat_travel',50000);
 const tripPayment=await record('Trip expense');assert.equal(tripPayment.categoryId,'cat_travel');assert.equal(tripPayment.tripAssignment?.originalCategoryId,'cat_food_dining');await record('Everyday expense','2026-11-03T10:00:00Z');
 const start='2026-11-01T00:00:00Z',end='2026-11-30T23:59:59Z';const flow=await new BalanceService(uow).getCashFlow(start,end);assert.equal(flow.totalExpensesPaise,20000);
 const budget=await new BudgetService(uow).getCategoryBudgetStatuses(start,end);assert.equal(budget.statuses.find(b=>b.categoryId==='cat_food_dining')?.spentPaise,10000);assert.equal(budget.statuses.find(b=>b.categoryId==='cat_travel')?.spentPaise,10000);
 const comparisons=categoryComparisons(await uow.transactions.query({}),await uow.categories.getAll(),'month',new Date('2026-11-15T12:00:00Z'));assert.equal(comparisons.find(c=>c.id==='cat_food_dining')?.currentPaise,10000);assert.equal(comparisons.find(c=>c.id==='cat_travel')?.currentPaise,10000);
 const breakdown=await new BalanceService(uow).getCategorySpendingBreakdown(start,end);assert.equal(breakdown.find(b=>b.categoryId==='cat_food_dining')?.totalSpentPaise,10000);assert.equal(breakdown.find(b=>b.categoryId==='cat_travel')?.totalSpentPaise,10000);
});
test('multiple trips can be chosen manually when dates overlap; currency mismatch is rejected',async()=>{
 trips=[trip(),trip('second')];const t=await record('Overlap');assert.equal(assignedTripId(t),undefined);await service.setAssignment(t.id,'second');await service.reconcile();assert.equal(assignedTripId((await uow.transactions.getById(t.id))!),'second');trips.push({...trip('usd'),currency:'USD'});await assert.rejects(()=>service.setAssignment(t.id,'usd'),/currencies must match/);
});
test('an outdated background assignment cannot overwrite a newer manual exclusion',async()=>{
 const t=await record('Race-safe payment');await service.setAssignment(t.id,null);
 await assert.rejects(()=>service.writeAssignment(t,{mode:'auto',tripId:'goa'},'Stale background work'),/changed in another view/);
 assert.equal((await uow.transactions.getById(t.id))?.tripAssignment?.mode,'excluded');
});
test('receipt provenance keeps a bill out even when the normalised merchant hides autopay wording',()=>{
 assert.equal(eligibleTripExpense(expense({description:'Netflix',merchant:'Netflix',paymentKind:'automatic_bill'}),ctx()),false);
 assert.equal(eligibleTripExpense(expense({description:'Refund merchant',paymentKind:'refund'}),ctx()),false);
});
test('deleting a trip restores manually linked payments to everyday spending without deleting the ledger',async()=>{
 const t=await record('Deposit','2026-11-02T12:00:00Z');await service.setAssignment(t.id,'goa');trips=[];await service.reconcile();const remaining=await uow.transactions.getById(t.id);assert.equal(remaining?.tripAssignment?.mode,'excluded');assert.equal(remaining?.amountPaise,10000);
});

test('automatic-bill provenance survives bank message parsing',()=>{
 const parsed=KotakNotificationParser.parse({id:'autopay',packageName:'com.google.android.apps.messaging',sender:'VM-KOTAKB',title:'Kotak Bank',text:'Sent Rs. 900.00 from Kotak Bank AC X1234 to NETFLIX via autopay. UPI Ref 123456789012.',postTime:Date.parse('2026-11-07T10:00:00Z'),postTimeIso:'2026-11-07T10:00:00Z'});
 assert.equal(parsed.success,true);assert.equal(parsed.transaction?.paymentKind,'automatic_bill');
});

test('pasted bank alerts retain automatic-bill classification when saved to the ledger',async()=>{
 const parsed=KotakNotificationParser.parse({id:'pasted-autopay',packageName:'com.google.android.apps.messaging',sender:'VM-KOTAKB',title:'Kotak Bank',text:'Sent Rs. 900.00 from Kotak Bank AC X1234 to NETFLIX via autopay. UPI Ref 876543210987.',postTime:Date.parse('2026-11-07T10:00:00Z'),postTimeIso:'2026-11-07T10:00:00Z'});
 assert.ok(parsed.transaction);const notifications=new NotificationTrackingService(uow,tx,new CategorizationService(uow));const saved=await notifications.confirmParsedTransaction({parsed:parsed.transaction,accountId,categoryId:'cat_food_dining'});assert.equal(saved.paymentKind,'automatic_bill');assert.equal(assignedTripId(saved),undefined);
});

test('existing trip assignments migrate to Travel & Leisure once and restore their original category on removal',async()=>{
 const old=await record('Legacy trip meal');old.categoryId='cat_food_dining';delete old.tripAssignment!.originalCategoryId;await uow.transactions.save(old);assert.equal(await service.reconcile(),1);const migrated=(await uow.transactions.getById(old.id))!;assert.equal(migrated.categoryId,'cat_travel');assert.equal(migrated.tripAssignment?.originalCategoryId,'cat_food_dining');assert.equal(await service.reconcile(),0);await service.setAssignment(old.id,null);assert.equal((await uow.transactions.getById(old.id))?.categoryId,'cat_food_dining');
});
test('editing detail category keeps the Finance category as Travel and retains it on removal',async()=>{
 const t=await record('Trip edit detail');await tx.correctTransaction(t.id,{categoryId:'cat_groceries',tripAssignment:{mode:'auto'}},'Edit trip breakdown');const edited=(await uow.transactions.getById(t.id))!;assert.equal(edited.categoryId,'cat_travel');assert.equal(edited.tripAssignment?.originalCategoryId,'cat_groceries');await service.setAssignment(t.id,null);assert.equal((await uow.transactions.getById(t.id))?.categoryId,'cat_groceries');
});
test('uncategorised trip expenses retain an empty original category across reassignment and removal',async()=>{
 const t=await tx.recordTransaction({accountId,description:'Unknown trip purchase',amountPaise:1200,direction:'outflow',occurredAt:'2026-11-07T14:00:00Z'});assert.equal(t.categoryId,'cat_travel');assert.equal(t.tripAssignment?.originalCategoryId,null);await tx.correctTransaction(t.id,{amountPaise:1300,tripAssignment:{mode:'auto'}},'Correct price');assert.equal((await uow.transactions.getById(t.id))?.tripAssignment?.originalCategoryId,null);await service.setAssignment(t.id,null);assert.equal((await uow.transactions.getById(t.id))?.categoryId,undefined);
});
