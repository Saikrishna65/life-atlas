export default function Loading() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center pt-32">
      <div className="flex flex-col items-center gap-6">
        <div className="w-8 h-8 rounded-full border border-white/20 border-t-white/60 animate-spin" />
        <span className="font-sans text-[10px] uppercase tracking-widest text-white/40">
          Loading archive
        </span>
      </div>
    </main>
  );
}
