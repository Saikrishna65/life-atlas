/** Calendar boundaries use the device's local day, including daylight-saving changes. */
export function localFinanceDateKey(value:Date|string){const d=typeof value==='string'?new Date(value):value;return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function currentFinanceWeek(now=new Date()){
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(now.getDay()+6)%7);
 const end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+6,23,59,59,999);
 const todayEnd=new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59,999);
 return {start,end,todayEnd};
}
