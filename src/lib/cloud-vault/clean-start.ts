import {Capacitor,registerPlugin} from '@capacitor/core';
export const CLEAN_EPOCH='atlas-cloud-clean-20261102-v2';
let cleaning:Promise<void>|undefined;
export function ensureCleanStart(){return cleaning??=(async()=>{
 if(localStorage.getItem('atlas_data_epoch')===CLEAN_EPOCH)return;
 for(const name of ['life_atlas_finance_db','life_atlas_finance_demo_v2','life_atlas_trip_vault_db','life_atlas_music_db','life_atlas_studio_db','life_atlas_control_room'])await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Close other Atlas windows, then reopen the app to complete the clean reset.'));});
 for(const key of Object.keys(localStorage))if(/^(life_atlas|lifeatlas|atlas[-_]|pending_youtube|music_)/.test(key))localStorage.removeItem(key);
 sessionStorage.clear();if(Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('KotakNotificationTracker'))await registerPlugin<{clearTrackingData():Promise<unknown>}>('KotakNotificationTracker').clearTrackingData();
 localStorage.setItem('atlas_data_epoch',CLEAN_EPOCH);
 })().catch(error=>{cleaning=undefined;throw error;});}
