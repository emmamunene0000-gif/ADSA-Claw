import { Signal } from '../types'
import { formatPrice, formatPips, scoreColor, formatTime } from '../utils/formatters'

interface Props {
  signals: Signal[]
}

export default function SignalFeed({ signals }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0"
           style={{ borderBottom: '1px solid #1e1e3a' }}>
        <span className="font-sans text-xs font-semibold" style={{ color: '#e8e8f0', letterSpacing: '0.05em' }}>
          📡 LIVE SIGNALS
        </span>
        {signals.length > 0 && (
          <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,71,87,0.15)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.3)' }}>
            {signals.length}
          </span>
        )}
      </div>

      {/* Signal cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {signals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: '#6b6b8a' }}>
            <div className="font-mono text-xs">No signals yet</div>
            <div className="font-mono text-xs mt-1" style={{ color: '#1e1e3a' }}>POST /webhook/signal</div>
            <div className="font-mono text-xs mt-0.5" style={{ color: '#1e1e3a' }}>or GET /test-signal</div>
          </div>
        )}

        {signals.map((sig, i) => {
          const isLong = sig.direction === 'LONG' || sig.action === 'buy'
          const score = sig.score || 0
          const borderColor = isLong ? '#00c9a7' : '#ff4757'
          const dimBorder = isLong ? 'rgba(0,201,167,0.3)' : 'rgba(255,71,87,0.3)'
          const isCounter = sig.signal_type === 'COUNTER' || sig.master_bias?.includes('COUNTER')
          const activeBorder = isCounter ? '#FFD700' : (Math.abs(score) >= 6 ? borderColor : dimBorder)

          const isClosed = ['SL', 'HOLDER_EXIT', 'TP3', 'closebuy', 'closesell'].includes(sig.status || '')

          // pip distances
          const slPips  = sig.entry && sig.sl  ? formatPips(sig.entry, sig.sl,  sig.symbol) : '—'
          const tp1Pips = sig.entry && sig.tp1 ? formatPips(sig.entry, sig.tp1, sig.symbol) : '—'

          return (
            <div key={sig.trade_id || i}
                 className="rounded p-2"
                 style={{
                   border: `1px solid ${activeBorder}`,
                   borderLeft: `3px solid ${activeBorder}`,
                   background: isLong ? 'rgba(0,201,167,0.04)' : 'rgba(255,71,87,0.04)',
                   opacity: isClosed ? 0.55 : 1,
                   animation: i === 0 ? 'slide-in 200ms ease-out' : undefined
                 }}>

              {/* Row 1: direction + symbol + time */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold"
                        style={{ color: isLong ? '#00c9a7' : '#ff4757' }}>
                    {isLong ? '🟢 LONG' : '🔴 SHORT'}
                  </span>
                  <span className="font-mono text-xs font-bold" style={{ color: '#e8e8f0' }}>
                    {sig.symbol}
                  </span>
                  {sig.signal_type && (
                    <span className="font-mono text-xs px-1 rounded"
                          style={{ background: 'rgba(255,215,0,0.1)', color: '#FFD700', fontSize: 9 }}>
                      {sig.signal_type}
                    </span>
                  )}
                  {sig.status && sig.status !== 'ACTIVE' && (
                    <span className="font-mono text-xs px-1 rounded"
                          style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700' }}>
                      {sig.status}
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs" style={{ color: '#6b6b8a' }}>
                  {formatTime(sig.received_at)} EAT
                </span>
              </div>

              {/* Row 2: Trade ID */}
              <div className="font-mono text-xs mb-1" style={{ color: '#6b6b8a', fontSize: 10 }}>
                {sig.trade_id || '—'}
              </div>

              {/* Row 3: Entry / SL */}
              <div className="flex gap-3 font-mono text-xs mb-0.5">
                <span>
                  <span style={{ color: '#6b6b8a' }}>Entry </span>
                  <span style={{ color: '#e8e8f0' }}>{sig.entry ? formatPrice(sig.entry) : '—'}</span>
                </span>
                <span>
                  <span style={{ color: '#6b6b8a' }}>SL </span>
                  <span style={{ color: '#ff4757' }}>{sig.sl ? formatPrice(sig.sl) : '—'}</span>
                  <span style={{ color: '#6b6b8a' }}> ({slPips})</span>
                </span>
              </div>

              {/* Row 4: TPs */}
              <div className="flex gap-2 font-mono text-xs mb-1" style={{ fontSize: 10 }}>
                <span><span style={{ color: '#6b6b8a' }}>TP1 </span><span style={{ color: '#00c9a7' }}>{sig.tp1 ? formatPrice(sig.tp1) : '—'}</span></span>
                <span><span style={{ color: '#6b6b8a' }}>TP2 </span><span style={{ color: '#00c9a7' }}>{sig.tp2 ? formatPrice(sig.tp2) : '—'}</span></span>
                <span><span style={{ color: '#6b6b8a' }}>TP3 </span><span style={{ color: '#FFD700' }}>{sig.tp3 ? formatPrice(sig.tp3) : '—'}</span></span>
              </div>

              {/* Row 5: Conf + risk math */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {sig.conf !== undefined && (
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(44,123,229,0.15)', color: '#5B9BFF', border: '1px solid rgba(44,123,229,0.3)', fontSize: 9 }}>
                      conf:{sig.conf}%
                    </span>
                  )}
                  {sig.dollarrisk && (
                    <span className="font-mono text-xs" style={{ color: '#00c9a7', fontSize: 9 }}>
                      ${sig.dollarrisk} risk
                    </span>
                  )}
                </div>
                {sig.risk_math && (
                  <div className="font-mono text-xs" style={{ color: '#6b6b8a', fontSize: 10 }}>
                    {sig.risk_math.sl_pips} pips · {sig.risk_math.nearest_lots} lots
                    <span style={{ color: sig.risk_math.actual_risk <= (sig.dollarrisk || 15) ? '#00c9a7' : '#f4a523' }}>
                      {' '}~${sig.risk_math.actual_risk}
                    </span>
                  </div>
                )}
              </div>

              {/* Row 6: BE/Trail params */}
              {(sig.betrig || sig.trdist) && (
                <div className="font-mono text-xs mt-0.5" style={{ color: '#6b6b8a', fontSize: 9 }}>
                  {sig.betrig && <span>BE@{sig.betrig}p</span>}
                  {sig.trdist && <span> · Trail:{sig.trdist}/{sig.trstep}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
