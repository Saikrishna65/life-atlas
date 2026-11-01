"use client";
import {useId} from 'react';
/** Abstract artwork only. Pattern choice and geometry never encode spending. */
export default function CategoryCardDecoration({variant}:{variant:number}){
 const id=`category-art-${useId().replace(/[^a-zA-Z0-9]/g,'')}`;const pattern=variant%12;
 return <span className="category-card-decoration" aria-hidden="true" data-pattern={pattern}><svg viewBox="0 0 200 120" preserveAspectRatio={[0,4,8,11].includes(pattern)?'xMidYMid meet':'none'} focusable="false"><defs><linearGradient id={id} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="var(--category-accent)"/><stop offset="1" stopColor="var(--category-accent)" stopOpacity=".12"/></linearGradient><linearGradient id={`${id}-fade`} x1="0" x2="0" y1="1" y2="0"><stop offset="0" stopColor="var(--category-accent)" stopOpacity=".7"/><stop offset="1" stopColor="var(--category-accent)" stopOpacity=".03"/></linearGradient></defs>
 {pattern===0?<><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#eeedf5" strokeWidth="14"/><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={`url(#${id})`} strokeWidth="14" strokeLinecap="round" pathLength="100" strokeDasharray="68 100"/></>
 :pattern===1?<>{[45,68,57,85,72,98,65,88,77,104,82,63].map((h,i)=><rect key={i} x={8+i*16} y={120-h} width="7" height={h} rx="3.5" fill={`url(#${id}-fade)`}/>)}</>
 :pattern===2?<><path d="M-15 105 C25 52 55 120 95 82 S160 55 220 98 L220 125H-15Z" fill={`url(#${id}-fade)`}/><path d="M-15 118 C25 66 65 125 108 99 S164 65 220 105" fill="none" stroke="var(--category-accent)" strokeWidth="2.5" opacity=".55"/></>
 :pattern===3?<>{Array.from({length:16},(_,i)=><circle key={i} cx={12+(i%8)*25} cy={i<8?87:111} r={i%3===0?5:3} fill="var(--category-accent)" opacity={.2+i%4*.15}/>)}</>
 :pattern===4?<>{[25,42,59,76].map((r,i)=><circle key={r} cx="110" cy="63" r={r} fill="none" stroke="var(--category-accent)" strokeWidth={i===2?12:2} opacity={i===2?.48:.17}/>)}</>
 :pattern===5?<>{[0,1,2,3].map(i=><path key={i} d={`M${-15+i*43} 128 Q${40+i*30} 55 ${90+i*32} 125`} fill="none" stroke={`url(#${id})`} strokeWidth="15" opacity={.25+i*.16}/>)}</>
 :pattern===6?<><path d="M-35 30 C105-30 5 90 170 55 S140 140 245 105" fill="none" stroke={`url(#${id})`} strokeWidth="27" opacity=".5"/><path d="M-35 30 C105-30 5 90 170 55 S140 140 245 105" fill="none" stroke="var(--category-accent)" strokeWidth="1.5" opacity=".6"/></>
 :pattern===7?<><path d="M-10 100H29L42 77 57 111 76 89 90 101H119L133 72 148 111 166 93 180 102H215" fill="none" stroke="var(--category-accent)" strokeWidth="2" opacity=".65"/><path d="M-10 113H215" stroke="var(--category-accent)" opacity=".12"/></>
 :pattern===8?<>{[0,1,2,3,4].map(i=><ellipse key={i} cx="102" cy="62" rx="53" ry="23" transform={`rotate(${i*36} 102 62)`} fill={`url(#${id})`} opacity=".2"/>)}</>
 :pattern===9?<>{[0,1,2,3,4,5,6,7].map(i=><rect key={i} x={-14+i*32} y="76" width="13" height="67" rx="6.5" transform={`rotate(28 ${-8+i*32} 100)`} fill={`url(#${id}-fade)`}/>)}</>
 :pattern===10?<>{Array.from({length:42},(_,i)=><circle key={i} cx={8+(i%14)*14} cy={83+Math.floor(i/14)*14} r={1.5+Math.floor(i/14)*.7} fill="var(--category-accent)" opacity={.15+(i%7)*.07}/>)}</>
 :<>{[80,62,44].map((r,i)=><path key={r} d={`M${100-r} 110 A${r} ${r} 0 0 1 ${100+r} 110`} fill="none" stroke={`url(#${id})`} strokeWidth="10" opacity={.3+i*.22}/>)}</>}
 </svg></span>;
}
