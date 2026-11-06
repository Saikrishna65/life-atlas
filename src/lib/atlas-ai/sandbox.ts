/** Synthetic-only adapters. This module imports no private stores or network clients. */
export type Module='music'|'finance'|'trips';
export const fixtures:Record<Module,string>={music:'Demo playlist: Mountain Morning · 3 synthetic tracks.',finance:'Demo budget: ₹5,000 planned, ₹1,200 spent. These are fictional amounts.',trips:'Demo trip: Weekend in the hills · 2 days.'};
export interface Action {module:Module;kind:'summary'|'change';}
export function createSandboxGateway(now=Date.now){
 const pending=new Map<string,{session:string;action:Action;expires:number}>();
 return {
  request(session:string,action:Action,permissions:ReadonlySet<Module>){
   if(!session||!permissions.has(action.module))throw new Error('Module permission required.');
   if(action.kind==='summary')return {text:fixtures[action.module]};
   const token=crypto.randomUUID();pending.set(token,{session,action:{...action},expires:now()+60000});
   return {token,text:`Confirm a simulated change to ${action.module}. No real records will change.`};
  },
  confirm(session:string,token:string,permissions:ReadonlySet<Module>){
   const entry=pending.get(token);
   if(!entry||entry.session!==session||entry.expires<=now()||!permissions.has(entry.action.module))throw new Error('Confirmation is invalid or permission was revoked.');
   pending.delete(token);return 'Simulated change confirmed. Your real data is untouched.';
  },
  cancel(token:string){pending.delete(token);}
 };
}
