import { useState } from 'react'
import { DashboardState } from '../types'

const WATCHLIST = [
  'XAUUSD', 'VOLATILITY_10_INDEX', 'VOLATILITY_25_1S_INDEX', 'VOLATILITY_50_INDEX',
  'VOLATILITY_75_INDEX', 'VOLATILITY_100_INDEX', 'STEP_INDEX', 'STEP_INDEX_200',
  'STEP_INDEX_300', 'STEP_INDEX_400', 'STEP_INDEX_500', 'NETHERLANDS_25',
  'WALL_STREET_30', 'US_TECH_100', 'US_SMALL_CAP_2000', 'JAPAN_225',
  'GBPUSD', 'EURAUD', 'NZDUSD', 'SOLUSD', 'XRPUSD', 'NEARUSD', 'ALGOUSD', 'BTCUSD'
]

interface Props {
  dashboard: DashboardState
  onSelectSymbol: (symbol: string) => void
  selectedSymbol: string
}

interface ResearchResult {
  enhanced_commentary?: string
  risk_verdict?: string
  risk_reason?: string
  key_level?: string
  session_context?: string
  max_tp?: string
  confidence?: number
  error?: string
}

const VERDICT_COLOR: Record<string, string> = {
  EXECUTE: '#00c9a7',
  CAUTION: '#f4a523',
  STAND_ASIDE: '#6b6b8a',
  COUNTER_TREND_ONLY: '#FFD700',
}

export default function WatchlistGrid({ dashboard, onSelectSymbol, selectedSymbol }: Props) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [researchSymbol, setResearchSymbol] = useState('')

  const runResearch = async (sym: string, q?: string) => {
    setLoading(true)
    setResearchSymbol(sym)
    setResult(null)
    try {
      const r = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, question: q || question || `Full 4-layer alignment and trade bias for ${sym}` })
      })
      const data = await r.json()
      setResult(data)
    } catch (e) {
      setResult({ error: 'Research failed. Check Claude API key.' })
    }
    setLoading(false)
  }

  const PRESET_QUESTIONS = (sym: string) => [
    `What is the current 4-layer alignment for ${sym}?`,
    `Is ${sym} in Premium or Discount zone?`,
    `What is the liquidity bias for ${sym}?`,
    `Should I be LONG, SHORT, or STAND ASIDE on ${sym}?`,
  ]

  return (
    <div className="flex h-full">
      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="font-sans text-xs font-semibold" style={{ color: '#e8e8f0', letterSpacing: '0.05em' }}>
            🔍 WATCHLIST RESEARCH — ADSA INTELLIGENCE
          </span>
          <span className="font-mono text-xs" style={{ color: '#6b6b8a' }}>
            {WATCHLIST.length} assets
          </span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {WATCHLIST.map(sym => {
            const isActive = dashboard.symbol === sym
            const isSelected = selectedSymbol === sym
            const isResearched = researchSymbol === sym && result

            return (
              <div key={sym}
                   onClick={() => { onSelectSymbol(sym); setResearchSymbol(sym) }}
                   className="p-2 rounded cursor-pointer"
                   style={{
                     background: '#13132a',
                     border: isActive ? '1px solid #FFD700' : isSelected ? '1px solid #00c9a7' : '1px solid #1e1e3a',
                     animation: isActive ? 'pulse-teal 2s infinite' : undefined,
                     transition: 'border-color 0.15s'
                   }}>
                <div className="font-mono text-xs font-bold leading-tight"
                     style={{ color: isActive ? '#FFD700' : '#e8e8f0', fontSize: 10 }}>
                  {sym.replace('_INDEX', '').replace('VOLATILITY_', 'V.')}
                </div>
                <div className="font-mono text-xs" style={{ color: '#6b6b8a', fontSize: 9 }}>
                  {sym === dashboard.symbol ? `${dashboard.price > 0 ? dashboard.price.toFixed(2) : '—'}` : '—'}
                </div>
                {isResearched && result?.risk_verdict && (
                  <div className="font-mono mt-0.5" style={{ color: VERDICT_COLOR[result.risk_verdict] || '#6b6b8a', fontSize: 9 }}>
                    {result.risk_verdict}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Research drawer */}
      {selectedSymbol && (
        <div className="w-72 shrink-0 flex flex-col" style={{ borderLeft: '1px solid #1e1e3a' }}>
          <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid #1e1e3a' }}>
            <div className="font-mono text-xs font-bold" style={{ color: '#FFD700' }}>
              🧠 AGENT RESEARCH — {selectedSymbol}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Preset questions */}
            <div className="space-y-1">
              {PRESET_QUESTIONS(selectedSymbol).map(q => (
                <button key={q}
                        onClick={() => { setQuestion(q); runResearch(selectedSymbol, q) }}
                        className="w-full text-left font-mono text-xs px-2 py-1.5 rounded"
                        style={{ background: '#13132a', border: '1px solid #1e1e3a', color: '#6b6b8a', cursor: 'pointer' }}>
                  {q}
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="flex gap-1">
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runResearch(selectedSymbol)}
                placeholder="Ask the agent..."
                className="flex-1 font-mono text-xs px-2 py-1.5 rounded"
                style={{ background: '#13132a', border: '1px solid #1e1e3a', color: '#e8e8f0', outline: 'none' }}
              />
              <button onClick={() => runResearch(selectedSymbol)}
                      disabled={loading}
                      className="font-mono text-xs px-3 py-1.5 rounded"
                      style={{ background: '#1e1e3a', color: loading ? '#6b6b8a' : '#00c9a7', cursor: 'pointer', border: '1px solid #1e1e3a' }}>
                {loading ? '...' : 'ASK'}
              </button>
            </div>

            {/* Result */}
            {result && (
              <div className="rounded p-2 space-y-2"
                   style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <div className="font-mono text-xs" style={{ color: '#1e1e3a' }}>━━━━━━━━━━━━━━━━━━━━━</div>
                <div className="font-sans text-xs font-bold" style={{ color: '#FFD700' }}>
                  🧠 AGENT RESEARCH — {researchSymbol}
                </div>
                <div className="font-mono text-xs" style={{ color: '#1e1e3a' }}>━━━━━━━━━━━━━━━━━━━━━</div>

                {result.error ? (
                  <div className="font-mono text-xs" style={{ color: '#ff4757' }}>{result.error}</div>
                ) : (
                  <>
                    <div className="font-mono text-xs leading-relaxed" style={{ color: '#e8e8f0' }}>
                      {result.enhanced_commentary}
                    </div>
                    <div className="font-mono text-xs" style={{ color: '#1e1e3a' }}>─────────────────────</div>
                    <div className="space-y-0.5">
                      <div className="font-mono text-xs">
                        <span style={{ color: '#6b6b8a' }}>Risk Verdict: </span>
                        <span style={{ color: VERDICT_COLOR[result.risk_verdict || ''] || '#e8e8f0' }}>
                          {result.risk_verdict}
                        </span>
                      </div>
                      <div className="font-mono text-xs" style={{ color: '#6b6b8a' }}>
                        {result.risk_reason}
                      </div>
                      <div className="font-mono text-xs">
                        <span style={{ color: '#6b6b8a' }}>Key Level: </span>
                        <span style={{ color: '#FFD700' }}>{result.key_level}</span>
                      </div>
                      <div className="font-mono text-xs">
                        <span style={{ color: '#6b6b8a' }}>Session: </span>
                        <span style={{ color: '#e8e8f0' }}>{result.session_context}</span>
                      </div>
                      <div className="font-mono text-xs">
                        <span style={{ color: '#6b6b8a' }}>Max TP: </span>
                        <span style={{ color: '#00c9a7' }}>{result.max_tp}</span>
                        <span style={{ color: '#6b6b8a' }}> | Confidence: </span>
                        <span style={{ color: '#e8e8f0' }}>{result.confidence}%</span>
                      </div>
                    </div>
                    <div className="font-mono text-xs" style={{ color: '#1e1e3a' }}>━━━━━━━━━━━━━━━━━━━━━</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
