import { IndexedDBUnitOfWork, AccountService, TransactionService, BudgetService, SavingsGoalService } from './index';
import { FINANCE_DB_VERSION, migrateToV1, migrateToV2, migrateToV3, migrateToV4 } from './storage/indexeddb/migrations';
import type { IKotakNativePlugin } from './application/notificationTrackingService';

export function openDemoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('life_atlas_finance_demo_v1', FINANCE_DB_VERSION);
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
    const as = new AccountService(uow), ts = new TransactionService(uow);
    const now = new Date();
    const date = (days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12).toISOString();
    const bank = await as.createAccount({ name:'Kotak Everyday',accountType:'bank',openingBalancePaise:8500000,openingBalanceDate:date(100),metadata:{institutionName:'Kotak',accountNumberLast4:'1234'}});
    await as.createAccount({name:'Emergency savings',accountType:'savings',openingBalancePaise:18000000,openingBalanceDate:date(100)});
    await as.createAccount({name:'Travel credit card',accountType:'credit',openingBalancePaise:-1250000,openingBalanceDate:date(100)});
    await as.createAccount({name:'Pocket cash',accountType:'cash',openingBalancePaise:350000,openingBalanceDate:date(100)});
    for (let month = 0; month < 3; month++) {
      for (const [merchant, amount, cat, day] of [['Salary',92000,'salary',0],['Apartment rent',18500,'housing',1],['BigBasket',2450,'grocer',2],['Swiggy',640,'food',3],['Uber',380,'transport',4],['Netflix',649,'entertain',5],['Electricity',1850,'utilit',6],['Amazon',3200,'shopping',7],['Pharmacy',750,'health',8]] as const) {
        await ts.recordTransaction({accountId:bank.id,description:merchant,merchant,amountPaise:amount*100,direction:merchant==='Salary'?'inflow':'outflow',categoryId:category(cat),occurredAt:month === 0 ? new Date(now.getTime()-day*600000).toISOString() : date(month*30+day),source:'manual',reviewRequired:false});
      }
    }
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
