'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export default function AtlasLauncher() {
  const pathname = usePathname();
  if (pathname === '/secret/atlas') return null;
  return <Link href="/secret/atlas" aria-label="Open Atlas local assistant" className="fixed right-4 bottom-28 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/40 bg-surface text-2xl text-amber-500 shadow-lg transition-transform hover:scale-105 motion-reduce:transition-none">✦</Link>;
}
