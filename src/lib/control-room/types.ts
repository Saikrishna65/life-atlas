export type VaultSection='trips'|'music'|'finance'|'control'|'studio';
export type FileKind='images'|'video'|'audio'|'documents'|'backups'|'records'|'other';
export interface LocalAsset {id:string;section:VaultSection;kind:FileKind;name:string;bytes:number;store:string;recordKey:IDBValidKey;path:string[];tripId?:string;modified?:string;cloudKey?:string;cloudBucket?:'images'|'music';}
export interface StoreSnapshot {name:string;rows:{key:IDBValidKey;value:unknown}[];}
export interface VaultSnapshot {section:Exclude<VaultSection,'control'>;version:number;stores:StoreSnapshot[];}
export interface VaultUsage {section:VaultSection;records:number;bytes:number;mediaBytes:number;stores:{name:string;records:number;bytes:number}[];}
export interface LocalInventory {assets:LocalAsset[];vaults:VaultUsage[];usage:number|null;quota:number|null;persistent:boolean|null;caches:{name:string;entries:number}[];sampledAt:string;}
export interface CloudAsset {origin?:string;id:string;bucket:'images'|'music';key:string;name:string;bytes:number;kind:FileKind;etag?:string;modified?:number;trash:boolean;originalKey?:string;references:{model:string;id:string;field:string;label:string}[];}
export interface CloudInventory {assets:CloudAsset[];buckets:{name:string;status:'connected'|'unavailable';bytes:number;count:number;complete:boolean}[];database:{status:'connected'|'unavailable';bytes:number|null;tables:{section:string;bytes:number;records:number}[]};quota:null;sampledAt:string;sectionBytes?:Record<string,number>;serviceBytes?:number;}
export interface ControlSettings {cloudBudgetBytes:number|null;musicSyncPaused:boolean;tripRemindersPaused:boolean;mutedNotificationIds:number[];}
export interface ActivityEntry {id:string;at:string;action:string;result:'success'|'error'|'info';detail:string;}
export interface BackupEntry {id:string;at:string;name:string;bytes:number;sections:string[];media:boolean;blob:Blob;reason:'manual'|'before-restore';}
export function formatBytes(bytes:number|null|undefined){if(bytes===null||bytes===undefined)return 'Unavailable';if(bytes<1024)return `${bytes} B`;const units=['KB','MB','GB','TB'];let n=bytes/1024,i=0;while(n>=1024&&i<units.length-1){n/=1024;i++;}return `${n.toFixed(n<10?2:1)} ${units[i]}`;}
export function fileKind(name:string,mime=''):FileKind{const value=(mime+' '+name).toLowerCase();if(value.includes('.atlasbackup')||value.includes('.atlasfile'))return 'backups';if(mime.startsWith('image/')||/\.(png|jpe?g|gif|webp|heic|avif|svg)$/.test(value))return 'images';if(mime.startsWith('video/')||/\.(mp4|mov|webm|mkv)$/.test(value))return 'video';if(mime.startsWith('audio/')||/\.(mp3|m4a|aac|ogg|flac|wav)$/.test(value))return 'audio';if(/\.(pdf|docx?|xlsx?|csv|json|txt|ofx|qif|zip)$/.test(value)||mime.startsWith('application/pdf'))return 'documents';return 'other';}
export const defaultControlSettings:ControlSettings={cloudBudgetBytes:null,musicSyncPaused:false,tripRemindersPaused:false,mutedNotificationIds:[]};
