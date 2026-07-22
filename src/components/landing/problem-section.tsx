'use client'

import React, { useEffect, useRef } from 'react'

export function ProblemSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const stamps = entry.target.querySelectorAll('.p-stamp')
          stamps.forEach((stamp, index) => {
            (stamp as HTMLElement).style.animation = `stamp-in .4s cubic-bezier(.2,1.4,.4,1) forwards ${index * 0.15}s`
          })
          observer.disconnect()
        }
      })
    }, { threshold: 0.2 })

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div className="problem-grid" ref={sectionRef}>
      <div className="p-card">
        <span className="p-stamp brass" style={{ opacity: 0, transform: 'scale(1.4) rotate(-8deg)' }}>REVENUE</span>
        <h3>The number you see first</h3>
        <p>1,000,000 EGP in sales. This is what shows up the moment the drop ends. It's also what you start planning around.</p>
      </div>
      <div className="p-card">
        <span className="p-stamp rust" style={{ opacity: 0, transform: 'scale(1.4) rotate(-8deg)' }}>EXPENSES</span>
        <h3>The number that&apos;s already gone</h3>
        <p>Product cost, ad spend, returns, courier fees. Often 50 to 70% of that same revenue, spent before you&apos;ve sat down to calculate it.</p>
      </div>
      <div className="p-card">
        <span className="p-stamp ink" style={{ opacity: 0, transform: 'scale(1.4) rotate(-8deg)' }}>REAL PROFIT</span>
        <h3>The number nobody tracks in real time</h3>
        <p>What&apos;s actually left over per drop, after everything. Sometimes the &quot;successful&quot; drop was barely break-even, and you don&apos;t find out for weeks.</p>
      </div>
    </div>
  )
}
