import React from 'react';
import { navigate } from './navigation';
export default function Link({href, onClick, replace, scroll, prefetch: _prefetch, ...props}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {href: string; replace?: boolean; scroll?: boolean; prefetch?: boolean}) {
  return <a {...props} href={href} onClick={e => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || props.target || props.download) return;
    if (new URL(href, location.href).origin !== location.origin) return;
    e.preventDefault(); navigate(href, replace, scroll !== false);
  }} />;
}
