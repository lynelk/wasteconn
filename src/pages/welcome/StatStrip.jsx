import { useEffect, useRef, useState } from 'react';

const STATS = [
  { value: 5,     suffix: '',   prefix: '',   label: 'Divisions of GKMA served',         display: '5' },
  { value: 100,   suffix: '%',  prefix: '',   label: 'Digital tickets & proof-of-service', display: '100%' },
  { value: 24,    suffix: '/7', prefix: '',   label: 'USSD, app & web access',            display: '24/7' },
  { value: 3,     suffix: '',   prefix: '',   label: 'Languages — English, Luganda, Swahili', display: '3' },
];

function useCountUp(target, duration = 1600, start = false) {
  const [count, setCount] = useState(0);
  const prefersReduced = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  useEffect(() => {
    if (!start || prefersReduced) {
      setCount(target);
      return;
    }
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration, prefersReduced]);

  return count;
}

function StatItem({ stat, active }) {
  const count = useCountUp(stat.value, 1800, active);

  const display = () => {
    if (stat.suffix === '%') return `${count}%`;
    if (stat.suffix === '/7') return `${count}/7`;
    return `${stat.prefix}${count}${stat.suffix}`;
  };

  return (
    <div className="flex flex-col items-start gap-1 py-6 pl-6 border-l border-[#D1FAE5] first:border-l-0 first:pl-0">
      <span
        className="text-4xl lg:text-5xl font-bold tabular-nums leading-none"
        style={{ color: '#14532D', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {display()}
      </span>
      <span className="text-[12px] text-[#6B7280] leading-snug max-w-[120px]">{stat.label}</span>
    </div>
  );
}

export default function StatStrip() {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActive(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid grid-cols-2 lg:grid-cols-4 gap-0 mt-10 lg:mt-0">
      {STATS.map((stat, i) => (
        <StatItem key={i} stat={stat} active={active} />
      ))}
    </div>
  );
}