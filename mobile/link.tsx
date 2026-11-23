import React from "react";
import { prefetchRoute } from "./route-prefetch";
import { navigate } from "./navigation";
export default function Link({
  href,
  onClick,
  replace,
  scroll,
  prefetch,
  onPointerEnter,
  onFocus,
  onTouchStart,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
}) {
  const warm = () => {
    if (prefetch !== false && !props.target && !props.download)
      void prefetchRoute(href);
  };
  return (
    <a
      {...props}
      href={href}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        warm();
      }}
      onFocus={(e) => {
        onFocus?.(e);
        warm();
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        warm();
      }}
      onClick={(e) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          props.target ||
          props.download
        )
          return;
        if (new URL(href, location.href).origin !== location.origin) return;
        e.preventDefault();
        navigate(href, replace, scroll !== false);
      }}
    />
  );
}
