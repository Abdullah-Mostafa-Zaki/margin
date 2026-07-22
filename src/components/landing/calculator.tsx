'use client'

import React, { useState } from 'react'

export function Calculator() {
  const [rev, setRev] = useState(150000)
  const [ret, setRet] = useState(28)

  const fmt = (n: number) => Math.round(n).toLocaleString('en-US') + ' EGP'

  const ghost = rev * (ret / 100)

  return (
    <div className="calc">
      <div className="calc-inputs">
        <label>Monthly Shopify revenue: <span className="val mono">{fmt(rev)}</span></label>
        <input 
          type="range" 
          min="20000" max="500000" step="5000" 
          value={rev} 
          onChange={e => setRev(parseInt(e.target.value, 10))} 
        />
        <label>COD return rate: <span className="val mono">{ret}%</span></label>
        <input 
          type="range" 
          min="5" max="55" step="1" 
          value={ret} 
          onChange={e => setRet(parseInt(e.target.value, 10))} 
        />
      </div>
      <div className="calc-result">
        <div className="label">Estimated ghost revenue / month</div>
        <div className="amount mono">{fmt(ghost)}</div>
        <div className="sub">Revenue Shopify reports that never becomes cash in hand.</div>
      </div>
    </div>
  )
}
