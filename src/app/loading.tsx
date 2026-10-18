import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-[99999] bg-white flex items-center justify-center select-none"
      role="status"
      aria-label="Loading"
    >
      <Loader2 className="w-8 h-8 text-neutral-800 animate-spin" />
    </div>
  );
}

