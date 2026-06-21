import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Leaf } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Home',          href: '#hero' },
  { label: 'Features',      href: '#features' },
  { label: 'How It Works',  href: '#how-it-works' },
  { label: 'For Operators', href: '#operators' },
  { label: 'For Residents', href: '#residents' },
  { label: 'Contact',       href: '#contact' },
];

export default function WelcomeNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAnchor = (e, href) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      setMobileOpen(false);
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white border-b border-[#E5E7EB] shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between h-16">
          {/* Wordmark */}
          <a href="#hero" onClick={e => handleAnchor(e, '#hero')} className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-md bg-[#14532D] flex items-center justify-center shrink-0">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="text-[15px] font-bold tracking-tight"
                style={{ color: '#14532D', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                WasteConn
              </span>
              <span className="text-[10px] text-[#6B7280] tracking-wide leading-none mt-0.5">
                by NLS Transport &amp; Logistics
              </span>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={e => handleAnchor(e, link.href)}
                className={`text-[13px] font-medium transition-colors hover:text-[#14532D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F7A4D] rounded ${
                  scrolled ? 'text-[#374151]' : 'text-[#1F2937]'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA group */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/"
              className="text-[13px] font-medium text-[#374151] hover:text-[#14532D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F7A4D] rounded px-1"
            >
              Sign in
            </Link>
            <a
              href="#contact"
              onClick={e => handleAnchor(e, '#contact')}
              className="inline-flex items-center gap-1.5 bg-[#14532D] hover:bg-[#1F7A4D] text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#14532D]"
            >
              Get Started
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded-md text-[#374151] hover:text-[#14532D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F7A4D]"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-[#E5E7EB] px-6 pb-6 pt-4 space-y-1">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={e => handleAnchor(e, link.href)}
                className="block py-2.5 text-[14px] font-medium text-[#374151] hover:text-[#14532D] transition-colors border-b border-[#F3F4F6] last:border-0"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <Link
                to="/"
                className="text-center py-2.5 text-[14px] font-medium text-[#374151] border border-[#D1FAE5] rounded-lg hover:bg-[#E3F1E8]"
              >
                Sign in
              </Link>
              <a
                href="#contact"
                onClick={e => handleAnchor(e, '#contact')}
                className="text-center bg-[#14532D] hover:bg-[#1F7A4D] text-white text-[14px] font-semibold py-2.5 rounded-lg transition-colors"
              >
                Get Started
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
}