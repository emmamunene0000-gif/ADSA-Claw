import { useState, useEffect } from 'react'
import { formatPrice } from '../utils/formatters'
import { DashboardState } from '../types'

interface Props {
  dashboard: DashboardState
  connected: boolean
  onSettings: () => void
}

export default function Header({ dashboard, connected, onSettings }: Props) {
  const [eat, setEat] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const utc = now.getTime() + now.getTimezoneOffset() * 60000
      const eatTime = new Date(utc + 3 * 3600000)
      setEat(eatTime.toTimeString().slice(0, 8))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const scoreColor = () => {
    const s = dashboard.total_score
    if (s >= 6)  return '#FFD700'
    if (s >= 3)  return '#00c9a7'
    if (s >= 0)  return '#f4a523'
    if (s >= -3) return '#6b6b8a'
    return '#ff4757'
  }

  return (
    <div style={{ background: '#0f0f20', borderBottom: '1px solid #1e1e3a', height: 40 }}
         className="flex items-center justify-between px-4 shrink-0">

      {/* Left */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs font-bold" style={{ color: '#FFD700', letterSpacing: '0.1em' }}>
          🚀 ABSOLUTE DOLLAR TERMINAL
        </span>
        <span className="text-xs" style={{ color: '#1e1e3a' }}>·</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-teal' : 'bg-red'}`}
                style={{ animation: connected ? 'pulse-teal 2s infinite' : 'pulse-red 2s infinite',
                         backgroundColor: connected ? '#00c9a7' : '#ff4757' }} />
          <span className="font-mono text-xs" style={{ color: connected ? '#00c9a7' : '#ff4757' }}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Center */}
      <div className="flex items-center gap-4 font-mono text-xs">
        <span className="font-bold" style={{ color: '#e8e8f0' }}>{dashboard.symbol}</span>
        <span style={{ color: scoreColor() }}>{formatPrice(dashboard.price)}</span>
        <span style={{ color: '#6b6b8a' }}>|</span>
        <span style={{ color: '#f4a523' }}>{dashboard.session || 'LOADING...'}</span>
        <span style={{ color: '#6b6b8a' }}>|</span>
        <span style={{ color: '#6b6b8a' }}>
          Score: <span style={{ color: scoreColor() }}>{dashboard.total_score}/15</span>
        </span>
        <span style={{ color: '#6b6b8a' }}>|</span>
        <span style={{ color: '#00c9a7' }}>{eat} EAT</span>
      </div>

      {/* Right */}
      <button onClick={onSettings}
              className="font-mono text-xs px-2 py-1 rounded"
              style={{ background: '#13132a', border: '1px solid #1e1e3a', color: '#6b6b8a', cursor: 'pointer' }}>
        ⚙ SETTINGS
      </button>
    </div>
  )
}
