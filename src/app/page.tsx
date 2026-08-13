import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Calculator } from "@/components/landing/calculator"
import { ProblemSection } from "@/components/landing/problem-section"
import { ProductDiagram } from "@/components/landing/product-diagram"
import { Inter, Fraunces, IBM_Plex_Mono } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

export default async function LandingPage() {
  const session = await getServerSession(authOptions)
  
  if (session && (session as any).error === "SuspendedAccount") {
    redirect("/suspended")
  }

  if (session?.user?.id) {
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
      include: { organization: true }
    })
    
    if (membership?.organization?.slug) {
      redirect(`/${membership.organization.slug}`)
    } else {
      redirect('/onboarding')
    }
  }

  return (
    <div className={`landing-theme ${inter.className}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .landing-theme {
          --void: #FAFAFA; 
          --ledger: #FFFFFF;
          --ledger-2: #F4F4F5; 
          --paper: #FFFFFF;
          --paper-2: #F4F4F5;
          --ink: #111827; 
          --brass: #1AA772; 
          --brass-dim: #13885C; 
          --rust: #DC2626; 
          --settle: #1AA772;
          --text-hi: #111827;
          --text-mid: #4B5563;
          --text-low: #9CA3AF;
          --border: rgba(0,0,0,0.06);

          background: var(--void);
          color: var(--text-hi);
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          min-height: 100vh;
        }
        
        .landing-theme * { box-sizing: border-box; margin: 0; padding: 0; }
        .landing-theme .mono { font-family: ${ibmPlexMono.style.fontFamily}, monospace; }
        .landing-theme .display { font-family: ${fraunces.style.fontFamily}, serif; }
        .landing-theme a { color: inherit; text-decoration: none; }
        .landing-theme .wrap { max-width: 1180px; margin: 0 auto; padding: 0 32px; }

        /* NAV */
        .landing-theme nav {
          position: sticky; top: 0; z-index: 50;
          background: rgba(250, 250, 250, 0.85);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--border);
        }
        .landing-theme nav .wrap {
          display: flex; align-items: center; justify-content: space-between;
          height: 76px;
        }
        .landing-theme .logo { display: flex; align-items: center; }
        .landing-theme .nav-links { display: flex; align-items: center; gap: 36px; font-size: 14.5px; color: var(--text-mid); font-weight: 500; }
        .landing-theme .nav-links a:hover { color: var(--text-hi); }
        .landing-theme .btn {
          padding: 11px 20px; border-radius: 8px; font-size: 14.5px; font-weight: 600;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap;
          border: 1px solid transparent;
          transition: transform .15s ease, background .15s ease, border-color .15s ease;
        }
        .landing-theme .btn-primary { background: var(--brass); color: #FFFFFF; }
        .landing-theme .btn-primary:hover { transform: translateY(-1px); background: var(--brass-dim); }
        .landing-theme .btn-ghost { border-color: var(--border); color: var(--text-hi); }
        .landing-theme .btn-ghost:hover { border-color: var(--text-mid); }
        .landing-theme .mobile-menu-toggle { display: none; }
        .landing-theme .hamburger { display: none; font-size: 24px; cursor: pointer; user-select: none; }
        .landing-theme .mobile-menu { display: none; }

        /* PERFORATION */
        .landing-theme .perf {
          height: 20px; width: 100%;
          background-image: radial-gradient(circle, rgba(0,0,0,0.06) 1.6px, transparent 1.6px);
          background-size: 16px 100%;
          background-repeat: repeat-x;
          background-position: center;
        }

        /* HERO */
        .landing-theme .hero {
          padding: 56px 0 80px;
        }
        .landing-theme .hero-grid {
          display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 64px; align-items: center;
        }
        .landing-theme .hero-grid > div:first-child { width: 100%; }
        .landing-theme .eyebrow {
          display: flex; width: max-content; max-width: 100%; margin: 0 auto 48px; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center;
          font-size: 12.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-align: center; line-height: 1.4;
          color: var(--brass); border: 1px solid rgba(26, 167, 114, 0.2); background: rgba(26, 167, 114, 0.08);
          padding: 7px 14px; border-radius: 100px;
        }
        .landing-theme .eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brass); }
        .landing-theme h1.display {
          font-size: 52px; line-height: 1.08; font-weight: 600; letter-spacing: -0.01em;
          color: var(--text-hi); max-width: 620px;
        }
        .landing-theme h1.display em {
          font-style: italic; color: var(--brass); font-weight: 500;
        }
        .landing-theme .hero p.lede {
          margin-top: 24px; font-size: 17.5px; line-height: 1.65; color: var(--text-mid); max-width: 480px;
        }
        .landing-theme .hero-ctas { display: flex; align-items: center; gap: 16px; margin-top: 36px; }
        .landing-theme .hero-note { margin-top: 20px; font-size: 13px; color: var(--text-low); }

        /* RECEIPT */
        .landing-theme .receipt-wrap { position: relative; display: flex; justify-content: center; }
        .landing-theme .receipt {
          background: var(--paper);
          color: var(--ink);
          width: 100%; max-width: 400px;
          padding: 32px 30px 40px;
          font-family: ${ibmPlexMono.style.fontFamily}, monospace;
          font-size: 13.5px;
          line-height: 1.7;
          box-shadow: 0 30px 60px -20px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05);
          clip-path: polygon(
            0% 0%, 100% 0%,
            100% 97%, 95% 100%, 90% 97%, 85% 100%, 80% 97%, 75% 100%,
            70% 97%, 65% 100%, 60% 97%, 55% 100%, 50% 97%, 45% 100%,
            40% 97%, 35% 100%, 30% 97%, 25% 100%, 20% 97%, 15% 100%,
            10% 97%, 5% 100%, 0% 97%
          );
          transform: rotate(-1.2deg);
        }
        .landing-theme .receipt-head { text-align: center; margin-bottom: 6px; }
        .landing-theme .receipt-head .r-title { font-weight: 600; font-size: 14px; letter-spacing: 0.02em; }
        .landing-theme .receipt-head .r-sub { color: var(--text-mid); font-size: 11.5px; margin-top: 2px; }
        .landing-theme .receipt-dash { border-top: 1.5px dashed var(--border); margin: 14px 0; }
        .landing-theme .r-line {
          display: flex; justify-content: space-between; gap: 12px;
          opacity: 0; transform: translateY(6px);
          animation: rline-in .5s ease forwards;
        }
        .landing-theme .r-line.neg { color: var(--rust); }
        .landing-theme .r-line.neg .r-val::before { content: "− "; }
        .landing-theme .r-total {
          display: flex; justify-content: space-between; font-weight: 600; font-size: 15px;
          margin-top: 8px; opacity: 0; transform: translateY(6px);
          animation: rline-in .5s ease forwards;
        }
        .landing-theme .stamp {
          margin-top: 18px; text-align: center;
          opacity: 0; transform: scale(1.4) rotate(-8deg);
          animation: stamp-in .4s cubic-bezier(.2,1.4,.4,1) forwards;
        }
        .landing-theme .stamp span {
          display: inline-block;
          border: 2.5px solid var(--settle); color: var(--settle);
          font-family: ${ibmPlexMono.style.fontFamily}, monospace; font-weight: 600; font-size: 13px; letter-spacing: 0.06em;
          padding: 6px 16px; border-radius: 6px; transform: rotate(-6deg);
          text-transform: uppercase;
        }
        @keyframes rline-in { to { opacity: 1; transform: translateY(0); } }
        @keyframes stamp-in { to { opacity: 1; transform: scale(1) rotate(-6deg); } }

        .landing-theme .r-line:nth-of-type(1) { animation-delay: .3s; }
        .landing-theme .r-line:nth-of-type(2) { animation-delay: .7s; }
        .landing-theme .r-line:nth-of-type(3) { animation-delay: 1.05s; }
        .landing-theme .r-line:nth-of-type(4) { animation-delay: 1.4s; }
        .landing-theme .r-total { animation-delay: 1.85s; }
        .landing-theme .stamp { animation-delay: 2.25s; }

        /* SECTIONS */
        .landing-theme .section { padding: 64px 0; }
        .landing-theme .section-head { text-align: center; max-width: 600px; margin: 0 auto 56px; }
        .landing-theme .section-tag { font-size: 12.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brass); margin-bottom: 14px; }
        .landing-theme .section-head h2 { font-size: 34px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; }
        .landing-theme .section-head p { color: var(--text-mid); font-size: 16px; margin-top: 14px; line-height: 1.6; }

        /* PROBLEM STAMPS */
        .landing-theme .problem-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 24px; }
        .landing-theme .p-card {
          background: var(--ledger); border: 1px solid var(--border); border-radius: 14px;
          padding: 28px 26px; position: relative; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
        }
        .landing-theme .p-stamp {
          display: inline-block; font-family: ${ibmPlexMono.style.fontFamily}, monospace; font-size: 11px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase; padding: 5px 11px; border-radius: 5px;
          border: 2px solid; transform: rotate(-4deg); margin-bottom: 18px;
        }
        .landing-theme .p-stamp.rust { color: var(--rust); border-color: var(--rust); }
        .landing-theme .p-stamp.brass { color: var(--brass); border-color: var(--brass); }
        .landing-theme .p-stamp.ink { color: var(--ink); border-color: var(--ink); }
        .landing-theme .p-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
        .landing-theme .p-card p { font-size: 14.5px; color: var(--text-mid); line-height: 1.6; }

        /* FEATURES */
        .landing-theme .feat-list { display: flex; flex-direction: column; }
        .landing-theme .feat-row {
          display: grid; grid-template-columns: 44px 1fr 1.3fr; gap: 28px; align-items: start;
          padding: 32px 0; border-top: 1px solid var(--border);
        }
        .landing-theme .feat-row:last-child { border-bottom: 1px solid var(--border); }
        .landing-theme .feat-num { font-family: ${ibmPlexMono.style.fontFamily}, monospace; color: var(--text-low); font-size: 13px; padding-top: 4px; }
        .landing-theme .feat-icon {
          width: 44px; height: 44px; border-radius: 10px; background: var(--ledger); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .landing-theme .feat-title h3 { font-size: 19px; font-weight: 600; margin-bottom: 6px; }
        .landing-theme .feat-title span { font-size: 13px; color: var(--brass); font-family: ${ibmPlexMono.style.fontFamily}, monospace; }
        .landing-theme .feat-desc p { font-size: 15px; line-height: 1.65; color: var(--text-mid); }

        /* CALCULATOR */
        .landing-theme .calc {
          background: var(--ledger); border: 1px solid var(--border); border-radius: 18px;
          padding: 44px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.03);
        }
        .landing-theme .calc-inputs label { display: block; font-size: 13px; color: var(--text-mid); margin-bottom: 8px; margin-top: 20px; font-weight: 500; }
        .landing-theme .calc-inputs label:first-child { margin-top: 0; }
        .landing-theme .calc-inputs input[type=range] { width: 100%; accent-color: var(--brass); }
        .landing-theme .calc-inputs .val { font-family: ${ibmPlexMono.style.fontFamily}, monospace; color: var(--text-hi); font-weight: 600; }
        .landing-theme .calc-result {
          background: var(--ledger-2); border: 1px solid var(--border); border-radius: 12px; padding: 28px;
          text-align: center;
        }
        .landing-theme .calc-result .label { font-size: 12.5px; color: var(--text-low); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
        .landing-theme .calc-result .amount { font-family: ${ibmPlexMono.style.fontFamily}, monospace; font-size: 38px; font-weight: 600; color: var(--rust); margin-top: 10px; }
        .landing-theme .calc-result .sub { font-size: 13px; color: var(--text-mid); margin-top: 8px; }

        /* CTA / FOOTER */
        .landing-theme .cta-section { text-align: center; padding: 100px 0 60px; }
        .landing-theme .cta-section h2 { font-size: 38px; font-weight: 600; max-width: 560px; margin: 0 auto 18px; line-height: 1.2; }
        .landing-theme .cta-section p { color: var(--text-mid); font-size: 16.5px; max-width: 460px; margin: 0 auto 36px; }
        .landing-theme .barcode {
          height: 46px; margin: 0 auto 40px; max-width: 280px;
          background: repeating-linear-gradient(90deg, var(--text-low) 0 2px, transparent 2px 4px, var(--text-low) 4px 5px, transparent 5px 9px, var(--text-low) 9px 12px, transparent 12px 14px);
          opacity: 0.2;
        }
        .landing-theme footer { border-top: 1px solid var(--border); padding: 48px 0; }
        .landing-theme .foot-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 32px; }
        .landing-theme .foot-brand p { color: var(--text-mid); font-size: 13.5px; margin-top: 12px; max-width: 260px; line-height: 1.6; }
        .landing-theme .foot-col h4 { font-size: 13px; color: var(--text-hi); margin-bottom: 14px; font-weight: 600; }
        .landing-theme .foot-col a { display: block; font-size: 14px; color: var(--text-mid); margin-bottom: 10px; }
        .landing-theme .foot-col a:hover { color: var(--text-hi); }
        .landing-theme .foot-bottom { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border); font-size: 13px; color: var(--text-low); }

        @media (max-width: 900px) {
          .landing-theme .wrap { padding: 0 20px; }
          .landing-theme .hero-grid { grid-template-columns: minmax(0, 1fr); gap: 40px; }
          .landing-theme h1.display { font-size: 32px; max-width: 100%; }
          .landing-theme .hero p.lede { max-width: 100%; font-size: 15.5px; }
          .landing-theme .hero-ctas { flex-direction: column; align-items: stretch; width: 100%; gap: 12px; }
          .landing-theme .hero-ctas .btn { width: 100%; justify-content: center; }
          .landing-theme .receipt { padding: 20px 16px; max-width: 100%; font-size: 11px; }
          .landing-theme .r-total { font-size: 13px; }
          .landing-theme .problem-grid { grid-template-columns: minmax(0, 1fr); }
          .landing-theme .feat-row { grid-template-columns: 36px minmax(0, 1fr); }
          .landing-theme .feat-desc { grid-column: 2; }
          .landing-theme .calc { grid-template-columns: minmax(0, 1fr); padding: 24px; }
          .landing-theme .foot-grid { grid-template-columns: 1fr 1fr; }
          .landing-theme .nav-links { flex: 1; justify-content: flex-end; margin-right: 16px; margin-left: 12px; }
          .landing-theme .nav-links a[href^="#"] { display: none; }
        }
        @media (max-width: 500px) {
          .landing-theme .nav-links { display: none; }
          .landing-theme .hamburger { display: block; order: -1; margin: 0; }
          .landing-theme .logo { margin: 0 auto; }
          .landing-theme .btn { padding: 9px 12px; font-size: 13.5px; }
          .landing-theme .nav-buttons { margin-left: 0 !important; }
          .landing-theme .mobile-menu {
            display: none; position: absolute; top: 76px; left: 0; right: 0; background: var(--void);
            padding: 20px; border-bottom: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.05); z-index: 40;
          }
          .landing-theme .mobile-menu a { display: block; padding: 12px 0; font-size: 16px; font-weight: 500; color: var(--text-mid); border-bottom: 1px solid var(--border); }
          .landing-theme .mobile-menu a:last-child { border-bottom: none; }
          .landing-theme .mobile-menu-toggle:checked ~ .mobile-menu { display: block; }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-theme * { animation-duration: 0.01ms !important; animation-delay: 0s !important; transition-duration: 0.01ms !important; }
        }
      `}} />

      <nav>
        <div className="wrap" style={{ position: 'relative' }}>
          <div className="logo">
            <Image src="/MARGIN.png" alt="Margin" width={96} height={48} style={{ objectFit: 'contain' }} />
          </div>
          <div className="nav-links">
            <Link href="/pricing">Pricing</Link>
            <Link href="#problem">Why margin</Link>
            <Link href="#features">Product</Link>
            <Link href="#calc">The gap</Link>
          </div>
          <input type="checkbox" id="mobile-menu-toggle" className="mobile-menu-toggle" />
          <label htmlFor="mobile-menu-toggle" className="hamburger">☰</label>
          <div className="mobile-menu">
            <Link href="/pricing">Pricing</Link>
            <Link href="#problem">Why margin</Link>
            <Link href="#features">Product</Link>
            <Link href="#calc">The gap</Link>
          </div>
          <div className="nav-buttons" style={{ display: 'flex', gap: '8px' }}>
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
            <Link href="/login?mode=signup" className="btn btn-primary">Get started</Link>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <div className="eyebrow"><span className="eyebrow-dot"></span>Built for builders.</div>
          <div className="hero-grid">
            <div>
              <h1 className="display">Shopify says one number.<br />Your <em>cash on hand</em> says another.</h1>
              <p className="lede">Margin connects your storefront and courier to give you the real number. See exactly what&apos;s pending, what&apos;s returned, and what&apos;s actually settled in cash.</p>
              <div className="hero-ctas">
                <Link href="/login?mode=signup" className="btn btn-primary">Create free workspace</Link>
                <Link href="/login" className="btn btn-ghost">Sign in to dashboard</Link>
              </div>
              <div className="hero-note mono">No credit card. Connects to Shopify + Bosta in under 5 minutes.</div>
            </div>

          <div className="receipt-wrap">
            <div className="receipt">
              <div className="receipt-head">
                <div className="r-title">MARGIN TRACKING</div>
                <div className="r-sub">ORDER BATCH #2044 · CAIRO</div>
              </div>
              <div className="receipt-dash"></div>
              <div className="r-line"><span>SHOPIFY REPORTED REVENUE</span><span className="r-val">12,400 EGP</span></div>
              <div className="r-line neg"><span>RETURNED (COD REFUSED)</span><span className="r-val">2,150 EGP</span></div>
              <div className="r-line neg"><span>COURIER FEES (BOSTA)</span><span className="r-val">340 EGP</span></div>
              <div className="r-line neg"><span>PENDING SETTLEMENT</span><span className="r-val">1,800 EGP</span></div>
              <div className="receipt-dash"></div>
              <div className="r-total"><span>ACTUAL CASH RECEIVED</span><span>8,110 EGP</span></div>
              <div className="stamp"><span>Settled</span></div>
            </div>
          </div>
        </div>
        </div>
      </header>

      <div className="perf"></div>

      <section className="section" id="features">
        <div className="wrap">
          <div className="section-head">
            <div className="section-tag">The product</div>
            <h2>Built around how you already work</h2>
            <p>No new habits. Margin reads the receipts and voice notes you&apos;re already using, and syncs with the tools you already run on.</p>
          </div>
          <ProductDiagram />
          <div className="feat-list">
            <div className="feat-row">
              <div className="feat-num">01</div>
              <div className="feat-title">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1AA772" strokeWidth="1.6"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
                </div>
                <h3 style={{ marginTop: '14px' }}>Instapay Vision</h3>
                <span>Receipt scanning</span>
              </div>
              <div className="feat-desc"><p>Upload a screenshot of an Instapay transfer. Margin reads the amount, date, and sender in mixed Arabic and English, and logs it against the right order automatically.</p></div>
            </div>
            <div className="feat-row">
              <div className="feat-num">02</div>
              <div className="feat-title">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1AA772" strokeWidth="1.6"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0M12 19v3"/></svg>
                </div>
                <h3 style={{ marginTop: '14px' }}>Ammiya voice notes</h3>
                <span>Egyptian Arabic transcription</span>
              </div>
              <div className="feat-desc"><p>Driving between drop-offs? Say &quot;دفعت للمندوب ١٥٠ جنيه&quot; and Margin transcribes and logs the expense before you&apos;ve parked the car.</p></div>
            </div>
            <div className="feat-row">
              <div className="feat-num">03</div>
              <div className="feat-title">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1AA772" strokeWidth="1.6"><path d="M3 7l2-4h14l2 4M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7M3 7h18M9 11a3 3 0 0 0 6 0"/></svg>
                </div>
                <h3 style={{ marginTop: '14px' }}>Shopify Sync &amp; COD escrow</h3>
                <span>Real-time settlement tracking</span>
              </div>
              <div className="feat-desc"><p>Every order starts as pending and is never counted as revenue until Bosta confirms delivery. Watch your true net margin update per drop, not per guess.</p></div>
            </div>
          </div>
        </div>
      </section>

      <div className="perf"></div>

      <section className="section" id="problem">
        <div className="wrap">
          <div className="section-head">
            <div className="section-tag">THE PROBLEM</div>
            <h2>1,000,000 EGP in sales isn't 1,000,000 EGP in profit.</h2>
            <p>Founders track revenue because it's the easiest number to see. It's also the one that lies to you the longest.</p>
          </div>
          <ProblemSection />
        </div>
      </section>

      <div className="perf"></div>

      <section className="section" id="calc">
        <div className="wrap">
          <div className="section-head">
            <div className="section-tag">See it yourself</div>
            <h2>What&apos;s your ghost revenue?</h2>
            <p>Move the sliders to your brand&apos;s numbers and see the gap Shopify isn&apos;t showing you.</p>
          </div>
          <Calculator />
        </div>
      </section>

      <section className="cta-section">
        <div className="wrap">
          <div className="barcode"></div>
          <h2 className="display">Stop tracking in your head.</h2>
          <p>Connect Shopify and Bosta once. Know your real number every day after.</p>
          <Link href="/login?mode=signup" className="btn btn-primary">Create free workspace</Link>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <div className="logo">
                <Image src="/MARGIN.png" alt="Margin" width={96} height={48} style={{ objectFit: 'contain' }} />
              </div>
              <p>Solving internal chaos for Egyptian e-commerce brands.</p>
            </div>
            <div className="foot-col">
              <h4>Company</h4>
              <Link href="/about">About us</Link>
              <Link href="/contact">Contact us</Link>
            </div>
            <div className="foot-col">
              <h4>Legal</h4>
              <Link href="/terms">Terms &amp; conditions</Link>
              <Link href="/privacy">Privacy policy</Link>
            </div>
            <div className="foot-col">
              <h4>Support</h4>
              <Link href="/refund-policy">Refund policy</Link>
              <Link href="/shipping-policy">Shipping policy</Link>
            </div>
          </div>
          <div className="foot-bottom mono">© 2026 Margin. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
