import { useState, useCallback } from 'react'
import Header from './components/Header'
import AgentDashboard from './components/AgentDashboard'
import SignalFeed from './components/SignalFeed'
import MessageFeed from './components/MessageFeed'
import WatchlistGrid from './components/WatchlistGrid'
import { useSSE } from './hooks/useSSE'
import { TerminalState, Signal, GlassBoxMessage, DashboardState, TodayStats } from './types'

function emptyState(): TerminalState {
  return {
    active_signal: null,
    today: { total_sigs: 0, blocked: 0, tp1_hits: 0, tp2_hits: 0, tp3_hits: 0, sl_hits: 0,
             win_rate: 0, profit_factor: 0, net_pts: 0, london_cnt: 0, ny_cnt: 0, asia_cnt: 0 },
    recent_signals: [],
    recent_messages: [],
    dashboard: {
      symbol: 'XAUUSD', timeframe: '1', price: 0, session: '',
      pdh_pdl_status: '', total_score: 0,
      master_bias: '⚪ NEUTRAL — STAND ASIDE',
      ai_advice: 'Awaiting first signal...',
      ph_top: 0, pl_btm: 0, liq_bias: '⚪ Neutral',
      layers_icons: { D: '⚪', H4: '⚪', H1: '⚪', M15: '⚪', M5: '⚪' },
      layers: {
        D:   { regime: 'Neut', vwap: 'Neut', fib: 'Neut', rsi: 'Neut' },
        H4:  { regime: 'Neut', vwap: 'Neut', fib: 'Neut', rsi: 'Neut' },
        H1:  { regime: 'Neut', vwap: 'Neut', fib: 'Neut', rsi: 'Neut' },
        M15: { regime: 'Neut', vwap: 'Neut', fib: 'Neut', rsi: 'Neut' },
        M5:  { regime: 'Neut', vwap: 'Neut', fib: 'Neut', rsi: 'Neut' }
      },
      trade: { active: false, phase: 'WAITING', trade_id: 'NONE',
               direction: 0, entry: 0, sl: 0, tp1: 0, tp2: 0, tp3: 0,
               tp1_hit: false, tp2_hit: false, tp3_hit: false, trade_phase_display: '⚪ SCANNING...' },
      today: { total_sigs: 0, blocked: 0, tp1_hits: 0, tp2_hits: 0, tp3_hits: 0, sl_hits: 0,
               win_rate: 0, profit_factor: 0, net_pts: 0, london_cnt: 0, ny_cnt: 0, asia_cnt: 0 }
    }
  }
}

export default function App() {
  const [state, setState] = useState<TerminalState>(emptyState)
  const [connected, setConnected] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('XAUUSD')
  const [chartSymbol, setChartSymbol] = useState('OANDA:XAUUSD')
  const [showSettings, setShowSettings] = useState(false)

  const handleSelectSymbol = useCallback((sym: string) => {
    setSelectedSymbol(sym)
    // Map to TradingView format
    const tvMap: Record<string, string> = {
      XAUUSD: 'OANDA:XAUUSD', GBPUSD: 'OANDA:GBPUSD',
      EURAUD: 'OANDA:EURAUD', NZDUSD: 'OANDA:NZDUSD',
      BTCUSD: 'BINANCE:BTCUSDT', SOLUSD: 'BINANCE:SOLUSDT',
      XRPUSD: 'BINANCE:XRPUSDT', NEARUSD: 'BINANCE:NEARUSDT',
      ALGOUSD: 'BINANCE:ALGOUSDT',
    }
    setChartSymbol(tvMap[sym] || `OANDA:${sym}`)
  }, [])

  useSSE('/terminal/stream', {
    init: (data: unknown) => {
      const d = data as TerminalState
      setState(d)
      setConnected(true)
    },
    signal_new: (data: unknown) => {
      const sig = data as Signal
      setState(prev => ({
        ...prev,
        active_signal: ['buy', 'sell'].includes(sig.action) ? sig : prev.active_signal,
        recent_signals: [sig, ...prev.recent_signals].slice(0, 20)
      }))
    },
    signal_update: (data: unknown) => {
      const { trade_id, outcome_type, today } = data as { trade_id: string; outcome_type: string; today: TodayStats }
      setState(prev => ({
        ...prev,
        today: today || prev.today,
        recent_signals: prev.recent_signals.map(s =>
          s.trade_id === trade_id ? { ...s, status: outcome_type } : s
        )
      }))
    },
    glass_box: (data: unknown) => {
      const msg = data as GlassBoxMessage
      setState(prev => ({
        ...prev,
        recent_messages: [msg, ...prev.recent_messages].slice(0, 50)
      }))
    },
    message_analysis: (data: unknown) => {
      const { id, analysis } = data as { id: number; analysis: unknown }
      setState(prev => ({
        ...prev,
        recent_messages: prev.recent_messages.map(m =>
          m.id === id ? { ...m, claude_analysis: analysis as GlassBoxMessage['claude_analysis'] } : m
        )
      }))
    },
  }, useCallback(() => setConnected(false), []))

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0a0a14', color: '#e8e8f0', fontFamily: 'Inter, sans-serif' }}>
      <Header dashboard={state.dashboard} connected={connected} onSettings={() => setShowSettings(s => !s)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Agent Dashboard */}
        <div className="shrink-0 overflow-hidden" style={{ width: 300, borderRight: '1px solid #1e1e3a', background: '#0f0f20' }}>
          <AgentDashboard dashboard={state.dashboard} today={state.today} />
        </div>

        {/* Center panel — Chart + Watchlist */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* TradingView Chart */}
          <div className="shrink-0" style={{ height: '55%', borderBottom: '1px solid #1e1e3a' }}>
            <iframe
              key={chartSymbol}
              src={`https://www.tradingview.com/widgetembed/?frameElementId=tv_chart_1&symbol=${chartSymbol}&interval=1&theme=dark&style=1&locale=en&toolbar_bg=0a0a14&enable_publishing=0&hide_side_toolbar=0&allow_symbol_change=1&save_image=0&hideideas=1`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="ADSA Chart"
            />
          </div>

          {/* Watchlist + Research */}
          <div className="flex-1 overflow-hidden" style={{ background: '#0f0f20' }}>
            <WatchlistGrid
              dashboard={state.dashboard}
              onSelectSymbol={handleSelectSymbol}
              selectedSymbol={selectedSymbol}
            />
          </div>
        </div>

        {/* Right panel — Signals + Messages */}
        <div className="shrink-0 flex flex-col overflow-hidden" style={{ width: 340, borderLeft: '1px solid #1e1e3a', background: '#0f0f20' }}>
          {/* Signal feed */}
          <div className="overflow-hidden" style={{ height: '42%', borderBottom: '1px solid #1e1e3a' }}>
            <SignalFeed signals={state.recent_signals} />
          </div>

          {/* Message feed */}
          <div className="flex-1 overflow-hidden">
            <MessageFeed messages={state.recent_messages} />
          </div>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end"
             onClick={() => setShowSettings(false)}>
          <div className="h-full w-80 overflow-y-auto p-4"
               style={{ background: '#0f0f20', borderLeft: '1px solid #1e1e3a' }}
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-sans font-bold text-sm" style={{ color: '#FFD700' }}>⚙ SETTINGS</span>
              <button onClick={() => setShowSettings(false)}
                      style={{ color: '#6b6b8a', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="font-sans text-xs font-semibold mb-2" style={{ color: '#6b6b8a', letterSpacing: '0.1em' }}>
                  🔗 WEBHOOK ENDPOINTS
                </div>
                <div className="font-mono text-xs space-y-1" style={{ color: '#e8e8f0' }}>
                  <div><span style={{ color: '#6b6b8a' }}>Signal:  </span>POST /webhook/signal</div>
                  <div><span style={{ color: '#6b6b8a' }}>Message: </span>POST /webhook/message</div>
                  <div><span style={{ color: '#6b6b8a' }}>Outcome: </span>POST /webhook/outcome</div>
                  <div><span style={{ color: '#6b6b8a' }}>Stream:  </span>GET /terminal/stream</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 12 }}>
                <div className="font-sans text-xs font-semibold mb-2" style={{ color: '#6b6b8a', letterSpacing: '0.1em' }}>
                  📡 SIGNAL FORMAT (EA Volume)
                </div>
                <pre className="font-mono text-xs p-2 rounded" style={{ background: '#13132a', color: '#00c9a7', fontSize: 9, overflowX: 'auto' }}>
{`LICENSE_ID,{{ticker}},buy,
  sl_price={{sl}},
  tp1_price={{tp1}},pct1=0.33,
  tp2_price={{tp2}},pct2=0.50,
  tp3_price={{tp3}},exent=1`}
                </pre>
                <div className="font-mono text-xs mt-1" style={{ color: '#6b6b8a' }}>vol_dollar removed — EA controls volume</div>
              </div>
              <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 12 }}>
                <div className="font-sans text-xs font-semibold mb-2" style={{ color: '#6b6b8a', letterSpacing: '0.1em' }}>
                  💰 REAL PIP MATH
                </div>
                <div className="font-mono text-xs space-y-0.5" style={{ color: '#e8e8f0' }}>
                  <div>XAUUSD: $10/pip/lot | 0.01 lot = $0.10/pip</div>
                  <div>100 pips = <span style={{ color: '#00c9a7' }}>$10 on 0.01 lot ✅</span></div>
                  <div style={{ color: '#6b6b8a' }}>EA calculates lot size from account balance.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
