const WORDS = [
  'SMART COLLECTION',
  'DIGITAL TICKETING',
  'ROUTE OPTIMISATION',
  'MOBILE-MONEY BILLING',
  'OFFLINE-FIRST',
  'WASTE-TO-ENERGY READY',
  'SMART COLLECTION',
  'DIGITAL TICKETING',
  'ROUTE OPTIMISATION',
  'MOBILE-MONEY BILLING',
  'OFFLINE-FIRST',
  'WASTE-TO-ENERGY READY',
];

export default function MarqueeBand() {
  const prefersReduced =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  return (
    <div className="w-full overflow-hidden border-y border-[#D1FAE5] bg-[#E3F1E8] py-3 select-none">
      <div
        className="flex gap-0 whitespace-nowrap"
        style={{
          animation: prefersReduced ? 'none' : 'marquee 28s linear infinite',
        }}
      >
        {WORDS.map((word, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-4 text-[11px] font-semibold tracking-[0.18em] text-[#14532D]"
            style={{ fontFamily: 'monospace' }}
          >
            {word}
            <span className="text-[#1F7A4D] opacity-50 mx-3">·</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}