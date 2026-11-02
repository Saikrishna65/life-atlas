"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Cloud,ArrowUpRight,Upload} from 'lucide-react';
import {Modal} from './FinanceDialog';
import type {IUnitOfWork,SyncOutboxService} from '@/lib/finance';
import {getCloudLink,cloudStatus,uploadSections} from '@/lib/cloud-vault/client';
interface Props {isOpen:boolean;onClose:()=>void;uow:IUnitOfWork;syncOutboxService:SyncOutboxService;}
export default function SyncSettingsModal({isOpen,onClose}:Props){const [connected,setConnected]=useState(false),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');useEffect(()=>{if(isOpen){setConnected(!!getCloudLink()?.ready);void cloudStatus().then(a=>setSaved(a?.sections.finance?.savedAt||'')).catch(()=>{});}},[isOpen]);if(!isOpen)return null;return <Modal isOpen={isOpen} onClose={onClose} title="Finance cloud storage"><div className="space-y-4"><Cloud size={28}/><p>Save your accounts, payments, budgets and goals to your private cloud vault. Restore them after reinstalling using your recovery code.</p><p>{saved?`Last saved: ${new Date(saved).toLocaleString()}`:'No Finance cloud copy has been checked yet.'}</p>{error&&<p role="alert">{error}</p>}<Link href="/secret/control-room?tab=cloud" className="af-text-button" onClick={onClose}>Open cloud controls <ArrowUpRight size={15}/></Link>{connected&&<button className="af-primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const a=await uploadSections(['finance']);setSaved(a.sections.finance?.savedAt||'');}catch(e){setError(e instanceof Error?e.message:'Upload could not finish.');}finally{setBusy(false);}}}><Upload size={16}/>{busy?'Uploading…':'Upload Finance now'}</button>}</div></Modal>;}
