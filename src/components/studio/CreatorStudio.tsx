"use client";
import {useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Compass,Images,Aperture} from 'lucide-react';
import PastTrips from './PastTrips';
import HomeSections from './HomeSections';
import '@/components/trip-vault/trip-vault.css';
import './creator-studio.css';
export default function CreatorStudio(){const [tab,setTab]=useState<'trips'|'home'>('trips');return <div className="creator-studio"><header className="cs-header"><Link href="/secret" className="cs-back"><ArrowLeft size={16}/> Private Atlas</Link><span className="cs-studio-mark"><Aperture size={19}/> LIFE ATLAS / STUDIO</span></header><div className="cs-title"><div className="cs-title-copy"><span className="cs-eyebrow">CREATOR STUDIO</span><h1>The stories.<br/><em>The way I see them.</em></h1><p>A place for my journeys to take shape. Gather the places, find the opening frame, and bring the whole story to my website.</p></div><div className="cs-title-art" aria-hidden="true"><span>MY WORLD,<br/>IN THE MAKING.</span><i/><Aperture size={94} strokeWidth={.6}/><small>COLLECT · COMPOSE · PUBLISH</small></div></div><nav className="cs-main-tabs" aria-label="Creator Studio areas"><button aria-pressed={tab==='trips'} onClick={()=>setTab('trips')}><Compass size={18}/> Past trips</button><button aria-pressed={tab==='home'} onClick={()=>setTab('home')}><Images size={18}/> Homepage</button></nav>{tab==='trips'?<PastTrips/>:<HomeSections/>}</div>;}
