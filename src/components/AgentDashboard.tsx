import { DashboardState, TodayStats } from '../types'
import { formatPrice, formatPips, pfTag, scoreColor } from '../utils/formatters'

interface Props {
  dashboard: DashboardState
  today: TodayStats
}

const SEP = '─────────────────────'

function Dot({ val }: { val: string }) {
  const v = val.toLowerCase()
  if (v === 'long' || v === 'bull' || v === 'bullish') return <span style={{ color: '#00c9a7' }}>●</span>
  if (v === 'short' || v === 'bear' || v === 'bearish') return <span style={{ color: '#ff4757' }}>●</span>
  return <span style={{ color: '#6b6b8a' }}>○</span>
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="font-mono text-xs px-1.5 py-0.5 rounded"
          style={{ background: scoreColor(score) + '20', color: scoreColor(score), border: `1px solid ${scoreColor(score)}40` }}>
      {score > 0 ? '+' : ''}{score}/15
    </span>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="font-sans text-xs" style={{ color: '#6b6b8a' }}>{label}</span>
      <span className="font-mono text-xs" style={{ color: valueColor || '#e8e8f0' }}>{value}</span>
    </div>
  )
}

export default function AgentDashboard({ dashboard: d, today: t }: Props) {
  const { trade } = d

  const syncPhaseColor = () => {
    const p = (d.master_bias || '').toUpperCase()
    if (p.includes('BEARISH')) return '#ff4757'
    if (p.includes('BULLISH')) return '#00c9a7'
    if (p.includes('SILENCE')) return '#6b6b8a'
    if (p.includes('WAIT') || p.includes('QUIET')) return '#f4a523'
    return '#6b6b8a'
  }

  const tradeCardBorder = () => {
    if (!trade.active) return '1px solid #1e1e3a'
    return trade.direction === 1 ? '1px solid rgba(0,201,167,0.4)' : '1px solid rgba(255,71,87,0.4)'
  }

  const layerIcon = (tf: string) => d.layers_icons?.[tf] || '⚪'

  const layerRow = (tf: string, label: string, last = false) => {
    const l = d.layers?.[tf]
    const icon = layerIcon(tf)
    const prefix = last ? '└──' : '├──'
    const detail = l ? `${l.regime} | ${l.vwap} | ${l.fib} | ${l.rsi}` : '...'
    return (
      <div key={tf} className="font-mono text-xs leading-relaxed" style={{ color: '#e8e8f0' }}>
        <span style={{ color: '#6b6b8a' }}>{prefix} </span>
        <span>{tf}</span>
        <span style={{ color: '#6b6b8a' }}> {label}</span>
        <span> {icon}</span>
        <br />
        <span style={{ color: '#6b6b8a' }}>{last ? '       ' : ' │   '}{detail}</span>
      </div>
    )
  }

  const pf = t.profit_factor || d.today?.profit_factor || 0
  const wr = t.win_rate || d.today?.win_rate || 0
  const netPts = t.net_pts || d.today?.net_pts || 0

  return (
    <div className="h-full overflow-y-auto p-3 space-y-0" style={{ fontFamily: '"JetBrains Mono", monospace' }}>

      {/* HEADER */}
      <div className="text-xs leading-relaxed mb-1">
        <div className="font-bold" style={{ color: '#FFD700' }}>🚀 ABSOLUTE DOLLAR AGENT</div>
        <div style={{ color: '#6b6b8a' }}>Absolute Dollar Intelligence</div>
        <div style={{ color: '#1e1e3a' }}>{SEP}</div>
        <div>
          <span style={{ color: '#6b6b8a' }}>🔐 </span>
          <span style={{ color: '#f4a523' }}>AUTO</span>
          <span style={{ color: '#6b6b8a' }}> | 👑 Sovereign (D): </span>
          <span style={{ color: scoreColor(d.total_score) }}>{d.total_score >= 3 ? 'BULL' : d.total_score <= -3 ? 'BEAR' : 'NEUT'}</span>
        </div>
        <div>
          <span style={{ color: '#6b6b8a' }}>📊 Score: </span>
          <ScoreBadge score={d.total_score} />
        </div>
      </div>

      {/* FRACTAL 4-LAYER */}
      <div className="text-xs leading-relaxed">
        <div style={{ color: '#1e1e3a' }}>{SEP}</div>
        <div style={{ color: '#6b6b8a' }}>⏱️ FRACTAL 4-LAYER SYNC</div>
        {[
          { label: 'L1 Sovereign (D)', key: 'D' },
          { label: 'L2 Anchor   (H4)', key: 'H4' },
          { label: 'L3 Filter   (M15)', key: 'M15' },
          { label: 'L4 Exec     (M1)', key: 'M5' },
        ].map(({ label, key }) => {
          const icon = layerIcon(key)
          const stateText = icon === '🟢' ? 'BULL' : icon === '🔴' ? 'BEAR' : 'NEUT'
          const color = icon === '🟢' ? '#00c9a7' : icon === '🔴' ? '#ff4757' : '#6b6b8a'
          return (
            <div key={key} className="flex justify-between">
              <span style={{ color: '#6b6b8a' }}>{label}:</span>
              <span style={{ color }}>{stateText} {icon}</span>
            </div>
          )
        })}
        <div className="mt-1" style={{ color: syncPhaseColor() }}>
          🔄 {d.master_bias || '⚪ NEUTRAL — STAND ASIDE'}
        </div>
      </div>

      {/* CORE SIGNALS */}
      <div className="text-xs leading-relaxed">
        <div style={{ color: '#1e1e3a' }}>{SEP}</div>
        <div style={{ color: '#6b6b8a' }}>📊 CORE SIGNALS</div>
        <div>
          <span className="font-bold" style={{ color: '#e8e8f0' }}>{d.symbol}</span>
          <span style={{ color: '#6b6b8a' }}> | {d.timeframe}</span>
          <span className="ml-2" style={{ color: '#FFD700' }}>{formatPrice(d.price)}</span>
        </div>
        <div style={{ color: '#f4a523' }}>{d.session || '—'}</div>
        <div>
          <span style={{ color: '#6b6b8a' }}>📅 Daily: </span>
          <span style={{ color: '#e8e8f0' }}>{d.pdh_pdl_status || '—'}</span>
        </div>
        <div>
          <span style={{ color: '#6b6b8a' }}>Score: </span>
          <span style={{ color: scoreColor(d.total_score) }}>{d.total_score}/15</span>
        </div>
      </div>

      {/* 5-LAYER AI NARRATIVE */}
      <div className="text-xs leading-relaxed">
        <div style={{ color: '#1e1e3a' }}>{SEP}</div>
        <div>
          <span style={{ color: '#6b6b8a' }}>🧠 5-LAYER AI NARRATIVE  </span>
          <ScoreBadge score={d.total_score} />
        </div>
        <div className="mb-1" style={{ color: syncPhaseColor() }}>{d.master_bias}</div>
        <div className="space-y-1">
          {layerRow('D',   '(Sovereign)')}
          {layerRow('H4',  '(Anchor)')}
          {layerRow('H1',  '')}
          {layerRow('M15', '')}
          {layerRow('M5',  '', true)}
        </div>
      </div>

      {/* AGENT ADVICE */}
      <div className="text-xs leading-relaxed">
        <div style={{ color: '#1e1e3a' }}>{SEP}</div>
        <div style={{ color: '#6b6b8a' }}>💡 AGENT ADVICE</div>
        <div style={{ color: '#e8e8f0' }}>{d.ai_advice || 'Awaiting signal...'}</div>
      </div>

      {/* LIQUIDITY */}
      <div className="text-xs leading-relaxed">
        <div style={{ color: '#1e1e3a' }}>{SEP}</div>
        <div style={{ color: '#6b6b8a' }}>🧊 LIQUIDITY</div>
        <div>
          <span style={{ color: '#6b6b8a' }}>Buy-side:  </span>
          <span style={{ color: '#00c9a7' }}>{formatPrice(d.ph_top)}</span>
        </div>
        <div>
          <span style={{ color: '#6b6b8a' }}>Sell-side: </span>
          <span style={{ color: '#ff4757' }}>{formatPrice(d.pl_btm)}</span>
        </div>
        <div style={{ color: '#f4a523' }}>{d.liq_bias}</div>
      </div>

      {/* TRADE SETUP */}
      <div className="text-xs leading-relaxed">
        <div style={{ color: '#1e1e3a' }}>{SEP}</div>
        <div style={{ color: '#6b6b8a' }}>💰 TRADE SETUP</div>
        {!trade.active ? (
          <div style={{ color: '#6b6b8a' }}>⚪ Scanning for setup...</div>
        ) : (
          <div className="p-2 mt-1 rounded" style={{ border: tradeCardBorder(), background: trade.direction === 1 ? 'rgba(0,201,167,0.04)' : 'rgba(255,71,87,0.04)' }}>
            <div style={{ color: '#f4a523' }}>📊 Phase: {trade.trade_phase_display}</div>
            <div style={{ color: '#6b6b8a' }}>ID: {trade.trade_id}</div>
            <div>
              <span style={{ color: '#6b6b8a' }}>Dir: </span>
              <span style={{ color: trade.direction === 1 ? '#00c9a7' : '#ff4757' }}>
                {trade.direction === 1 ? '🟢 LONG' : '🔴 SHORT'}
              </span>
            </div>
            <Row label="Entry" value={formatPrice(trade.entry)} valueColor="#e8e8f0" />
            <Row label="SL" value={formatPrice(trade.sl)} valueColor="#ff4757" />
            <Row label={`TP1 ${trade.tp1_hit ? '✅' : ''}`} value={formatPrice(trade.tp1)} valueColor="#00c9a7" />
            <Row label={`TP2 ${trade.tp2_hit ? '✅' : ''}`} value={formatPrice(trade.tp2)} valueColor="#00c9a7" />
            <Row label={`TP3 ${trade.tp3_hit ? '✅' : ''}`} value={formatPrice(trade.tp3)} valueColor="#FFD700" />
          </div>
        )}
      </div>

      {/* TODAY */}
      <div className="text-xs leading-relaxed">
        <div style={{ color: '#1e1e3a' }}>{SEP}</div>
        <div style={{ color: '#6b6b8a' }}>📅 TODAY</div>
        <div>
          <span style={{ color: '#6b6b8a' }}>Sigs: </span><span style={{ color: '#e8e8f0' }}>{t.total_sigs}</span>
          <span style={{ color: '#6b6b8a' }}> Blocked: </span><span style={{ color: '#f4a523' }}>{t.blocked}</span>
          <span style={{ color: '#6b6b8a' }}> LDN: </span><span style={{ color: '#e8e8f0' }}>{t.london_cnt}</span>
          <span style={{ color: '#6b6b8a' }}> NY: </span><span style={{ color: '#e8e8f0' }}>{t.ny_cnt}</span>
        </div>
        <div>
          <span style={{ color: '#6b6b8a' }}>TP1: </span><span style={{ color: '#00c9a7' }}>{t.tp1_hits}</span>
          <span style={{ color: '#6b6b8a' }}> TP2: </span><span style={{ color: '#00c9a7' }}>{t.tp2_hits}</span>
          <span style={{ color: '#6b6b8a' }}> TP3: </span><span style={{ color: '#FFD700' }}>{t.tp3_hits}</span>
          <span style={{ color: '#6b6b8a' }}> SL: </span><span style={{ color: '#ff4757' }}>{t.sl_hits}</span>
        </div>
        <div>
          <span style={{ color: '#6b6b8a' }}>WR: </span><span style={{ color: wr >= 50 ? '#00c9a7' : '#f4a523' }}>{wr}%</span>
          <span style={{ color: '#6b6b8a' }}> PF: </span><span style={{ color: pf >= 2 ? '#FFD700' : pf >= 1 ? '#00c9a7' : '#ff4757' }}>{pf}</span>
          <span style={{ color: '#6b6b8a' }}> Net: </span>
          <span style={{ color: netPts >= 0 ? '#00c9a7' : '#ff4757' }}>{netPts >= 0 ? '+' : ''}{netPts} pts</span>
        </div>
        <div style={{ color: '#6b6b8a' }}>
          PF Rating: <span style={{ color: pf >= 2 ? '#FFD700' : '#e8e8f0' }}>{pfTag(pf)}</span>
        </div>
      </div>

      {/* FOOTER */}
      <div className="text-xs pt-2" style={{ color: '#1e1e3a', borderTop: '1px solid #1e1e3a' }}>
        <div style={{ color: '#6b6b8a' }}>ABSOLUTE DOLLAR INTELLIGENCE</div>
        <div style={{ color: '#6b6b8a' }}>SUPREME AGENT — ADSA v8.0 | © 2026</div>
        <div style={{ color: '#6b6b8a' }}>⚠️ Not financial advice.</div>
      </div>
    </div>
  )
}
