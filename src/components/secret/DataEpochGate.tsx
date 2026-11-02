"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {ensureCleanStart} from '@/lib/cloud-vault/clean-start';
export default function DataEpochGate({children}:{children:ReactNode}){const [ready,setReady]=useState(false),[error,setError]=useState('');useEffect(()=>{let active=true;ensureCleanStart().then(()=>{if(active)setReady(true);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);if(!ready)return <div className="p-8" role="status">{error||'Preparing your clean Atlas workspace…'}</div>;return <>{children}</>;}
