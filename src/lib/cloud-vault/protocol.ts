export const CLOUD_SECTIONS = ['trips','music','finance','studio','preferences'] as const;
export type CloudSection = typeof CLOUD_SECTIONS[number];
export const CLOUD_PREFIX = 'private-vault/';
export const CHUNK_BYTES = 4 * 1024 * 1024;
export interface ChunkRef { id:string; bytes:number; }
export interface SectionCopy { revision:string; sourceHash:string; savedAt:string; records:number; bytes:number; chunks:ChunkRef[]; manifest:ChunkRef[]; }
export interface CloudAccount { format:'atlas-cloud-v1'; tokenHash:string; sections:Partial<Record<CloudSection,SectionCopy>>; }
export const isHex = (value:unknown): value is string => typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function sectionName(value:unknown): CloudSection { if(!CLOUD_SECTIONS.includes(value as CloudSection))throw new Error('Choose an Atlas section.');return value as CloudSection; }
export function validateCopy(value:SectionCopy) {
 if(!value||!isHex(value.sourceHash)||typeof value.revision!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(value.revision)||!Number.isSafeInteger(value.records)||value.records<0||!Number.isSafeInteger(value.bytes)||value.bytes<0)throw new Error('Invalid cloud copy.');
 if(!Array.isArray(value.manifest)||!value.manifest.length||!Array.isArray(value.chunks)||value.chunks.length>16384||value.manifest.length>2048)throw new Error('Invalid cloud file list.');
 for(const ref of [...value.chunks,...value.manifest])if(!isHex(ref.id)||!Number.isSafeInteger(ref.bytes)||ref.bytes<28||ref.bytes>CHUNK_BYTES+28)throw new Error('Invalid cloud file.');
 return value;
}
export function cloudObjectKey(vaultId:string,section:CloudSection,id:string){if(!isHex(vaultId)||!isHex(id))throw new Error('Invalid cloud identifier.');return `${CLOUD_PREFIX}${vaultId}/${sectionName(section)}/objects/${id}`;}
