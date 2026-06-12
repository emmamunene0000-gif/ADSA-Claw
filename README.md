# ADA — Absolute Dollar Agent
### Claude Externalized as Augmented Intelligence for Trading

> **The Pivot:** This is no longer a masterclass funnel for an indicator. The ATM Protocol becomes **ADA — Absolute Dollar Agent**: Claude externalized as a trading intelligence. Not "AI-powered tool" — Claude IS the agent.

```
┌─────────────────────────────────────────────────────────────────────┐
│  AUTONOMOUS DECISION SUPPORT SYSTEM (DSS)                          │
│  Liquidity Extraction Protocol · Multi-Asset · MT5 + TradeSgnl    │
│  Pine Script v8.1 ← Claude API → Express Server → React Terminal  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

```
TradingView (ADSA v8.1 Pine Script)
    │
    ├── Webhook: POST /webhook/signal    ← TradeSgnl super payload
    │         LICENSE,SYMBOL,buy/sell,dollarrisk=,entry=,sl=,tp1=,...
    │
    ├── Webhook: POST /webhook/message   ← Glass Box narrative
    │         Full 5-layer analysis with score, session, trade params
    │
    └── Webhook: POST /webhook/outcome   ← TP/SL results (optional)

Express Server (server/index.js)
    │
    ├── parseTradeSgnl()  → enriched signal object
    ├── parseGlassBox()   → structured dashboard state
    ├── validateRisk()    → pip math per asset class
    ├── analyzeSignal()   → Claude Sonnet 4.6 → verdict
    ├── sendTelegram()    → Glass Box card to channel
    ├── broadcast()       → SSE push to all terminal clients
    └── dbSaveSignal()    → PostgreSQL (optional, degrades gracefully)

MT5 (TradeSgnl EA v0.60)
    ← super payload via TradingView alert webhook
    ← Parameter Source = Signal Parameters ✅
    ← EA calculates lot size from dollarrisk= field

React Terminal (src/)
    ← SSE /terminal/stream → real-time state
    ← Left:   Agent Dashboard (24-subsystem Pine mirror)
    ← Center: TradingView chart + Watchlist Research (24 assets)
    ← Right:  Signal Feed + Glass Box War Room Feed

Telegram Channel
    ← Signal card: entry/SL/TP/conf/Claude verdict on every signal
    ← Lifecycle cards: TP1/2/3 hits, SL, holder exits, BE hits
```

---

## Pine Script — ADSA v8.1

**File:** `ADSA - Claw V8.txt`

### 24 Subsystems

| # | Section | Description |
|---|---------|-------------|
| 1 | Inputs | All strategy inputs (grpAdmin / grpATM / grpClaw / grpConf / grpRisk / grpDash) |
| 2 | Super Admin | License gate, manual bias override, SILENCE mode |
| 3 | Session | London / NY / Asia detection with EAT offset |
| 4 | ATM Bot | UT Bot oscillator — TIMING trigger only (WHEN, not WHICH WAY) |
| 5 | Claw Trail | Ratcheting ATR trail around EMA — directional TRUTH gate |
| 6 | Claw MTF | M5 / M15 / H1 multi-timeframe trail direction |
| 7 | Regime | Trend regime via LinReg candles |
| 8 | VWAP | Anchored VWAP direction |
| 9 | Fib Trend | Fibonacci trend gate |
| 10 | RSI | Standard RSI + extreme zone detection |
| 11 | MACD | MACD bias |
| 12 | Volume Profile | Volume-weighted bias |
| 13 | SMC Structure | BOS / CHoCH detection |
| 14 | Risk Engine | ATR-based SL/TP calc, pip helpers, lot size display |
| 15 | Longevity Zones | Support/resistance zone detection |
| 16 | Signal Formation | SYNC4 / COUNTER / LOCAL classification |
| 17 | Confidence Engine | 6-factor weighted scoring → claw_bull_conf / claw_bear_conf |
| 18 | Alert Functions | f_format_alert(), f_alert_p(), super payload assembly |
| 19 | Entry Execution | strategy.entry() with pyramid flag, locked_ vars capture |
| 20 | 5-Layer Narrative | Per-TF score tree, master_bias, Glass Box alert assembly |
| 21 | TS Automation | BE move, partial close (TP1/TP2), trail alerts for EA |
| 22 | Performance | DPT arrays, daily P&L tracking, 21:00 UTC daily report |
| 23 | Trade Display | Live dashboard on TradingView chart |
| 24 | Signal Holder | 34-period signal smoothing kill switch for runner position |

### v8.1 Additions

| Addition | Description |
|----------|-------------|
| **9 — Super Payload** | Full `dollarrisk=,entry=,sl=,tp1=,...,signal_type=,conf=,py` entry messages |
| **10 — Signal Holder Kill Switch** | 34-period EMA of `_bclose` replaces VWAP as holder mode exit |
| **11 — Net Pips Tracker / Orphan Fix** | DPT arrays track actual exit price + signed net pips; orphan trades resolved at reversal bar |

### Architecture: TRIGGER → GATE → CONFLUENCE → CONFIDENCE → EXECUTION

```
ATM Bot (UT Bot)          TRIGGER: WHEN to consider a trade
    ↓
Claw Direction            GATE 1: Directional TRUTH (trail direction = allowed side)
Regime Filter             GATE 2: Trend regime must align
    ↓
VWAP + Fib + RSI          CONFLUENCE: Score the setup (not hard gates in v8.1+)
MACD + Vol + SMC          Weighted factors for Confidence Engine
    ↓
Confidence Engine         6-factor weighted score → claw_bull_conf / claw_bear_conf
(threshold: 60% default)  Threshold: Conservative 70% / Moderate 60% / Aggressive 50%
    ↓
Signal Classification:    SYNC4   — all 4 fractal layers aligned
  SYNC4 / COUNTER / LOCAL COUNTER — sovereign layer against trade direction
                          LOCAL   — exec TF only, no upper-layer alignment
    ↓
locked_ vars captured     entry, SL, BE pips, trail pips, conf%, signal_type
    ↓
strategy.entry()          EXECUTION: fires Super Payload webhook to TradeSgnl EA
```

### Super Payload Format

```
LICENSE_ID,{{ticker}},buy,dollarrisk={{risk}},entry={{entry}},sl={{sl}},tp1={{tp1}},pct1=0.33,tp2={{tp2}},pct2=0.50,tp3={{tp3}},betrig={{be_pips}},bedist={{bedist}},trtrig=2,trdist={{trdist}},trstep={{trstep}},signal_type={{tag}},conf={{conf}},py
```

| Parameter | Pine Source | Description |
|-----------|-------------|-------------|
| `dollarrisk` | `risk_per_trade` input ($15 default) | Dollar risk — EA calculates real lots |
| `entry` | `locked_entry` (close at signal bar) | Locked entry price |
| `sl` | `risk_dist` ATR-based SL | Stop loss price |
| `tp1/2/3` | 1:1 / 1.5:1 / 2:1 R multiples | Three take profit levels |
| `pct1=0.33` | Fixed | Close 33% at TP1 |
| `pct2=0.50` | Fixed | Close 50% of remainder at TP2 |
| `betrig` | `math.round(_pips(risk_dist))` | Pips profit to trigger BE move |
| `bedist` | `ts_be_buffer_pts × mintick × 10` pips | BE buffer beyond entry |
| `trtrig=2` | Fixed multiplier | Trail activates at 2× ATR profit |
| `trdist` | `risk_atr × 1.5` pips | Trail distance from price |
| `trstep` | `risk_atr × 0.5` pips | Trail step size |
| `signal_type` | `locked_sig_type` | SYNC4 \| COUNTER \| LOCAL |
| `conf` | `locked_conf` (after Section 20) | Confidence % |
| `py` | Static flag | EA pyramiding flag (pyramiding=10 on EA) |

**Critical for Deriv Synthetics:** Pine Script cannot access Deriv's contract specs. `dollarrisk=` lets the TradeSgnl EA calculate the correct lot size from MT5's actual contract data.

### Holder Mode — Signal Smoothing Kill Switch

Subsystem 24 uses the **34-period EMA of `_bclose`** (signal smoothing line) as the holder exit trigger.

```pine
holder_trail_type  = input.string("Signal", options=["Signal", "Structural"])
signal_length      = input.int(34, "Signal Smoothing")
float active_trail = holder_trail_type == "Signal" ? signal : holder_trail_price

bool _trail_crossunder = ta.crossunder(close, active_trail)   // extracted to global scope
bool _trail_crossover  = ta.crossover(close, active_trail)    // to avoid CW10002 warning
bool holder_exit_long  = holder_mode_active and trade_direction ==  1 and _trail_crossunder
bool holder_exit_short = holder_mode_active and trade_direction == -1 and _trail_crossover
```

| Exit Path | Trigger | Exit Price | Net Pips Logged |
|-----------|---------|------------|-----------------|
| Signal cross (default) | `close` crosses 34-EMA | `close` | Signed actual |
| Structural trail | `close` crosses `holder_trail_price` | `close` | Signed actual |
| Orphan (opposite signal) | New signal while trade running | `close` at reversal bar | Signed actual |
| SL hit | `low < locked_sl` (long) | `locked_sl` | Signed actual |

### Performance Arrays (DPT)

```pine
var array<int>   dpt_dir        // 1=long, -1=short
var array<float> dpt_entry_px   // entry price
var array<float> dpt_exit_px    // actual exit price
var array<float> dpt_net_pips   // signed net pips
var array<bool>  dpt_tp1_hit    // TP1 achieved
var array<bool>  dpt_sl_hit     // SL hit (or orphan = forced SL)
var int          dpt_active_idx // index of running trade (-1 = none)
```

Net pips: `math.round(_pips(direction × (exit_price − entry_price)), 1)`

### Pre-Declaration Pattern (CE10272 fix)

All `locked_` variables referenced inside `f_format_alert()` must be declared **before** the function:

```pine
// Must appear BEFORE f_format_alert() in source — Pine v6 forward-reference constraint
var float  locked_entry    = na
var float  locked_be_pips  = na
var float  locked_bedist   = na
var float  locked_trdist   = na
var float  locked_trstep   = na
var float  locked_conf     = na
var string locked_sig_type = ""
```

---

## Server — Express Backend

**File:** `server/index.js`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webhook/signal` | TradeSgnl super payload → Claude → Telegram card → SSE |
| `POST` | `/webhook/message` | Glass Box narrative → dashboard update → lifecycle Telegram → SSE |
| `POST` | `/webhook/outcome` | Manual TP/SL result → performance counters → SSE |
| `GET` | `/terminal/stream` | SSE stream (15s ping keepalive) |
| `GET` | `/api/state` | Full state snapshot JSON |
| `POST` | `/api/research` | Claude watchlist research |
| `GET` | `/test-signal` | Demo SYNC4 buy → Claude → Telegram (no TradingView needed) |

### SSE Event Types

| Event | Payload | Frontend Action |
|-------|---------|----------------|
| `init` | Full state snapshot | Hydrate terminal on connect |
| `signal_new` | Enriched signal | Add to signal feed |
| `signal_analysis` | `{ trade_id, analysis }` | Attach Claude verdict to signal card |
| `signal_update` | `{ trade_id, outcome_type, today }` | Update status + perf counters |
| `glass_box` | `{ content, event_type, parsed, ts }` | Add to war room feed |
| `message_analysis` | `{ id, analysis }` | Attach Claude verdict to message card |

### Claude Responses

**Signal analysis** (SYSTEM_PROMPT, 200 tokens):
```json
{ "verdict": "EXECUTE|CAUTION|STAND_ASIDE|COUNTER_TREND_ONLY",
  "edge_note": "one sentence",
  "max_tp": "TP1_ONLY|TP2|TP3|HOLDER_MODE",
  "confidence": 0 }
```

**Research** (RESEARCH_SYSTEM, 600 tokens):
```json
{ "enhanced_commentary": "...", "risk_verdict": "...", "risk_reason": "...",
  "key_level": "...", "session_context": "...", "max_tp": "...", "confidence": 0 }
```

### Telegram Card Format

Signal card (every buy/sell):
```
🔔 ADSA SIGNAL — XAUUSD
━━━━━━━━━━━━━━━━━━━━━━
🟢 LONG | SYNC4 [78%]
━━━━━━━━━━━━━━━━━━━━━━
Entry  : 2345.50
SL     : 2340.20  (52 pips)
TP1    : 2350.80  (+53 pips) 33%
TP2    : 2354.10  (+87 pips) 50%
TP3    : 2358.40
Risk   : $15
BE @   : 52 pips | Dist: 5
Trail  : 15 / 5
━━━━━━━━━━━━━━━━━━━━━━
🧠 EXECUTE · HOLDER_MODE · 78%
Strong SYNC4 with multi-tf confluence
━━━━━━━━━━━━━━━━━━━━━━
⏰ 14:32 UTC
```

Lifecycle icons: 🎯 TP1 / 🎯🎯 TP2 / 🚀 TP3 / 💀 SL / 🏁 Holder Exit / 🔰 BE / 🚫 Blocked

---

## Frontend — React Terminal

### Design System (Terminal Aesthetic)

```
Background:  #0a0a14   deep void navy
Panel:       #0f0f20   panel surfaces
Card:        #13132a   card backgrounds
Border:      #1e1e3a   separators
Gold:        #FFD700   score ≥6, headers, SYNC4
Teal:        #00c9a7   BULL / LONG / TP hits / positive P&L
Red:         #ff4757   BEAR / SHORT / SL hit
Amber:       #f4a523   CAUTION / COUNTER / neutral
Text:        #e8e8f0   primary
Muted:       #6b6b8a   labels / separators

Fonts: JetBrains Mono (prices/data) · Inter (labels/headers)
```

### 3-Column Layout

```
┌────────────────────┬──────────────────────────┬──────────────┐
│  Agent Dashboard   │  TradingView Chart (55%) │ Signal Feed  │
│  300px fixed       │                          │ 340px fixed  │
│                    ├──────────────────────────│              │
│  24-subsystem      │  Watchlist Research      │ War Room     │
│  Pine mirror       │  24 assets · 4-col grid  │ Feed         │
└────────────────────┴──────────────────────────┴──────────────┘
```

### Components

| File | Responsibility |
|------|----------------|
| `App.tsx` | State tree, SSE wiring, layout |
| `Header.tsx` | Live status, EAT clock, score, price |
| `AgentDashboard.tsx` | Fractal layers, score, advice, liquidity, trade setup, today stats |
| `SignalFeed.tsx` | Signal cards (super payload fields: entry/sl/tp1/conf/BE/trail) |
| `MessageFeed.tsx` | War room feed, expandable Glass Box messages, Claude strips |
| `WatchlistGrid.tsx` | 24 assets, 4-col grid, Claude research drawer |
| `useSSE.ts` | EventSource + 3s reconnect |
| `types.ts` | All TypeScript interfaces (Signal matches super payload fields) |
| `utils/formatters.ts` | formatPrice, formatPips, pfTag, scoreColor, eventColor |

---

## Asset Support

| Class | Assets | Lot Sizing |
|-------|--------|-----------|
| Gold / Silver | XAUUSD, XAGUSD | Server pip map |
| Forex Majors | GBPUSD, EURUSD, NZDUSD, EURAUD | 4dp (JPY=2dp) |
| Deriv Synthetics | V.10, V.25\_1S, V.50, V.75, V.100 | `dollarrisk=` → EA |
| Deriv Step Index | STEP, STEP\_200/300/400/500 | `dollarrisk=` → EA |
| CFDs / Indices | WALL\_STREET\_30, US\_TECH\_100, JAPAN\_225 | Server pip map |
| Crypto | BTCUSD, SOLUSD, XRPUSD, NEARUSD, ALGOUSD | Price-point |

---

## Deployment

### Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
ADSA_SECRET=your-shared-secret
DATABASE_URL=postgresql://...        # optional — Replit provides automatically
TELEGRAM_BOT_TOKEN=1234567890:...    # @BotFather
TELEGRAM_CHAT_ID=-1001234567890      # channel = negative number
PORT=3001
NODE_ENV=production
```

### TradingView Alert Setup

**Alert 1 — TradeSgnl Signal:**
```
Webhook URL: https://YOUR-APP.replit.app/webhook/signal
Header:      x-adsa-secret: YOUR_ADSA_SECRET
Message:     {{alert_message}}
Condition:   buy_signal_confirmed or sell_signal_confirmed
```

**Alert 2 — Glass Box Narrative:**
```
Webhook URL: https://YOUR-APP.replit.app/webhook/message
Message:     {{alert_message}}
Condition:   any alert (all glass box events)
```

### Test Without TradingView

```
GET /test-signal   → demo SYNC4 XAUUSD buy → Claude analysis → Telegram card
GET /api/state     → full JSON state snapshot
```

---

## System Diagnosis (v8.1 Status)

| Component | Status | Notes |
|-----------|--------|-------|
| Pine Script ADSA v8.1 | ✅ Ready | Loaded on TradingView, super payload confirmed |
| TradeSgnl EA v0.60 | ✅ Ready | Parameter Source = Signal confirmed |
| Express server | ✅ Ready | All endpoints working |
| Telegram broadcasting | ✅ Ready | Signal + lifecycle cards implemented |
| Claude signal analysis | ✅ Ready | `analyzeSignal()` for TradeSgnl format |
| Test signal endpoint | ✅ Ready | `GET /test-signal` |
| TypeScript types | ✅ Fixed | `Signal` interface matches super payload fields |
| `validateRisk()` fields | ✅ Fixed | Uses `sig.entry`/`sig.sl` |
| `signal_analysis` SSE | ✅ Fixed | Handler wired in App.tsx |
| SignalFeed.tsx fields | ✅ Fixed | Reads `sig.sl`, `sig.tp1`, `sig.entry`, `sig.conf`, etc. |
| Telegram config | 🔧 Needs secrets | Add BOT_TOKEN + CHAT_ID to Replit |
| Lightweight Charts | 📋 Planned | Replace iframe, position overlay |
| ADA Landing Page | 📋 Planned | Tron HUD aesthetic, public portal |

---

## ADA Vision — The Next Build

```
ADA — Absolute Dollar Agent
Claude externalized as Augmented Intelligence for Trading

CURRENT:  Operator terminal (private mission control)
NEXT:     ADA Landing Page (public — "meeting a mind, not a product page")
FUTURE:   ADA Portal (beta access, Claude inside, masterclass)
```

**Landing Page Theme: Bloomberg Terminal × Tron Master Control Panel × Cyberwarfare HUD**

```css
/* Core palette */
--void:        #020617;              /* Page background */
--terminal-blue: #2C7BE5 → #5B9BFF; /* Brand, data accents */
--signal-amber:  #D4A017 → #F5C842; /* CTAs, premium tier */
--alert-red:     #E53935;            /* Danger, disclaimers */
--grid-line:     rgba(44,123,229,0.08); /* Engineering grid */

/* Key effects */
background: repeating-linear-gradient(
  90deg, rgba(44,123,229,0.03) 0, rgba(44,123,229,0.03) 1px, transparent 1px, transparent 50px
), repeating-linear-gradient(
  0deg, rgba(44,123,229,0.03) 0, rgba(44,123,229,0.03) 1px, transparent 1px, transparent 50px
);
/* glassmorphism cards */
backdrop-filter: blur(10px);
background: rgba(2,6,23,0.7);
border: 1px solid rgba(44,123,229,0.25);
box-shadow: 0 0 40px rgba(44,123,229,0.15);
/* gradient text */
background: linear-gradient(135deg, #2C7BE5, #5B9BFF);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

**Floating telemetry decorations:**
```
0x89AAD791   0x2375E00C   SYS:ONLINE   v8.1.0   CONF:78%
```

---

*ABSOLUTE DOLLAR INTELLIGENCE — ADA v8.1 | © 2026 | Not financial advice.*
*Claude is the agent. The Glass Box is the truth. The Claw extracts the dollar.*
