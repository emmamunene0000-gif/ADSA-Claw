export interface LayerState {
  regime: string
  vwap: string
  fib: string
  rsi: string
}

export interface TradeState {
  active: boolean
  phase: string
  trade_id: string
  direction: number  // 1=LONG, -1=SHORT
  entry: number
  sl: number
  tp1: number; tp2: number; tp3: number
  tp1_hit: boolean; tp2_hit: boolean; tp3_hit: boolean
  trade_phase_display: string
}

export interface DashboardState {
  symbol: string
  timeframe: string
  price: number
  session: string
  pdh_pdl_status: string
  total_score: number
  master_bias: string
  ai_advice: string
  ph_top: number
  pl_btm: number
  liq_bias: string
  layers_icons: Record<string, string>
  layers: Record<string, LayerState>
  trade: TradeState
  today: TodayStats
}

export interface TodayStats {
  total_sigs: number; blocked: number
  tp1_hits: number; tp2_hits: number; tp3_hits: number; sl_hits: number
  win_rate: number; profit_factor: number; net_pts: number
  london_cnt: number; ny_cnt: number; asia_cnt: number
}

// Super-payload signal fields (TradeSgnl EA format, ADSA v8.1+)
export interface Signal {
  trade_id: string
  symbol: string
  action: string        // buy | sell | closebuy | closesell
  direction: string     // LONG | SHORT
  license?: string
  // Prices (super payload field names)
  entry?: number
  sl?: number
  tp1?: number; tp2?: number; tp3?: number
  pct1?: number; pct2?: number
  // Dollar risk (EA calculates lots from this)
  dollarrisk?: number
  // BE / trail params
  betrig?: number       // pips to move to BE
  bedist?: number       // BE buffer pips
  trtrig?: number       // trail trigger multiplier
  trdist?: number       // trail distance pips
  trstep?: number       // trail step pips
  // Classification
  signal_type?: string  // SYNC4 | COUNTER | LOCAL
  conf?: number         // confidence %
  // Metadata
  score?: number
  master_bias?: string
  session?: string
  status?: string
  received_at: string
  risk_math?: RiskMath
  claude_analysis?: ClaudeAnalysis
}

export interface RiskMath {
  sl_pips: number
  risk_per_micro: number
  required_lots: number
  nearest_lots: number
  actual_risk: number
}

export interface GlassBoxMessage {
  id: number
  content: string
  event_type: string
  parsed: ParsedMessage
  timestamp: string
  claude_analysis?: ClaudeAnalysis
}

export interface ParsedMessage {
  symbol?: string
  price?: number
  session?: string
  score?: number
  master_bias?: string
  direction?: string
  entry?: number
  sl?: number
  tp1?: number; tp2?: number; tp3?: number
  trade_id?: string
  ai_advice?: string
  layers?: Record<string, string>
  buy_side_liq?: number
  sell_side_liq?: number
}

export interface ClaudeAnalysis {
  verdict: string
  edge_note: string
  max_tp: string
  confidence: number
}

export interface TerminalState {
  active_signal: Signal | null
  today: TodayStats
  recent_signals: Signal[]
  recent_messages: GlassBoxMessage[]
  dashboard: DashboardState
}
