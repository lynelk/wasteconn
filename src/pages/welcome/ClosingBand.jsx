export default function ClosingBand() {
  const handleContact = (e) => {
    e.preventDefault();
    const el = document.querySelector('#contact');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="contact" className="bg-[#14532D] py-14 px-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p
            className="text-[11px] font-semibold tracking-[0.2em] text-[#86EFAC] mb-2"
            style={{ fontFamily: 'monospace' }}
          >
            GET_IN_TOUCH · NLS_GROUP_UGANDA
          </p>
          <h2
            className="text-2xl lg:text-3xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Join Uganda's most connected<br />
            waste-management network.
          </h2>
        </div>
        <a
          href="mailto:info@nlsgroup.co.ug"
          className="shrink-0 inline-flex items-center gap-2 bg-white text-[#14532D] hover:bg-[#E3F1E8] font-semibold text-[14px] px-6 py-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#14532D]"
        >
          Talk to our team ›
        </a>
      </div>
    </section>
  );
}