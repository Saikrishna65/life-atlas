import {buildDemoTransactions} from "./demoTransactions";
import { IndexedDBUnitOfWork, AccountService, BudgetService, SavingsGoalService } from './index';
import { FINANCE_DB_VERSION, migrateToV1, migrateToV2, migrateToV3, migrateToV4 } from './storage/indexeddb/migrations';
import type { IKotakNativePlugin } from './application/notificationTrackingService';

export function openDemoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('life_atlas_finance_demo_v2', FINANCE_DB_VERSION);
    request.onupgradeneeded = e => {
      const db = request.result, tx = request.transaction!;
      if (e.oldVersion < 1) migrateToV1(db, tx);
      if (e.oldVersion < 2) migrateToV2(db, tx);
      if (e.oldVersion < 3) migrateToV3(db, tx);
      if (e.oldVersion < 4) migrateToV4(db, tx);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
let seeding: Promise<void> | undefined;
export function seedFinanceDemo(uow: IndexedDBUnitOfWork) {
  return seeding ??= (async () => {
    if ((await uow.accounts.getAll()).length) return;
    await uow.categories.seedDefaults();
    const cats = await uow.categories.getAll();
    const category = (name: string) => cats.find(c => c.name.toLowerCase().includes(name.toLowerCase()))?.id;
    const as = new AccountService(uow);
    const now = new Date();
    const date = (days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12).toISOString();
    const openingDate=new Date(now.getFullYear()-1,0,0,12).toISOString();
    const bank = await as.createAccount({ name:'Kotak Everyday',accountType:'bank',openingBalancePaise:8500000,openingBalanceDate:openingDate,metadata:{institutionName:'Kotak',accountNumberLast4:'1234'}});
    await as.createAccount({name:'Emergency savings',accountType:'savings',openingBalancePaise:18000000,openingBalanceDate:openingDate});
    await as.createAccount({name:'Travel credit card',accountType:'credit',openingBalancePaise:-1250000,openingBalanceDate:openingDate});
    await as.createAccount({name:'Pocket cash',accountType:'cash',openingBalancePaise:350000,openingBalanceDate:openingDate});
    await uow.transactions.saveBatch(buildDemoTransactions(bank.id,cats,now));
    await as.recalculateAccountBalance(bank.id);
    const bs = new BudgetService(uow);
    for (const [name,amount] of [['food',6000],['grocer',8000],['transport',3500],['shopping',5000],['entertain',2000]] as const) { const id=category(name);if(id) await bs.setCategoryMonthlyBudget(id,amount*100); }
    const gs = new SavingsGoalService(uow);
    for (const [name,target,current] of [['Japan trip',250000,96000],['Emergency fund',400000,180000],['New laptop',120000,44000]] as const) await gs.createGoal({name,targetAmountPaise:target*100,currentAmountPaise:current*100,targetDate:date(-180)});
    const stamp = new Date().toISOString();
    await uow.recurringRules.save({id:'demo_netflix',accountId:bank.id,description:'Netflix subscription',merchant:'Netflix',amountPaise:64900,currency:'INR',direction:'outflow',frequency:'monthly',interval:1,startDate:date(60),nextDueDate:date(-7),autoPost:false,status:'detected',confidenceScore:.98,createdAt:stamp,updatedAt:stamp});
    await uow.categorizationRules.save({id:'demo_swiggy',name:'Food delivery',matchType:'contains',pattern:'swiggy',categoryId:category('food') || cats[0].id,priority:10,isSystem:false,isActive:true,createdAt:stamp,updatedAt:stamp});
  })().catch(error => { seeding=undefined; throw error; });
}

// A separate simulated capture source: never connects to or acknowledges real SMS.
export function createDemoCapture(): IKotakNativePlugin {
  let enabled = true;
  let events = ['Swiggy','Uber','Amazon'].map((merchant,index) => ({id:`demo_alert_${index}`,packageName:'com.google.android.apps.messaging',sender:'AX-KOTAKB',title:'Kotak Bank',text:`Rs. ${[540,280,2199][index]}.00 debited from your Kotak Bank A/c XX1234 to ${merchant}. UPI Ref ${991100221100+index}.`,postTime:Date.now()-index*60000,postTimeIso:new Date(Date.now()-index*60000).toISOString()}));
  return {
    isNotificationAccessGranted:async()=>({granted:true}),requestNotificationAccess:async()=>({opened:false}),
    getTrackingStatus:async()=>({enabled,permissionGranted:true,lastEventTime:new Date().toISOString(),lastTransactionTime:null,lastError:null,eventsReceivedCount:3,duplicatesIgnoredCount:0,pendingCount:events.length}),
    setTrackingEnabled:async options=>{enabled=options.enabled;return {enabled};},getPendingNotifications:async()=>({notifications:events,count:events.length}),
    acknowledgeNotifications:async options=>{events=events.filter(e=>!options.ids.includes(e.id));return {success:true,remainingCount:events.length};},
    recordTransactionProcessed:async()=>({success:true}),recordDuplicateIgnored:async()=>({success:true,count:0}),clearTrackingData:async()=>({success:true}),requestReviewNotifications:async()=>({granted:true}),addListener:async()=>({remove:()=>{}})
  };
}
