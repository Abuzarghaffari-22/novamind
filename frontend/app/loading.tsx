export default function Loading() {
  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-nova-500 to-accent-cyan animate-pulse" />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-nova-500 to-accent-cyan blur-xl opacity-50" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display font-black text-xl text-white relative z-10">N</span>
          </div>
        </div>
        <div className="space-y-2 text-center">
          <div className="h-3 w-28 rounded-full bg-ink-800 shimmer-line" />
          <div className="h-2 w-20 rounded-full bg-ink-800 shimmer-line mx-auto" />
        </div>
      </div>
    </div>
  );
}
