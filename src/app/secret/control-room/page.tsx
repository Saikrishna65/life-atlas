"use client";
import dynamic from 'next/dynamic';
const ControlRoom=dynamic(()=>import('@/components/control-room/ControlRoom'),{ssr:false,loading:()=> <div className="mx-auto max-w-6xl py-20 text-center text-sm text-muted-foreground">Opening Atlas Control Room…</div>});
export default function ControlRoomPage(){return <ControlRoom/>;}
