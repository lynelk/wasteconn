import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Leaf, Smartphone, WifiOff, Globe } from 'lucide-react';
import WelcomeNav from './welcome/WelcomeNav';
import StatStrip from './welcome/StatStrip';
import MarqueeBand from './welcome/MarqueeBand';
import ClosingBand from './welcome/ClosingBand';

/* ─────────────────────────────────────────────
   Feature cards – edit content here freely
───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Smartphone,
    title: 'Mobile-Money Billing',
    body:  'Customers pay via MTN MoMo or Airtel Money directly from their phones. Zero cash handling for your crew.',
  },
  {
    icon: WifiOff,
    title: 'Offline-First Operations',
    body:  'Field crews continue logging pickups and scanning bins even without connectivity. Data syncs automatically.',
  },
  {
    icon: Globe,
    title: 'End-to-End Visibility',
    body:  'From kerbside collection to disposal facility — every load is digitally tracked with GPS and timestamped proof.',
  },
  {
    icon: CheckCircle2,
    title: 'Compliance Ready',
    body:  'Automated EFRIS invoicing, NEMA reporting, and SLA monitoring keep you fully compliant without manual effort.',
  },
];

/* ─────────────────────────────────────────────
   How It Works steps
───────────────────────────────────────────── */
const STEPS = [
  { num: '01', title: 'Onboard your zone',         body: 'Map service zones, assign vehicles, and import your customer list in minutes.' },
  { num: '02', title: 'Dispatch & collect',         body: 'Drivers receive optimised routes on the field app. Pickups are logged with GPS evidence.' },
  { num: '03', title: 'Bill automatically',         body: 'Monthly invoices generate and mobile-money collection requests are sent without manual input.' },
  { num: '04', title: 'Report with confidence',     body: 'Compliance dashboards and EFRIS-linked receipts keep regulators satisfied.' },
];

/* ─────────────────────────────────────────────
   Fade-rise animation variant
───────────────────────────────────────────── */
const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

export default function Welcome() {
  const shouldReduceMotion = useReducedMotion();

  /* Parallax-lite: track scroll for subtle hero image shift */
  const heroRef = useRef(null);
  const [imgOffset, setImgOffset] = useState(0);
  useEffect(() => {
    if (shouldReduceMotion) return;
    const onScroll = () => {
      if (heroRef.current) {
        setImgOffset(window.scrollY * 0.22);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [shouldReduceMotion]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <WelcomeNav />

      {/* ── HERO ─────────────────────────────────── */}
      <section
        id="hero"
        ref={heroRef}
        className="relative min-h-[92vh] flex items-center overflow-hidden"
      >
        {/* Background photo + overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80')`,
            transform: shouldReduceMotion ? 'none' : `translateY(${imgOffset}px) scale(1.08)`,
            transformOrigin: 'center',
            transition: 'transform 0.05s linear',
          }}
          aria-hidden="true"
        />
        {/* White fade overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.96) 55%, rgba(255,255,255,0.55) 100%)' }}
          aria-hidden="true"
        />
        {/* Thin green rule top */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-[#14532D]" />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 lg:px-10 pt-28 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* LEFT – text */}
            <div>
              {/* Eyebrow */}
              <motion.p
                variants={fadeUp}
                initial={shouldReduceMotion ? 'visible' : 'hidden'}
                animate="visible"
                custom={0}
                className="text-[11px] font-semibold tracking-[0.22em] text-[#1F7A4D] mb-5"
                style={{ fontFamily: 'monospace' }}
              >
                DIGITAL_WASTE_OPS · GREATER KAMPALA
              </motion.p>

              {/* Headline */}
              <motion.h1
                variants={fadeUp}
                initial={shouldReduceMotion ? 'visible' : 'hidden'}
                animate="visible"
                custom={0.1}
                className="font-bold leading-[1.08] tracking-tight"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 'clamp(2.6rem, 5vw, 4.4rem)',
                  color: '#111827',
                }}
              >
                Smarter waste collection
                <br />
                for a{' '}
                <em
                  className="not-italic"
                  style={{ color: '#14532D', fontStyle: 'italic' }}
                >
                  cleaner Uganda.
                </em>
              </motion.h1>

              {/* Subheading */}
              <motion.p
                variants={fadeUp}
                initial={shouldReduceMotion ? 'visible' : 'hidden'}
                animate="visible"
                custom={0.22}
                className="mt-6 text-[17px] leading-relaxed max-w-xl"
                style={{ color: '#4B5563' }}
              >
                WasteConn digitises collection, billing, and compliance for NLS Transport &amp;
                Logistics — connecting households, businesses, and field crews across the
                Greater Kampala Metropolitan Area. Request a pickup, pay by mobile money,
                and track every load from collection to disposal.
              </motion.p>

              {/* CTA pair */}
              <motion.div
                variants={fadeUp}
                initial={shouldReduceMotion ? 'visible' : 'hidden'}
                animate="visible"
                custom={0.34}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <a
                  href="#contact"
                  onClick={e => { e.preventDefault(); document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="inline-flex items-center gap-2 bg-[#14532D] hover:bg-[#1F7A4D] text-white font-semibold text-[14px] px-6 py-3 rounded-lg transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#14532D]"
                >
                  Get Started
                </a>
                <a
                  href="#how-it-works"
                  onClick={e => { e.preventDefault(); document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="inline-flex items-center gap-1.5 border border-[#14532D] text-[#14532D] hover:bg-[#E3F1E8] font-semibold text-[14px] px-6 py-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14532D]"
                >
                  See How It Works <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>

              {/* Trust markers */}
              <motion.p
                variants={fadeUp}
                initial={shouldReduceMotion ? 'visible' : 'hidden'}
                animate="visible"
                custom={0.44}
                className="mt-5 text-[12px] tracking-wide"
                style={{ color: '#6B7280', fontFamily: 'monospace' }}
              >
                Mobile-money ready · Works offline · Licensed &amp; compliant · Built for GKMA
              </motion.p>
            </div>

            {/* RIGHT – stat strip */}
            <motion.div
              variants={fadeUp}
              initial={shouldReduceMotion ? 'visible' : 'hidden'}
              animate="visible"
              custom={0.28}
            >
              <StatStrip />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ──────────────────────────────── */}
      <MarqueeBand />

      {/* ── FEATURES ─────────────────────────────── */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-[#1F7A4D] mb-3"
            style={{ fontFamily: 'monospace' }}
          >
            SERVICE_MATRIX · WASTECONN
          </p>
          <h2
            className="text-3xl lg:text-4xl font-bold mb-12 max-w-xl"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }}
          >
            Everything your operation needs,{' '}
            <em style={{ color: '#14532D', fontStyle: 'italic' }}>in one platform.</em>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="group border border-[#E5E7EB] rounded-xl p-6 hover:border-[#14532D] hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-lg bg-[#E3F1E8] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#14532D]" />
                  </div>
                  <h3
                    className="font-bold text-[15px] mb-2 text-[#111827]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {f.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-[#6B7280]">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────── */}
      <section id="how-it-works" className="py-20 px-6 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-[#1F7A4D] mb-3"
            style={{ fontFamily: 'monospace' }}
          >
            ONBOARDING_FLOW · STEP_BY_STEP
          </p>
          <h2
            className="text-3xl lg:text-4xl font-bold mb-12 max-w-xl"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }}
          >
            Up and running in{' '}
            <em style={{ color: '#14532D', fontStyle: 'italic' }}>four steps.</em>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <div key={i} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-4 left-full w-full h-px bg-[#D1FAE5] -translate-x-8 z-0" />
                )}
                <div
                  className="relative z-10 text-[11px] font-bold tracking-[0.15em] text-[#1F7A4D] mb-3"
                  style={{ fontFamily: 'monospace' }}
                >
                  {s.num}
                </div>
                <h3
                  className="font-bold text-[16px] mb-2 text-[#111827]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {s.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-[#6B7280]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR OPERATORS ─────────────────────────── */}
      <section id="operators" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p
                className="text-[11px] font-semibold tracking-[0.22em] text-[#1F7A4D] mb-3"
                style={{ fontFamily: 'monospace' }}
              >
                FOR_OPERATORS · WASTE_MANAGEMENT_CO
              </p>
              <h2
                className="text-3xl lg:text-4xl font-bold mb-5"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }}
              >
                Built for the way Uganda's{' '}
                <em style={{ color: '#14532D', fontStyle: 'italic' }}>operators actually work.</em>
              </h2>
              <p className="text-[15px] leading-relaxed text-[#4B5563] mb-6">
                WasteConn is designed around the realities of Kampala's urban waste landscape —
                mixed-traffic routes, USSD-only customers, multi-site institutions, and
                subcontractor networks. Every workflow is optimised for field conditions,
                not just office dashboards.
              </p>
              <ul className="space-y-3">
                {[
                  'AI-optimised routing reduces fuel cost & missed stops',
                  'Subcontractor allocation with GPS-verified completion',
                  'Fleet telematics with predictive maintenance alerts',
                  'Multi-tenant architecture for franchise operations',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14px] text-[#374151]">
                    <span className="w-5 h-5 rounded-full bg-[#E3F1E8] flex items-center justify-center shrink-0 mt-0.5">
                      <Leaf className="w-2.5 h-2.5 text-[#14532D]" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#E3F1E8] rounded-2xl p-8 lg:p-10">
              <p
                className="text-[11px] font-semibold tracking-[0.22em] text-[#1F7A4D] mb-4"
                style={{ fontFamily: 'monospace' }}
              >
                IMPACT_METRICS
              </p>
              <div className="space-y-5">
                {[
                  { label: 'Collection efficiency improvement', val: '↑ 37%' },
                  { label: 'Billing disputes reduced',          val: '↓ 82%' },
                  { label: 'Driver idle time saved',            val: '↓ 29%' },
                  { label: 'Digital payment adoption',          val: '↑ 91%' },
                ].map((m, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-[#C6E8D2] pb-4 last:border-0 last:pb-0">
                    <span className="text-[13px] text-[#374151]">{m.label}</span>
                    <span
                      className="text-[20px] font-bold text-[#14532D]"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {m.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR RESIDENTS ─────────────────────────── */}
      <section id="residents" className="py-20 px-6 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-[#1F7A4D] mb-3"
            style={{ fontFamily: 'monospace' }}
          >
            FOR_RESIDENTS · HOUSEHOLD_&amp;_BUSINESS
          </p>
          <h2
            className="text-3xl lg:text-4xl font-bold mb-5 max-w-lg"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827' }}
          >
            Simple for everyone,{' '}
            <em style={{ color: '#14532D', fontStyle: 'italic' }}>even offline.</em>
          </h2>
          <p className="text-[15px] leading-relaxed text-[#4B5563] mb-10 max-w-2xl">
            Households and businesses access WasteConn through the app, web, or USSD —
            whichever works for them. Request a pickup, check your billing, and receive
            collection reminders in English, Luganda, or Swahili.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { channel: 'Mobile App',   desc: 'Full-featured app for pickup requests, payments, and live tracking.',      tag: 'Android & iOS' },
              { channel: 'Web Portal',   desc: 'Manage multiple locations, view invoices, and download compliance reports.', tag: 'Any browser' },
              { channel: 'USSD *185#',   desc: 'Works on any phone, any network. No data required for basic operations.',   tag: 'No internet needed' },
            ].map((c, i) => (
              <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                <span className="inline-block text-[10px] font-bold tracking-[0.18em] bg-[#E3F1E8] text-[#14532D] px-2.5 py-1 rounded-full mb-4" style={{ fontFamily: 'monospace' }}>
                  {c.tag}
                </span>
                <h3
                  className="font-bold text-[16px] mb-2 text-[#111827]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {c.channel}
                </h3>
                <p className="text-[13px] leading-relaxed text-[#6B7280]">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLOSING BAND ─────────────────────────── */}
      <ClosingBand />

      {/* ── FOOTER ───────────────────────────────── */}
      <footer className="bg-[#111827] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[#14532D] flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span
              className="text-[13px] font-bold text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              WasteConn
            </span>
            <span className="text-[11px] text-[#6B7280]">by NLS Transport &amp; Logistics</span>
          </div>
          <p className="text-[12px] text-[#6B7280]">
            © {new Date().getFullYear()} NLS Group Uganda. Licensed waste management operator — GKMA.
          </p>
          <div className="flex gap-6">
            {['Privacy', 'Terms', 'NEMA Compliance'].map(l => (
              <a key={l} href="#" className="text-[12px] text-[#9CA3AF] hover:text-white transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}