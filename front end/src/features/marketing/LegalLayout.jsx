import { ArrowLeft } from 'lucide-react';

export default function LegalLayout({ title, updated, children }) {
  return (
    <div style={{ background: '#050508', minHeight: '100vh' }} className="text-white">
      <header className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Greeto" className="h-6 object-contain brightness-0 invert" />
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Back to home
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{title}</h1>
        {updated && <p className="text-sm text-white/40 mb-10">Last updated: {updated}</p>}

        <div className="legal-content text-white/70 leading-relaxed">
          {children}
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/25">
          <p>© {new Date().getFullYear()} Northstar Edtech Private Limited · Greeto is a brand of Northstar Edtech Private Limited.</p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-white/60 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-white/60 transition-colors">Terms</a>
          </div>
        </div>
      </footer>

      <style>{`
        .legal-content h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: rgba(255,255,255,0.95);
          margin-top: 2.25rem;
          margin-bottom: 0.75rem;
        }
        .legal-content h3 {
          font-size: 1.05rem;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .legal-content p {
          margin-bottom: 1rem;
          font-size: 0.925rem;
        }
        .legal-content ul {
          list-style: disc;
          padding-left: 1.25rem;
          margin-bottom: 1rem;
          font-size: 0.925rem;
        }
        .legal-content ul ul {
          margin-top: 0.5rem;
          margin-bottom: 0;
        }
        .legal-content li {
          margin-bottom: 0.4rem;
        }
        .legal-content a {
          color: #a78bfa;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .legal-content a:hover {
          color: #c4b5fd;
        }
        .legal-content strong {
          color: rgba(255,255,255,0.9);
          font-weight: 600;
        }
        .legal-content address {
          font-style: normal;
          font-size: 0.925rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.75rem;
          padding: 1rem 1.25rem;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
