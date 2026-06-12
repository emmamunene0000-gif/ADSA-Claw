require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const Anthropic = require('@anthropic-ai/sdk')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(express.text({ type: '*/*', limit: '1mb' }))

// ── SSE CLIENT REGISTRY ────────────────────────────────────────────────────────
const clients = new Set()

function broadcast(type, data) {
  const payload = `data: ${JSON.stringify({ type, data, ts: Date.now() })}\n\n`
  clients.forEach(res => {
    try { res.write(payload) } catch (_) { clients.delete(res) }
  })
}

// ── IN-MEMORY STATE ────────────────────────────────────────────────────────────
let state = {
  active_signal: null,
  dashboard: defaultDashboard(),
  today: {
    total_sigs: 0, blocked: 0,
    tp1_hits: 0, tp2_hits: 0, tp3_hits: 0, sl_hits: 0,
    gross_win_pts: 0, gross_loss_pts: 0,
    win_rate: 0, profit_factor: 0, net_pts: 0,
    london_cnt: 0, ny_cnt: 0, asia_cnt: 0
  },
  recent_signals: [],   // last 20
  recent_messages: []   // last 50
}

// ── DB (optional — degrades gracefully if DATABASE_URL not set) ────────────────
let db = null
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg')
    db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    initDb()
  } catch (e) {
    console.warn('[DB] pg not available, running in-memory only:', e.message)
  }
}

async function initDb() {
  if (!db) return
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS signals (
        id SERIAL PRIMARY KEY, trade_id TEXT UNIQUE, symbol TEXT, action TEXT,
        direction TEXT, sl_price FLOAT, tp1_price FLOAT, tp2_price FLOAT, tp3_price FLOAT,
        pct1 FLOAT, pct2 FLOAT, score FLOAT DEFAULT 0, master_bias TEXT DEFAULT '',
        session TEXT DEFAULT '', status TEXT DEFAULT 'ACTIVE',
        pts_actual FLOAT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, content TEXT, event_type TEXT,
        parsed JSONB, claude_analysis TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS performance (
        id INT PRIMARY KEY DEFAULT 1,
        total_sigs INT DEFAULT 0, blocked INT DEFAULT 0,
        tp1_hits INT DEFAULT 0, tp2_hits INT DEFAULT 0,
        tp3_hits INT DEFAULT 0, sl_hits INT DEFAULT 0,
        gross_win_pts FLOAT DEFAULT 0, gross_loss_pts FLOAT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      INSERT INTO performance (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    `)
    console.log('[DB] Tables ready')
  } catch (e) {
    console.error('[DB] Init error:', e.message)
  }
}

async function dbSaveSignal(sig) {
  if (!db) return
  try {
    await db.query(
      `INSERT INTO signals (trade_id,symbol,action,direction,sl_price,tp1_price,tp2_price,tp3_price,pct1,pct2,score,master_bias,session)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (trade_id) DO NOTHING`,
      [sig.trade_id, sig.symbol, sig.action, sig.direction, sig.sl_price, sig.tp1_price, sig.tp2_price, sig.tp3_price,
       sig.pct1, sig.pct2, sig.score || 0, sig.master_bias || '', sig.session || '']
    )
  } catch (e) { console.error('[DB] save signal:', e.message) }
}

async function dbSaveMessage(content, event_type, parsed, analysis) {
  if (!db) return
  try {
    await db.query(
      `INSERT INTO messages (content, event_type, parsed, claude_analysis) VALUES ($1,$2,$3,$4)`,
      [content, event_type, JSON.stringify(parsed), analysis || null]
    )
  } catch (e) { console.error('[DB] save message:', e.message) }
}

// ── PARSERS ────────────────────────────────────────────────────────────────────

function parseTradeSgnl(str) {
  if (!str || typeof str !== 'string') return null
  const parts = str.trim().split(',')
  if (parts.length < 3) return null
  const sig = { license: parts[0], symbol: parts[1], action: parts[2] }
  for (let i = 3; i < parts.length; i++) {
    const idx = parts[i].indexOf('=')
    if (idx === -1) continue
    const k = parts[i].slice(0, idx).trim()
    const v = parts[i].slice(idx + 1).trim()
    sig[k] = isNaN(Number(v)) ? v : Number(v)
  }
  return sig
}

function parseGlassBox(text) {
  if (!text || typeof text !== 'string') return {}
  const p = {}

  const ev = text.match(/🔔 EVENT:\s*(.+)/)
  if (ev) p.event_type = ev[1].trim()

  const asset = text.match(/📊 Asset\s*:\s*(\w+)\s*\|\s*(\w+)/)
  if (asset) { p.symbol = asset[1]; p.timeframe = asset[2] }

  const price = text.match(/💰 Price\s*:\s*([\d.]+)/)
  if (price) p.price = parseFloat(price[1])

  const session = text.match(/🌍 Session\s*:\s*(.+)/)
  if (session) p.session = session[1].trim()

  const daily = text.match(/📅 Daily\s*:\s*(.+)/)
  if (daily) p.daily_context = daily[1].trim()

  const dir = text.match(/Direction\s*:\s*(🟢 LONG|🔴 SHORT)/)
  if (dir) p.direction = dir[1].includes('LONG') ? 'LONG' : 'SHORT'

  const entry = text.match(/Entry\s*:\s*([\d.]+)/)
  if (entry) p.entry = parseFloat(entry[1])

  const sl = text.match(/Stop Loss\s*:\s*([\d.]+)/)
  if (sl) p.sl = parseFloat(sl[1])

  const tp1 = text.match(/TP1[^:]*:\s*([\d.]+)\s*\(/)
  if (tp1) p.tp1 = parseFloat(tp1[1])

  const tp2 = text.match(/TP2[^:]*:\s*([\d.]+)\s*\(/)
  if (tp2) p.tp2 = parseFloat(tp2[1])

  const tp3 = text.match(/TP3[^:]*:\s*([\d.]+)\s*\(/)
  if (tp3) p.tp3 = parseFloat(tp3[1])

  const tid = text.match(/Trade ID\s*:\s*(ATM-[\w-]+)/)
  if (tid) p.trade_id = tid[1]

  const score = text.match(/Score\s*:\s*(-?\d+)\/15/)
  if (score) p.score = parseInt(score[1])

  const bias = text.match(/Master Bias\s*:\s*(.+)/)
  if (bias) p.master_bias = bias[1].trim()

  const advice = text.match(/💡 AGENT ADVICE\n─+\n(.+)/)
  if (advice) p.ai_advice = advice[1].trim()

  const pf = text.match(/PF:\s*([\d.]+)/)
  if (pf) p.profit_factor = parseFloat(pf[1])

  const wr = text.match(/WR:\s*([\d.]+)%/)
  if (wr) p.win_rate = parseFloat(wr[1])

  const bsl = text.match(/Buy-side\s*:\s*([\d.]+)/)
  if (bsl) p.buy_side_liq = parseFloat(bsl[1])

  const ssl = text.match(/Sell-side\s*:\s*([\d.]+)/)
  if (ssl) p.sell_side_liq = parseFloat(ssl[1])

  const lctx = text.match(/Context\s*:\s*(.+)/)
  if (lctx) p.liq_context = lctx[1].trim()

  // 5-layer tree icons
  const layers = {}
  const layerRx = /[├└]──\s+(D|H4|H1|M15|M5)\s*(?:\([^)]+\))?\s*(🟢|🔴|🟡|🟠|⚪)/g
  let lm
  while ((lm = layerRx.exec(text)) !== null) layers[lm[1]] = lm[2]
  if (Object.keys(layers).length) p.layers = layers

  // Regime details per layer
  const regimeRx = /[│ ]\s+Regime\s*:(\w+)\s+V\.WAP\s*:(\w+)\s+Fib Trend\s*:(\w+)\s+RSI:(\w+)/g
  const layerOrder = ['D','H4','H1','M15','M5']
  let ri = 0, rm
  if (!p.layer_details) p.layer_details = {}
  while ((rm = regimeRx.exec(text)) !== null && ri < layerOrder.length) {
    p.layer_details[layerOrder[ri]] = { regime: rm[1], vwap: rm[2], fib: rm[3], rsi: rm[4] }
    ri++
  }

  return p
}

function sessionFromParsed(parsed) {
  if (!parsed.session) return null
  const s = parsed.session.toUpperCase()
  if (s.includes('LONDON') || s.includes('LDN')) return 'LDN'
  if (s.includes('NEW YORK') || s.includes('NY')) return 'NY'
  if (s.includes('TOKYO') || s.includes('ASIA')) return 'ASIA'
  return null
}

// ── REAL PIP MATH VALIDATOR ────────────────────────────────────────────────────
const PIP_VALUES = {
  XAUUSD:            { pip: 0.10, per_lot: 10.0 },
  XAGUSD:            { pip: 0.001, per_lot: 50.0 },
  GBPUSD:            { pip: 0.0001, per_lot: 10.0 },
  EURUSD:            { pip: 0.0001, per_lot: 10.0 },
  NZDUSD:            { pip: 0.0001, per_lot: 10.0 },
  EURAUD:            { pip: 0.0001, per_lot: 10.0 },
  USDJPY:            { pip: 0.01, per_lot: 9.0 },
  GBPJPY:            { pip: 0.01, per_lot: 9.0 },
  XAGUSD:            { pip: 0.001, per_lot: 50.0 },
  XAGUSD:            { pip: 0.001, per_lot: 50.0 },
  // Deriv synthetics — approximate, verify with Deriv
  VOLATILITY_10_INDEX:    { pip: 0.001, per_lot: 1.0 },
  VOLATILITY_25_1S_INDEX: { pip: 0.001, per_lot: 0.2 },
  VOLATILITY_50_INDEX:    { pip: 0.001, per_lot: 0.5 },
  VOLATILITY_75_INDEX:    { pip: 0.001, per_lot: 0.75 },
  VOLATILITY_100_INDEX:   { pip: 0.001, per_lot: 1.0 },
  STEP_INDEX:             { pip: 0.001, per_lot: 1.0 },
}

function validateRisk(symbol, entry, sl_price) {
  const spec = PIP_VALUES[symbol]
  if (!spec || !entry || !sl_price) return null
  const sl_pips = Math.abs(entry - sl_price) / spec.pip
  const per_micro = sl_pips * spec.per_lot * 0.01   // risk per 0.01 lot
  const lots_for_15 = 0.15 / (sl_pips * spec.per_lot * 0.01) * 0.01
  const nearest = Math.round(lots_for_15 / 0.01) * 0.01
  const actual_risk = nearest * sl_pips * spec.per_lot
  return {
    sl_pips: Math.round(sl_pips * 10) / 10,
    risk_per_micro: Math.round(per_micro * 100) / 100,
    required_lots: Math.round(lots_for_15 * 10000) / 10000,
    nearest_lots: nearest,
    actual_risk: Math.round(actual_risk * 100) / 100
  }
}

// ── DASHBOARD STATE UPDATER ────────────────────────────────────────────────────
function updateDashboardFromParsed(parsed) {
  const d = state.dashboard
  if (parsed.symbol)       d.symbol = parsed.symbol
  if (parsed.price)        d.price = parsed.price
  if (parsed.session)      d.session = parsed.session
  if (parsed.daily_context) d.pdh_pdl_status = parsed.daily_context
  if (parsed.score !== undefined) d.total_score = parsed.score
  if (parsed.master_bias)  d.master_bias = parsed.master_bias
  if (parsed.ai_advice)    d.ai_advice = parsed.ai_advice
  if (parsed.profit_factor !== undefined) d.today.profit_factor = parsed.profit_factor
  if (parsed.win_rate !== undefined)      d.today.win_rate = parsed.win_rate
  if (parsed.buy_side_liq)  d.ph_top = parsed.buy_side_liq
  if (parsed.sell_side_liq) d.pl_btm = parsed.sell_side_liq
  if (parsed.liq_context)   d.liq_bias = parsed.liq_context
  if (parsed.layers)        d.layers_icons = parsed.layers
  if (parsed.layer_details) d.layers = { ...d.layers, ...parsed.layer_details }

  const et = (parsed.event_type || '').toUpperCase()

  // Active trade management
  if (parsed.trade_id && parsed.entry && (et.includes('LONG') || et.includes('SHORT') || et.includes('COUNTER'))) {
    d.trade = {
      active:     true,
      trade_id:   parsed.trade_id,
      direction:  parsed.direction === 'LONG' ? 1 : -1,
      entry:      parsed.entry,
      sl:         parsed.sl,
      tp1:        parsed.tp1, tp2: parsed.tp2, tp3: parsed.tp3,
      tp1_hit:    false, tp2_hit: false, tp3_hit: false,
      phase:      'ENTRY',
      trade_phase_display: parsed.direction === 'LONG' ? '🟢 LONG — ENTRY ACTIVE' : '🔴 SHORT — ENTRY ACTIVE'
    }
  }

  if (d.trade.active) {
    if (et.includes('TP1 HIT')) {
      d.trade.tp1_hit = true
      d.trade.phase = 'TP1_HIT'
      d.trade.trade_phase_display = '🎯 TP1 HIT — PARTIAL SECURED'
    } else if (et.includes('TP2 HIT')) {
      d.trade.tp2_hit = true
      d.trade.phase = 'TP2_HIT'
      d.trade.trade_phase_display = '🎯🎯 TP2 HIT — BREAKEVEN SET'
    } else if (et.includes('TP3 HIT')) {
      d.trade.tp3_hit = true
      d.trade.phase = 'TP3_HIT'
      d.trade.trade_phase_display = '🚀 TP3 HIT — HOLDER MODE'
    } else if (et.includes('HOLDER MODE EXIT')) {
      d.trade.phase = 'HOLDER_EXIT'
      d.trade.active = false
      d.trade.trade_phase_display = '🏁 HOLDER EXIT — CLOSED'
    } else if (et.includes('STOP HIT') || et.includes('AUTOPSY')) {
      d.trade.phase = 'SL_HIT'
      d.trade.active = false
      d.trade.trade_phase_display = '💀 STOP HIT'
    }
  }
}

// ── CLAUDE ANALYSIS (background, non-blocking) ────────────────────────────────
let anthropic = null
try {
  if (process.env.ANTHROPIC_API_KEY) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
} catch (_) {}

const SYSTEM_PROMPT = `You are the Glass Box Intelligence Engine for Absolute Dollar Terminal — ADSA v8.
Speak in the ADSA voice: precise, clinical, structured. No fluff. Max 3 sentences.
You analyze incoming alerts and provide a brief edge assessment.
Rules: abs(score) < 4 → STAND_ASIDE. Sovereign counter-trend → TP1 only. ATR=Low → CAUTION minimum.
Never change the raw figures. Return a single JSON object:
{"verdict":"EXECUTE|CAUTION|STAND_ASIDE|COUNTER_TREND_ONLY","edge_note":"one sentence","max_tp":"TP1_ONLY|TP2|TP3|HOLDER_MODE","confidence":0-100}`

async function analyzeWithClaude(parsed) {
  if (!anthropic) return null
  try {
    const ctx = `EVENT: ${parsed.event_type || 'UNKNOWN'}
SYMBOL: ${parsed.symbol || 'XAUUSD'} | PRICE: ${parsed.price || 0}
SCORE: ${parsed.score !== undefined ? parsed.score + '/15' : 'N/A'}
BIAS: ${parsed.master_bias || 'N/A'}
LAYERS: ${JSON.stringify(parsed.layers || {})}
DIRECTION: ${parsed.direction || 'N/A'}
ENTRY: ${parsed.entry || 'N/A'} | SL: ${parsed.sl || 'N/A'}
ADVICE: ${parsed.ai_advice || 'N/A'}`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: ctx }]
    })
    return JSON.parse(msg.content[0].text)
  } catch (e) {
    return null
  }
}

// ── ENDPOINTS ──────────────────────────────────────────────────────────────────

// Webhook: TradeSgnl signal format
app.post('/webhook/signal', async (req, res) => {
  const secret = req.headers['x-adsa-secret']
  if (process.env.ADSA_SECRET && secret !== process.env.ADSA_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  const sig = parseTradeSgnl(raw)
  if (!sig) return res.status(400).json({ error: 'Invalid signal format' })

  const direction = sig.action === 'buy' ? 'LONG' : sig.action === 'sell' ? 'SHORT' : sig.action.toUpperCase()
  const enriched = {
    ...sig,
    direction,
    trade_id: sig.trade_id || `TRK-${Date.now()}`,
    received_at: new Date().toISOString(),
    risk_math: validateRisk(sig.symbol, sig.entry_price, sig.sl_price)
  }

  // Keep last 20 signals
  state.recent_signals.unshift(enriched)
  if (state.recent_signals.length > 20) state.recent_signals.pop()

  if (['buy', 'sell'].includes(sig.action)) {
    state.active_signal = enriched
    state.today.total_sigs++
    const sess = enriched.session_hint || 'UNKNOWN'
    if (sess.includes('LDN')) state.today.london_cnt++
    else if (sess.includes('NY')) state.today.ny_cnt++
    else state.today.asia_cnt++
  }

  if (['closebuy', 'closesell'].includes(sig.action)) {
    state.active_signal = null
  }

  await dbSaveSignal(enriched)
  broadcast('signal_new', enriched)
  console.log(`[SIGNAL] ${sig.action} ${sig.symbol} SL:${sig.sl_price} TP1:${sig.tp1_price}`)
  res.json({ ok: true, signal: enriched })
})

// Webhook: Glass Box message (full narrative)
app.post('/webhook/message', async (req, res) => {
  const secret = req.headers['x-adsa-secret']
  if (process.env.ADSA_SECRET && secret !== process.env.ADSA_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const content = typeof req.body === 'string' ? req.body : (req.body?.message || JSON.stringify(req.body))
  if (!content) return res.status(400).json({ error: 'Empty message' })

  const parsed = parseGlassBox(content)
  const event_type = parsed.event_type || 'UNKNOWN'
  const timestamp = new Date().toISOString()

  // Update live dashboard state from message
  updateDashboardFromParsed(parsed)

  // Performance counters from event type
  const et = event_type.toUpperCase()
  if (et.includes('TP1 HIT')) { state.today.tp1_hits++; recomputeStats() }
  if (et.includes('TP2 HIT')) { state.today.tp2_hits++; recomputeStats() }
  if (et.includes('TP3 HIT')) { state.today.tp3_hits++; recomputeStats() }
  if (et.includes('STOP HIT') || et.includes('AUTOPSY')) { state.today.sl_hits++; recomputeStats() }
  if (et.includes('BLOCKED') || et.includes('REJECTION')) state.today.blocked++

  const msgRecord = { content, event_type, parsed, timestamp, id: Date.now() }

  // Run Claude analysis in background — don't block response
  if (anthropic && (et.includes('SIGNAL') || et.includes('LONG') || et.includes('SHORT'))) {
    analyzeWithClaude(parsed).then(analysis => {
      if (analysis) {
        msgRecord.claude_analysis = analysis
        broadcast('message_analysis', { id: msgRecord.id, analysis })
        dbSaveMessage(content, event_type, parsed, JSON.stringify(analysis))
      }
    }).catch(() => {})
  } else {
    dbSaveMessage(content, event_type, parsed, null)
  }

  state.recent_messages.unshift(msgRecord)
  if (state.recent_messages.length > 50) state.recent_messages.pop()

  broadcast('glass_box', { content, event_type, parsed, timestamp, id: msgRecord.id })
  console.log(`[MSG] ${event_type} | ${parsed.symbol || ''} | score:${parsed.score ?? 'N/A'}`)
  res.json({ ok: true, event_type, parsed })
})

// Webhook: outcome (TP1/TP2/TP3/SL hit — from TradingView or manual)
app.post('/webhook/outcome', async (req, res) => {
  const { trade_id, outcome_type, pts_actual } = req.body || {}
  if (!trade_id || !outcome_type) return res.status(400).json({ error: 'Missing trade_id or outcome_type' })

  const sig = state.recent_signals.find(s => s.trade_id === trade_id)
  if (sig) sig.status = outcome_type

  if (outcome_type === 'TP1') { state.today.tp1_hits++; if (pts_actual) state.today.gross_win_pts += pts_actual }
  if (outcome_type === 'TP2') { state.today.tp2_hits++; if (pts_actual) state.today.gross_win_pts += pts_actual }
  if (outcome_type === 'TP3') { state.today.tp3_hits++; if (pts_actual) state.today.gross_win_pts += pts_actual }
  if (outcome_type === 'SL')  { state.today.sl_hits++;  if (pts_actual) state.today.gross_loss_pts += Math.abs(pts_actual) }

  recomputeStats()
  broadcast('signal_update', { trade_id, outcome_type, pts_actual, today: state.today })

  if (db) {
    db.query('UPDATE signals SET status=$1, pts_actual=$2 WHERE trade_id=$3', [outcome_type, pts_actual, trade_id]).catch(() => {})
  }
  res.json({ ok: true })
})

// SSE stream
app.get('/terminal/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Send initial state
  res.write(`data: ${JSON.stringify({ type: 'init', data: getState() })}\n\n`)
  clients.add(res)

  const ping = setInterval(() => {
    try { res.write(': ping\n\n') } catch (_) { clearInterval(ping); clients.delete(res) }
  }, 15000)

  req.on('close', () => { clearInterval(ping); clients.delete(res) })
})

// Full state snapshot
app.get('/api/state', (req, res) => res.json(getState()))

// Claude research endpoint
app.post('/api/research', async (req, res) => {
  const { symbol, question } = req.body || {}
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' })

  if (!anthropic) return res.status(503).json({ error: 'Claude API not configured' })

  const RESEARCH_SYSTEM = `You are the Glass Box Intelligence Engine for Absolute Dollar Terminal — ADSA v8.
You speak in the ADSA voice: precise, clinical, structured. No fluff.
You know: SMC (BOS/CHoCH/OB/FVG/liquidity sweeps), Fractal 4-Layer Protocol (Sovereign=Daily/Anchor=H1/Filter=M15/Exec=TF),
Claw Liquidity Trail (ratcheting ATR around EMA, MTF M5/M15/H1), Confidence Engine (6 weighted factors),
Platinum Risk Model (TP1=1:1, TP2=1.5:1, TP3=2:1, risk=$15).
Rules: abs(score)<4 → STAND_ASIDE. Sovereign counter-trend → max_tp=TP1_ONLY. ATR=Low → CAUTION minimum.
Return ONLY valid JSON: {"enhanced_commentary":"string","risk_verdict":"EXECUTE|CAUTION|STAND_ASIDE|COUNTER_TREND_ONLY","risk_reason":"string","key_level":"string","session_context":"string","max_tp":"TP1_ONLY|TP2|TP3|HOLDER_MODE","confidence":0}`

  try {
    const ctx = `Symbol: ${symbol}
Question: ${question || 'Full 4-layer alignment and trade bias assessment'}
Current dashboard state: ${JSON.stringify(state.dashboard, null, 2)}`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: RESEARCH_SYSTEM,
      messages: [{ role: 'user', content: ctx }]
    })
    const result = JSON.parse(msg.content[0].text)
    res.json({ symbol, ...result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── HELPERS ────────────────────────────────────────────────────────────────────
function recomputeStats() {
  const t = state.today
  const wins = t.tp1_hits + t.tp2_hits + t.tp3_hits
  const total = wins + t.sl_hits
  t.win_rate = total > 0 ? Math.round((wins / total) * 100 * 10) / 10 : 0
  t.net_pts  = Math.round((t.gross_win_pts - t.gross_loss_pts) * 10) / 10
  t.profit_factor = t.gross_loss_pts > 0 ? Math.round((t.gross_win_pts / t.gross_loss_pts) * 100) / 100 : (t.gross_win_pts > 0 ? 99.0 : 0)
}

function getState() {
  return {
    active_signal:    state.active_signal,
    today:            state.today,
    recent_signals:   state.recent_signals,
    recent_messages:  state.recent_messages,
    dashboard:        state.dashboard
  }
}

function defaultDashboard() {
  return {
    symbol: 'XAUUSD', timeframe: '1', price: 0,
    session: '', pdh_pdl_status: '',
    total_score: 0,
    master_bias: '⚪ NEUTRAL — STAND ASIDE',
    ai_advice: 'Awaiting signal...',
    ph_top: 0, pl_btm: 0, liq_bias: '⚪ Neutral',
    layers_icons: { D: '⚪', H4: '⚪', H1: '⚪', M15: '⚪', M5: '⚪' },
    layers: {
      D:   { regime: 'Neut', vwap: 'Neut', fib: 'Neut', rsi: 'Neut' },
      H4:  { regime: 'Neut', vwap: 'Neut', fib: 'Neut', rsi: 'Neut' },
      H1:  { regime: 'Neut', vwap: 'Neut', fib: 'Neut', rsi: 'Neut' },
      M15: { regime: 'Neut', vwap: 'Neut', fib: 'Neut', rsi: 'Neut' },
      M5:  { regime: 'Neut', vwap: 'Neut', fib: 'Neut', rsi: 'Neut' }
    },
    trade: {
      active: false, phase: 'WAITING', trade_id: 'NONE',
      direction: 0, entry: 0, sl: 0, tp1: 0, tp2: 0, tp3: 0,
      tp1_hit: false, tp2_hit: false, tp3_hit: false,
      trade_phase_display: '⚪ SCANNING...'
    },
    today: { total_sigs: 0, blocked: 0, tp1_hits: 0, tp2_hits: 0, tp3_hits: 0, sl_hits: 0,
             win_rate: 0, profit_factor: 0, net_pts: 0, london_cnt: 0, ny_cnt: 0, asia_cnt: 0 }
  }
}

// ── SERVE FRONTEND IN PRODUCTION ───────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')))
}

app.listen(PORT, () => {
  console.log(`\n🚀 ABSOLUTE DOLLAR TERMINAL`)
  console.log(`   Server: http://localhost:${PORT}`)
  console.log(`   Webhooks:`)
  console.log(`     POST /webhook/signal   ← TradeSgnl format`)
  console.log(`     POST /webhook/message  ← Glass Box narrative`)
  console.log(`     POST /webhook/outcome  ← TP/SL outcomes`)
  console.log(`   Stream:  GET  /terminal/stream`)
  console.log(`   State:   GET  /api/state`)
  console.log(`   Claude:  POST /api/research`)
  console.log(`   DB: ${db ? 'PostgreSQL connected' : 'In-memory mode'}`)
  console.log(`   Claude: ${anthropic ? 'API ready' : 'No API key'}`)
  console.log()
})
