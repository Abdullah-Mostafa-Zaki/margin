'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { ShoppingCart, Wallet, Truck } from 'lucide-react'

const sources = [
  {
    icon: ShoppingCart,
    label: 'Shopify',
    caption: 'Storefront',
  },
  {
    icon: Wallet,
    label: 'Instapay',
    caption: 'Payments',
  },
  {
    icon: Truck,
    label: 'Bosta',
    caption: 'Delivery',
  },
]

export function ProductDiagram() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return

          // Stagger chips in
          el.querySelectorAll<HTMLElement>('.pd-chip').forEach((chip, i) => {
            chip.style.animation = `pd-slide-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.12}s forwards`
          })

          // Connector after chips
          const conn = el.querySelector<HTMLElement>('.pd-connector')
          if (conn) conn.style.animation = `pd-fade-in 0.35s ease ${3 * 0.12 + 0.1}s forwards`

          // Destination card last
          const dest = el.querySelector<HTMLElement>('.pd-dest')
          if (dest) dest.style.animation = `pd-scale-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${3 * 0.12 + 0.3}s forwards`

          observer.disconnect()
        })
      },
      { threshold: 0.25 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <style>{`
        @keyframes pd-slide-in {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pd-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pd-scale-in {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }

        .pd-chip, .pd-connector, .pd-dest { opacity: 0; }

        .pd-chip {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          background: #FFFFFF; border: 1px solid rgba(26,167,114,0.15);
          border-radius: 14px; padding: 18px 22px; min-width: 100px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          text-align: center;
        }
        .pd-chip-icon {
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(26,167,114,0.10);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pd-chip-label { font-size: 13.5px; font-weight: 700; color: #1a1a1a; line-height: 1; }
        .pd-chip-caption { font-size: 11px; font-weight: 500; color: #6b7280; letter-spacing: 0.04em; line-height: 1; }

        /* Connector: three dotted lines converging into an arrow */
        .pd-connector {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 0; padding: 0 8px; position: relative; align-self: stretch;
        }
        .pd-conn-line {
          flex: 1; width: 2px; border-left: 2px dashed rgba(0,0,0,0.10);
          position: relative;
        }
        .pd-conn-track {
          display: flex; align-items: center; gap: 0;
          width: 48px;
        }
        .pd-conn-dots {
          display: flex; flex-direction: column; gap: 4px; align-items: center;
          width: 36px;
        }
        .pd-conn-dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: rgba(0,0,0,0.12);
        }
        .pd-conn-arrow {
          width: 0; height: 0;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-left: 8px solid #1AA772;
          flex-shrink: 0;
        }

        /* Destination card */
        .pd-dest {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          background: #FFFFFF;
          border: 2px solid #1AA772;
          border-radius: 16px; padding: 28px 36px;
          box-shadow: 0 4px 24px rgba(26,167,114,0.18), 0 1px 4px rgba(0,0,0,0.06);
        }
        .pd-dest-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: #1AA772;
        }

        /* Outer container */
        .pd-wrap {
          display: flex; align-items: center; justify-content: center;
          gap: 20px; flex-wrap: wrap;
          padding: 48px 40px;
          background: #F8FDFB;
          border: 1px solid rgba(26,167,114,0.12);
          border-radius: 20px;
          margin-bottom: 64px;
        }
        .pd-sources {
          display: flex; flex-direction: column; gap: 14px;
        }

        @media (max-width: 640px) {
          .pd-wrap { padding: 32px 20px; gap: 14px; }
          .pd-connector { display: none; }
          .pd-sources { flex-direction: row; flex-wrap: wrap; justify-content: center; }
          .pd-chip { min-width: 84px; padding: 14px 14px; }
        }
      `}</style>

      <div className="pd-wrap" ref={ref}>
        {/* Input chips */}
        <div className="pd-sources">
          {sources.map(({ icon: Icon, label, caption }) => (
            <div className="pd-chip" key={label}>
              <div className="pd-chip-icon">
                <Icon size={22} color="#1AA772" strokeWidth={1.8} />
              </div>
              <span className="pd-chip-label">{label}</span>
              <span className="pd-chip-caption">{caption}</span>
            </div>
          ))}
        </div>

        {/* Connector: dotted rows converging to arrow */}
        <div className="pd-connector">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div className="pd-conn-dots">
              {Array.from({ length: 7 }).map((_, i) => (
                <div className="pd-conn-dot" key={i} />
              ))}
            </div>
            <div className="pd-conn-arrow" />
          </div>
        </div>

        {/* Destination */}
        <div className="pd-dest">
          <span className="pd-dest-label">One source of truth</span>
          <Image src="/MARGIN.png" alt="Margin" width={120} height={60} style={{ objectFit: 'contain' }} />
        </div>
      </div>
    </>
  )
}
