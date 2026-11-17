"use client";
import {useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Compass,Images} from 'lucide-react';
import PastTrips from './PastTrips';
import HomeSections from './HomeSections';
import '@/components/trip-vault/trip-vault.css';
import './creator-studio.css';
export default function CreatorStudio(){const [tab,setTab]=useState<'trips'|'home'>('trips');return <div className="creator-studio"><header className="cs-header"><Link href="/secret" className="cs-back"><ArrowLeft size={16}/> Private Atlas</Link><span className="cs-eyebrow">THE PUBLIC SIDE OF MY ATLAS</span></header><div className="cs-title"><span className="cs-eyebrow">CREATOR STUDIO</span><h1>A little more<br/><em>of my world.</em></h1><p>Bring previous journeys to your website. Choose the faces, films and moments that belong on its homepage.</p></div><nav className="cs-main-tabs" aria-label="Creator Studio areas"><button aria-pressed={tab==='trips'} onClick={()=>setTab('trips')}><Compass size={18}/> Past trips</button><button aria-pressed={tab==='home'} onClick={()=>setTab('home')}><Images size={18}/> Homepage</button></nav>{tab==='trips'?<PastTrips/>:<HomeSections/>}</div>;}
