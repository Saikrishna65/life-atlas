import type {Transaction,FinanceCategory} from './domain/models';
/** Deterministic demo fixtures spanning the previous calendar year through today. */
export function buildDemoTransactions(accountId:string,categories:ReadonlyArray<Pick<FinanceCategory,'id'|'name'>>,now=new Date()):Transaction[]{
 const category=(part:string)=>categories.find(c=>c.name.toLowerCase().includes(part))?.id;
 const output:Transaction[]=[];let sequence=0;const stamp=now.toISOString();
 const add=(merchant:string,amount:number,cat:string,date:Date,direction:'inflow'|'outflow'='outflow')=>{
   let occurred=date;
   if(date>now){if(date.getFullYear()!==now.getFullYear()||date.getMonth()!==now.getMonth()||date.getDate()!==now.getDate())return;occurred=new Date(Math.max(new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),now.getTime()-sequence%60*1000));}
   const occurredAt=occurred.toISOString();const id=`demo_v2_${sequence++}`;
   output.push({id,externalId:id,accountId,description:merchant,merchant,amountPaise:Math.round(amount*100),currency:'INR',direction,status:'posted',categoryId:category(cat),source:'manual',reviewRequired:false,occurredAt,postedAt:occurredAt,createdAt:stamp,updatedAt:stamp,version:1,notes:'Sample transaction · demo workspace only'});
 };
 const plans=[
  ['Apartment rent','housing',18000,[1]],['BigBasket','grocer',1850,[1,8,16,24]],['Swiggy','food',470,[1,3,7,11,15,20,27]],['Uber','transport',260,[1,4,7,10,14,18,22,26]],['Electricity','utilit',1750,[1,18]],['Amazon','shopping',2100,[1,10,25]],['Netflix','entertain',649,[1,21]],['Pharmacy','health',650,[1,12]],['Weekend trip','travel',3400,[1,19]],['Investment contribution','invest',2500,[1]],['Community donation','other expense',350,[1,23]],
 ] as const;
 for(let year=now.getFullYear()-1;year<=now.getFullYear();year++)for(let month=0;month<12;month++){
   if(year===now.getFullYear()&&month>now.getMonth())continue;
   add('Salary',year===now.getFullYear()?92000:86000,'salary',new Date(year,month,1,0,1),'inflow');
   plans.forEach(([merchant,cat,base,days],index)=>days.forEach((day,occurrence)=>{
     const variation=.82+((month*3+index*2+occurrence+(year%7))%8)*.065;
     // First-day purchases allow comparisons even at the start of a month.
     add(merchant,Math.round(base*variation),cat,new Date(year,month,day,day===1?0:9+(index%9),day===1?2+index:occurrence*7));
   }));
 }
 // Recent daily purchases make both the current and previous week useful to explore.
 for(let ago=0;ago<21;ago++){
   const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-ago,13,15);
   const occurred=ago===0?new Date(Math.max(new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),now.getTime()-60000)):d;
   add('Swiggy',310+(ago*73)%620,'food',occurred);
   add('BigBasket',620+(ago*137)%1900,'grocer',new Date(occurred.getTime()-Math.min(12000,occurred.getHours()*60000)));
   add('Uber',125+(ago*37)%400,'transport',new Date(occurred.getTime()-Math.min(25000,occurred.getHours()*60000)));
 }
 return output;
}
