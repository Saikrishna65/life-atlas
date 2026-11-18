"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {Modal,SearchField} from './primitives';
import './world.css';
interface Result {id:string;title:string;type:string;url:string}
export default function PublicSearch({onClose}:{onClose:()=>void}){
 const [query,setQuery]=useState(''),[results,setResults]=useState<Result[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();const timer=setTimeout(async()=>{setResults([]);setError(false);if(query.trim().length<2){setLoading(false);return;}setLoading(true);try{const response=await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`,{signal:controller.signal});if(!response.ok)throw Error();const data=await response.json();if(!controller.signal.aborted)setResults(Array.isArray(data)?data:data.results||[]);}catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setLoading(false);}},200);return()=>{clearTimeout(timer);controller.abort();};},[query]);
 return <Modal title="Search my atlas" onClose={onClose} className="public-search"><SearchField value={query} onChange={setQuery} label="Search published trips and places" placeholder="A trip, place or moment"/><div className="search-public-results" aria-live="polite">{loading?<p>Searching my journal…</p>:error?<p>Search is unavailable right now. Please try again.</p>:query.trim().length<2?<p>Enter at least two characters to search my published collection.</p>:results.length?results.map(r=><Link href={r.url} key={`${r.type}-${r.id}`} onClick={onClose}><div><small>{r.type}</small><h3>{r.title}</h3></div><ArrowUpRight size={18}/></Link>):<p>No published matches.</p>}</div></Modal>;
}
