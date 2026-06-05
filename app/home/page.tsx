import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'CopyPilot - AI-powered SEO copy tools',
  description: 'Generate FAQ sections, meta copy, page intros and full page copy at scale. Built for SEO teams and agencies.',
}

const tools = [
  {
    name: 'FAQ Copy',
    slug: 'faq',
    description: 'Generate FAQ sections with Schema.org JSON-LD from PAA data, AI Overviews, and GSC keywords.',
    status: 'live',
    href: '/faq/jobs',
    icon: '❓',
  },
  {
    name: 'Meta Copy',
    slug: 'meta',
    description: 'Title tags, meta descriptions, and optimised H1s at scale using keyword scoring and business context.',
    status: 'soon',
    href: null,
    icon: '🏷️',
  },
  {
    name: 'Page Intro',
    slug: 'intro',
    description: 'Introductory paragraphs from keyword clusters, scraped page context, and competitor signals.',
    status: 'live',
    href: '/intro/jobs',
    icon: '📄',
  },
  {
    name: 'Page Copy',
    slug: 'page',
    description: 'Full page copy for blog posts, case studies, and category pages with structured output.',
    status: 'soon',
    href: null,
    icon: '📝',
  },
]

export default function HomePage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      overflowX: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .anim-1 { animation: fadeUp 0.7s ease both; }
        .anim-2 { animation: fadeUp 0.7s 0.1s ease both; }
        .anim-3 { animation: fadeUp 0.7s 0.2s ease both; }
        .anim-4 { animation: fadeUp 0.7s 0.3s ease both; }
        .live-dot { width: 5px; height: 5px; border-radius: 50%; background: #00c9a7; display: inline-block; animation: pulse-dot 2s ease-in-out infinite; }
        .tool-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 28px; transition: border-color 0.2s, transform 0.2s; text-decoration: none; color: inherit; display: block; position: relative; overflow: hidden; }
        .tool-card.live:hover { border-color: rgba(0,201,167,0.4); transform: translateY(-2px); }
        .cta-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: var(--bg); font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 10px; text-decoration: none; letter-spacing: -0.01em; transition: opacity 0.15s, transform 0.15s; font-family: inherit; }
        .cta-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .ghost-btn { display: inline-flex; align-items: center; background: transparent; color: var(--muted); font-weight: 500; font-size: 15px; padding: 14px 24px; border-radius: 10px; text-decoration: none; border: 1px solid var(--border); transition: border-color 0.15s, color 0.15s; }
        .ghost-btn:hover { border-color: #6b6b80; color: #e8e8f0; }
        .nav-link { font-size: 13px; color: #6b6b80; text-decoration: none; transition: color 0.15s; }
        .nav-link:hover { color: #e8e8f0; }
      `}</style>

      {/* Glow */}
      <div style={{ position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)', width: 800, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,201,167,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--bg) 92%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/favicon-32x32.png" alt="CopyPilot" style={{ width: 22, height: 22 }} />
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.03em' }}>CopyPilot</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="/changelog" className="nav-link">Changelog</a>
            <a href="/signup" className="cta-btn" style={{ padding: '8px 18px', fontSize: 13 }}>Sign up</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 24px 80px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div className="anim-1" style={{ marginBottom: 28 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#00c9a7', background: 'rgba(0,201,167,0.08)', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 20, padding: '5px 14px' }}>
            <span className="live-dot" /> FAQ Copy + Page Intro now live
          </span>
        </div>

        <h1 className="anim-2" style={{ fontSize: 'clamp(42px, 7vw, 72px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 24 }}>
          AI-powered SEO copy<br />
          <span style={{ background: 'linear-gradient(135deg, #00c9a7, #00e5c0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>at scale.</span>
        </h1>

        <p className="anim-3" style={{ fontSize: 'clamp(16px, 2.5vw, 19px)', color: 'var(--muted)', lineHeight: 1.65, maxWidth: 520, margin: '0 auto 40px' }}>
          A suite of tools built for SEO teams and agencies. Add URLs, configure once, download production-ready copy.
        </p>

        <div className="anim-4" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/signup" className="cta-btn">Try FAQ Copy free →</a>
          <a href="/changelog" className="ghost-btn">View changelog</a>
        </div>
      </section>

      {/* Tools */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 100px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>The suite</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>Each tool handles one content type. All share the same keyword pipeline and AI providers.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {tools.map(tool => (
            tool.status === 'live' ? (
              <a key={tool.slug} href={tool.href!} target="_blank" rel="noreferrer" className="tool-card live">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>{tool.icon}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#00c9a7', background: 'rgba(0,201,167,0.08)', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 20, padding: '3px 10px' }}>
                    <span className="live-dot" />Live
                  </span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>{tool.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{tool.description}</p>
                <div style={{ marginTop: 20, fontSize: 12, color: '#00c9a7', fontWeight: 600 }}>Open tool →</div>
              </a>
            ) : (
              <div key={tool.slug} className="tool-card" style={{ opacity: 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>{tool.icon}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', background: 'rgba(107,107,128,0.08)', border: '1px solid rgba(107,107,128,0.15)', borderRadius: 20, padding: '3px 10px' }}>Soon</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>{tool.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{tool.description}</p>
              </div>
            )
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ borderTop: '1px solid var(--border)', padding: '80px 24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,201,167,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 16 }}>Start generating copy today.</h2>
        <p style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 32 }}>FAQ Copy is live and free to try. No credit card required.</p>
        <a href="/signup" className="cta-btn">Get started →</a>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1100, margin: '0 auto', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/favicon-32x32.png" alt="CopyPilot" style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>CopyPilot</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/faq/jobs" className="nav-link">FAQ Copy</Link>
          <a href="/changelog" className="nav-link">Changelog</a>
        </div>
      </footer>
    </main>
  )
}
