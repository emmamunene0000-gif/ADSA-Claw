# ADSA v8.0 — Agent Architecture & Execution Deconstruction

> **Purpose of this document:** Surgical reverse-engineering of every rule, metric, output string, and communication produced by the Absolute Dollar Supreme Agent. Every piece of text in the dashboard and every Telegram message is traced to its exact Pine Script source. This serves as the migration blueprint for the Replit + Claude terminal.

---

## Table of Contents

1. [System Philosophy](#1-system-philosophy)
2. [Architecture: Sensor Suite → Execution Brain](#2-architecture-sensor-suite--execution-brain)
3. [Signal Generation — The ATM Bot Engine](#3-signal-generation--the-atm-bot-engine)
4. [Regime Filter Stack](#4-regime-filter-stack)
5. [4-Layer Fractal State Machine](#5-4-layer-fractal-state-machine)
6. [Claw Confidence Engine](#6-claw-confidence-engine)
7. [5-Layer Scoring Engine](#7-5-layer-scoring-engine)
8. [Platinum Risk Model (SL/TP/Sizing)](#8-platinum-risk-model-sltpsizing)
9. [Trade Progression Engine](#9-trade-progression-engine)
10. [Fire-and-Forget Super Payload](#10-fire-and-forget-super-payload)
11. [TS Automation — Belt-and-Suspenders](#11-ts-automation--belt-and-suspenders)
12. [Glass Box Event System](#12-glass-box-event-system)
13. [War Room Telegram — Full Message Anatomy](#13-war-room-telegram--full-message-anatomy)
14. [Dashboard Field Map](#14-dashboard-field-map)
15. [Performance Dashboard Metrics](#15-performance-dashboard-metrics)
16. [SL Autopsy Engine](#16-sl-autopsy-engine)
17. [Rules of Engagement Summary](#17-rules-of-engagement-summary)

---

## 1. System Philosophy

```
AGENT ROLE      : Sensor Suite — observes, scores, narratises, fires
EA ROLE         : Execution Brain — receives one complete payload, manages trade locally
PINE SCRIPT     : Source of Truth for price levels (SL/TP/Entry as absolute prices)
MT5 EA          : Source of Truth for volume/lot sizing and trade management
CLAUDE TERMINAL : Live analyst — receives same data stream, provides on-demand research
```

**The agent does not micromanage MT5.** It fires one Fire-and-Forget Super Payload at entry. The EA reads the full conditional rulebook from that single message and executes autonomously — breakeven, trailing stop, partial closures — without any further instructions from Pine Script.

---

## 2. Architecture: Sensor Suite → Execution Brain

```
┌─────────────────────────────────────────────────────────────┐
│               TradingView — ADSA v8.0 Pine Script           │
│                                                             │
│  Market Data                                                │
│       │                                                     │
│       ▼                                                     │
│  ATM Bot (ATR Trail)  ──►  Raw buy/sell signals             │
│       │                                                     │
│       ▼                                                     │
│  Regime Filter  ──────────►  Filter: VWAP / Fib / RSI       │
│       │                                                     │
│       ▼                                                     │
│  4-Layer Fractal  ─────────►  Layer sync: D/H4/M15/1m        │
│       │                                                     │
│       ▼                                                     │
│  Confidence Engine  ───────►  Weighted 6-factor score %      │
│       │                                                     │
│       ▼                                                     │
│  Platinum Risk Model  ─────►  Entry, SL, TP1/2/3 (prices)   │
│       │                                                     │
│       ▼                                                     │
│  Super Payload Builder  ───►  One complete string            │
│       │                          │                          │
│       ▼                          ▼                          │
│  TradingView Alert  ──────► Webhook → TradeSgnl EA           │
│       │                                                     │
│       ▼                                                     │
│  Glass Box Builder  ───────► Telegram War Room               │
│                            ► Public Channel (sanitized)      │
│                            ► Replit Terminal (SSE stream)    │
└─────────────────────────────────────────────────────────────┘
```

**Data flow for entry:**
1. ATM Bot crossover → raw signal
2. Regime filter → approve/block
3. 4-Layer sync → classify (SYNC4 / COUNTER / LOCAL)
4. Risk model → lock SL/TP/entry prices
5. Confidence engine → compute `conf%`
6. f_format_alert() → build Super Payload string
7. strategy.entry() fires alert → TradeSgnl EA receives webhook
8. Glass Box builder → fires Telegram alert (parallel, same bar close)

---

## 3. Signal Generation — The ATM Bot Engine

**Source:** Section 7 of Pine Script (`buyEnabled`, `sellEnabled`, `trail_buy`, `trail_sell`)

### Buy Signal Logic

```
src_buy    = close
ema_buy    = EMA(close, 1)        // effectively = close
atr_buy    = ATR(c_buy)           // c_buy default = 2
nLoss_buy  = a_buy × atr_buy      // a_buy default = 3.5

trail_buy ratchet:
  if close > trail_buy[1] and close[1] > trail_buy[1]:
      trail_buy = max(trail_buy[1], close - nLoss_buy)   // bull: raise floor
  if close < trail_buy[1] and close[1] < trail_buy[1]:
      trail_buy = min(trail_buy[1], close + nLoss_buy)   // bear: compress ceiling

above_buy_cross = crossover(close, trail_buy)            // EMA crossed above trail
buy_signal_raw  = close > trail_buy AND above_buy_cross  // confirmed crossover
buy_signal      = buy_signal_raw AND barstate.isconfirmed
```

### Sell Signal Logic (mirror of buy)

```
trail_sell ratchet (inverted):
  bull market → trail_sell = max(trail_sell[1], close - nLoss_sell)
  bear market → trail_sell = min(trail_sell[1], close + nLoss_sell)

below_sell_cross = crossover(trail_sell, close)          // trail crossed above close
sell_signal_raw  = close < trail_sell AND below_sell_cross
sell_signal      = sell_signal_raw AND barstate.isconfirmed
```

**What "ATM Bot" means on the dashboard:**
- `ATM 🟢` = posState == 1 (long position state)
- `ATM 🔴` = posState == -1 (short position state)
- `ATM ⚪` = posState == 0 (flat)

---

## 4. Regime Filter Stack

**Source:** Section 7, variables `regimeBullish`, `regimeBearish`

The regime filter determines whether a raw ATM signal is allowed to proceed to execution.

```
bullishRegime = RSI momentum state == positive (RSI crossed above pmom=55)
bearishRegime = RSI momentum state == negative (RSI crossed below nmom=50)

if requireVWAP ON:
    regimeBullish = bullishRegime AND lastSwing == 1    (VWAP pointing up)
    regimeBearish = bearishRegime AND lastSwing == -1   (VWAP pointing down)

if requireFibTrend ON:
    regimeBullish = regimeBullish AND trend_fib == 1    (Fib EMA trending up)
    regimeBearish = regimeBearish AND trend_fib == -1   (Fib EMA trending down)

buy_signal_filtered  = buy_signal  AND regimeBullish
sell_signal_filtered = sell_signal AND regimeBearish
```

**Dashboard indicators:**
- `Regime 📈` = regimeBullish true
- `Regime 📉` = regimeBearish true
- `Regime ⚪` = neither
- `VWAP 📈/📉/⚪` = lastSwing direction from adaptive VWAP
- `Fib 📈/📉/⚪` = trend_fib from Fib EMA basis

**Blocked signals** → event type: `⛔ SIGNAL BLOCKED — REGIME FILTER`

---

## 5. 4-Layer Fractal State Machine

**Source:** Section 8 of Pine Script

```
Layer 1 — Sovereign (Daily):  request.security(syminfo.tickerid, "D",  posState)
Layer 2 — Anchor   (H4):     request.security(syminfo.tickerid, "60", posState)  ← default 1h
Layer 3 — Filter   (M15):    request.security(syminfo.tickerid, "15", posState)
Layer 4 — Exec     (1m):     posState  (current chart timeframe)
```

### Classification Logic

| Layers Aligned | Signal Type | Dashboard Label |
|---|---|---|
| All 4 = BULL | SYNC4 | 🔥 FULLY ALIGNED: BULLISH (4-LAYER) |
| All 4 = BEAR | SYNC4 | 🥶 FULLY ALIGNED: BEARISH (4-LAYER) |
| Sov=BEAR but buy signal | COUNTER | ⚠️ SOVEREIGN COUNTER-TREND LONG |
| Sov=BULL but sell signal | COUNTER | ⚠️ SOVEREIGN COUNTER-TREND SHORT |
| L3/L4 aligned but L2 not | LOCAL | L2 PULLBACK — Wait for Anchor Bull Flip |
| L2/L3 aligned but L4 not | LOCAL | L4 PULLBACK — Wait for Exec Bull Flip |

### Signal Classification in dpt_ arrays

```pine
_sig_type = master_sync_buy or master_sync_sell    ? "SYNC4"   :
            sovereign_counter_buy or counter_sell  ? "COUNTER" :
                                                     "LOCAL"
```

### Rules of Engagement by Type

| Type | TP Target | Note |
|---|---|---|
| SYNC4 | TP3 (2:1 R) | Full run. Trail with VWAP after TP3. |
| LOCAL | TP2 (1.5:1 R) | Moderate. Move to BE at TP1. |
| COUNTER | TP1 only (1:1 R) | Exit at TP1. Do NOT hold. |

---

## 6. Claw Confidence Engine

**Source:** Section 20.5 of Pine Script

A weighted 6-factor score computed independently of the 4-layer fractal. **NOT a hard gate** — advisory only. Displayed as `Confidence: XX% (need YY%)`.

### Factors and Weights

| Factor | Weight (default) | Bull condition | Bear condition |
|---|---|---|---|
| MTF Claw Trail | 1.5 | M15 + H1 claw both bullish | M15 + H1 claw both bearish |
| RSI Momentum | 1.0 | RSI state = positive | RSI state = negative |
| VWAP Direction | 1.0 | lastSwing == 1 | lastSwing == -1 |
| Fib Trend | 0.5 | trend_fib == 1 | trend_fib == -1 |
| Volume Profile | 0.5 | close > VAL | close < VAH |
| SMC Structure | 1.0 | swingTrend.bias == BULLISH | swingTrend.bias == BEARISH |

**Partial credit:** MTF Claw trail gets 40% weight if only one of M15/H1 is aligned.

```
claw_bull_conf = round((claw_bull_score / claw_bull_max) × 100) %
claw_bear_conf = round((claw_bear_score / claw_bear_max) × 100) %
```

### Threshold Modes

| Mode | Threshold |
|---|---|
| Conservative | 80% |
| Moderate | 60% |
| Aggressive | 40% |
| Custom | user-defined |

### Dashboard Output

```
Confidence: 54% bull (need 60%)   ← bull conf below threshold
Confidence: 72% bear (need 60%)   ← bear conf above threshold → PASS
```

The `conf` value is included in the Super Payload: `conf={{conf}}`

---

## 7. 5-Layer Scoring Engine

**Source:** Section 20 of Pine Script — `get_narrative_status()`, `n_score()`

Each timeframe layer is scored across 3 factors. Total range: -15 to +15.

### Per-Timeframe Status

```
get_narrative_status(tf):
  [r_str, v_str, f_str, ri_str]

  r_str  = regimeBullish(tf) ? "Long" : regimeBearish(tf) ? "Short" : "Neut"
  v_str  = lastSwing(tf) == 1 ? "Bull" : lastSwing(tf) == -1 ? "Bear" : "Neut"
  f_str  = trend_fib(tf) == 1 ? "Bull" : trend_fib(tf) == -1 ? "Bear" : "Neut"
  ri_str = rsi(tf) > 55 ? "Bull" : rsi(tf) < 45 ? "Bear" : "Neut"
```

### Scoring Function

```
n_score("Long" or "Bull") = +1.0
n_score("Short" or "Bear") = -1.0
n_score("Neut") = 0.0

layer_score = n_score(regime) + n_score(vwap) + n_score(fib)
              Range per layer: -3 to +3

total_score = D_score + H4_score + H1_score + M15_score + M5_score
              Range: -15 to +15
```

### Layer Icon Logic

| Score | Icon | Meaning |
|---|---|---|
| ≥ 2.5 | 🟢 | All 3 factors bull aligned |
| ≤ -2.5 | 🔴 | All 3 factors bear aligned |
| > 0 | 🟡 | Partial bull lean |
| < 0 | 🟠 | Partial bear lean |
| = 0 | ⚪ | Neutral |

### Master Bias Thresholds

| total_score | ATR state | master_bias |
|---|---|---|
| ≥ 10 | High | 🔥 SOVEREIGN HIGH MOMENTUM BULLISH |
| ≤ -10 | High | 🔥 SOVEREIGN HIGH MOMENTUM BEARISH |
| ≥ 6 | Any | 📈 BULLISH BIAS (Strong) |
| ≤ -6 | Any | 📉 BEARISH BIAS (Strong) |
| ≥ 3 | Any | 📈 BULLISH BIAS (Moderate) |
| ≤ -3 | Any | 📉 BEARISH BIAS (Moderate) |
| > 0 | Any | ⏳ QUIET BULL — WAIT |
| < 0 | Any | ⏳ QUIET BEAR — WAIT |
| = 0 | Any | ⚪ NEUTRAL — STAND ASIDE |

### Agent Advice Thresholds

| total_score | ai_advice |
|---|---|
| ≥ 10 | "Aggressive entry — 4-layer sovereign aligned." |
| ≥ 6 | "Confident entry — bias confirmed. Verify chart." |
| ≥ 3 | "Cautious entry — moderate alignment. Wait score > 6." |
| ≤ -10 | "Aggressive short — 4-layer sovereign aligned." |
| ≤ -6 | "Confident short — bearish bias confirmed." |
| ≤ -3 | "Cautious short — wait score < -6." |
| else | "Neutral. Stand aside. No edge present." |

---

## 8. Platinum Risk Model (SL/TP/Sizing)

**Source:** Section 14 of Pine Script

### SL Calculation (Long)

```pine
risk_swing_l = lowest(low, 5)    // 5-bar swing low
risk_atr     = ATR(14)

if low > ema21:
    sl_val = max(ema21, risk_swing_l) - (risk_atr × sl_buffer_atr)
else:
    sl_val = risk_swing_l - (risk_atr × sl_buffer_atr)

if sl_val >= close:              // failsafe: SL must be below entry
    sl_val = close - (risk_atr × 1.5)

risk_dist = close - sl_val
```

### SL Calculation (Short — mirror)

```pine
risk_swing_h = highest(high, 5)

if high < ema21:
    sl_val = min(ema21, risk_swing_h) + (risk_atr × sl_buffer_atr)
else:
    sl_val = risk_swing_h + (risk_atr × sl_buffer_atr)

if sl_val <= close:
    sl_val = close + (risk_atr × 1.5)

risk_dist = sl_val - close
```

### TP Calculation

```
TP1 = entry ± risk_dist × 1.0   (1:1 R)
TP2 = entry ± risk_dist × 1.5   (1.5:1 R)
TP3 = entry ± risk_dist × 2.0   (2:1 R)
```

### Pip Conversion (_pips function)

```pine
_pips(price_dist):
  pip_size = forex ? (JPY ? 0.01 : 0.0001) : syminfo.mintick × 10
  XAUUSD:  pip_size = 0.001 × 10 = 0.10
           → 12.21 pts ÷ 0.10 = 122.1 pips

pips_in_message = math.round(_pips(risk_dist))
```

### Super Payload Pip Values

```
locked_be_pips = round(_pips(risk_dist))          ← betrig: move BE when 1R in profit
locked_trdist  = round(_pips(risk_atr × 1.5))     ← trail distance: 1.5× ATR in pips
locked_trstep  = round(_pips(risk_atr × 0.5))     ← trail step: 0.5× ATR in pips
```

### Position Sizing (for reference — EA overrides with dollarrisk)

```pine
_get_position_size(sl_distance):
  notional = forex ? 100000 : crypto ? 1.0 : pointvalue
  size = risk_per_trade / (sl_distance × notional)

_risk_at_min_lot(sl_distance):
  min_unit = forex/crypto ? 0.01 : 1.0
  risk = sl_distance × min_unit × notional
```

---

## 9. Trade Progression Engine

**Source:** Section 16 of Pine Script

```
States: WAITING → ENTRY → TP1_HIT → TP2_HIT → TP3_HIT → HOLDER_MODE → CLOSED
```

### Phase Display Strings

| Pine state | Dashboard / Telegram display |
|---|---|
| "WAITING" | ⚪ SCANNING... |
| "ENTRY" | 🟡 ENTRY ACTIVE |
| "TP1_HIT" | 🎯 TP1 SECURED |
| "TP2_HIT" | 🎯🎯 TP2 — MOVE TO BE |
| "TP3_HIT" | 🚀 TP3 HIT — HOLDER MODE |
| "HOLDER_MODE" | 🔱 [Trail type] Trail: [price] |
| "SL_HIT" | 💀 STOP HIT |

### Hit Detection Logic

```
TP1 hit: not tp1_hit AND (long: high ≥ locked_tp1  / short: low ≤ locked_tp1)
TP2 hit: tp1_hit     AND (long: high ≥ locked_tp2  / short: low ≤ locked_tp2)
TP3 hit: tp2_hit     AND (long: high ≥ locked_tp3  / short: low ≤ locked_tp3)
SL hit:  not tp1_hit AND (long: low  ≤ locked_sl   / short: high ≥ locked_sl)

Holder exit (VWAP): crossunder(close, vap_current)   ← long
                    crossover(close, vap_current)    ← short
Holder exit (Structural): crossunder(close, holder_trail)  ← pivot low trail
```

### Partial Close Rules (Pine strategy → EA via pct)

| Event | Pine action | EA instruction in payload |
|---|---|---|
| TP1 | close 33.3% | pct1=0.33 |
| TP2 | close 50.0% | pct2=0.50 |
| TP3 | close 75.0% | exent=1 closes remaining |
| Exit | close 100% | closebuy / closesell |

---

## 10. Fire-and-Forget Super Payload

**Source:** Section 30 of Pine Script — `strategy.entry()` alert_message

### Confirmed Format (TradeSgnl EA)

```
LICENSE_ID,{{ticker}},{{action}},dollarrisk={{risk}},entry={{entry}},sl={{sl}},tp1={{tp1}},pct1=0.33,tp2={{tp2}},pct2=0.50,tp3={{tp3}},betrig={{betrig}},bedist={{bedist}},trtrig={{trtrig}},trdist={{trdist}},trstep={{trstep}},signal_type={{tag}},conf={{conf}},py
```

### Parameter Reference Table

| Parameter | Source in Pine | Example Value | Purpose |
|---|---|---|---|
| `LICENSE_ID` | hardcoded | `ADX-2026` | TradeSgnl license |
| `{{ticker}}` | `syminfo.ticker` | `XAUUSD` | Trading instrument |
| `{{action}}` | buy/sell | `buy` | Trade direction |
| `dollarrisk={{risk}}` | `risk_per_trade` | `dollarrisk=15` | EA calculates lot from $15 |
| `entry={{entry}}` | `locked_entry` (close) | `entry=4218.17` | Entry reference price |
| `sl={{sl}}` | `locked_sl` | `sl=4205.96` | Stop loss absolute price |
| `tp1={{tp1}}` | `locked_tp1` | `tp1=4230.38` | TP1 absolute price |
| `pct1=0.33` | hardcoded | `pct1=0.33` | Close 33% at TP1 |
| `tp2={{tp2}}` | `locked_tp2` | `tp2=4236.48` | TP2 absolute price |
| `pct2=0.50` | hardcoded | `pct2=0.50` | Close 50% at TP2 |
| `tp3={{tp3}}` | `locked_tp3` | `tp3=4242.59` | TP3 absolute price |
| `betrig={{betrig}}` | `locked_be_pips` = `round(_pips(risk_dist))` | `betrig=122` | Auto-BE after 122 pips profit |
| `bedist={{bedist}}` | `ts_be_buffer_pts` converted to pips | `bedist=5` | BE buffer: SL → entry + 5 pts |
| `trtrig={{trtrig}}` | hardcoded `2` | `trtrig=2` | Activate trail when TP2 closes |
| `trdist={{trdist}}` | `round(_pips(risk_atr × 1.5))` | `trdist=36` | Trail distance: 1.5× ATR pips |
| `trstep={{trstep}}` | `round(_pips(risk_atr × 0.5))` | `trstep=12` | Trail step: 0.5× ATR pips |
| `signal_type={{tag}}` | `_sig_type` = SYNC4/COUNTER/LOCAL | `signal_type=LOCAL` | Signal classification |
| `conf={{conf}}` | `claw_bull_conf` or `claw_bear_conf` | `conf=54` | Confidence percentage |
| `exent=1` | hardcoded | `exent=1` | Reverse/close on new opposite signal |
| `py` | hardcoded | `py` | Pyramiding mode enabled |

### Real Example (from screenshot trade)

```
ADX-2026,XAUUSD,buy,dollarrisk=15,entry=4218.17,sl=4205.96,tp1=4230.38,pct1=0.33,tp2=4236.48,pct2=0.50,tp3=4242.59,betrig=122,bedist=5,trtrig=2,trdist=36,trstep=12,signal_type=LOCAL,conf=54,exent=1,py
```

### EA Configuration Required

- **Parameter Source** = Signal Parameters (reads from webhook string)
- **Distance Unit** = Price (SL/TP sent as absolute prices)
- **Use Points Instead of Pips** = ON for XAUUSD/indices/CFDs

---

## 11. TS Automation — Belt-and-Suspenders

**Source:** Section 30 — BE/trail alert blocks after `long_exit_confirmed`

These fire **separate modify alerts** on TP1/TP2 events, confirming/overriding the Super Payload's auto-rules.

### TP1 → Breakeven Modify

```
Trigger: long_tp1_confirmed AND ts_be_on_tp1 ON

Long:  LICENSE_ID,XAUUSD,modifybuy,sl_price={{be_price}}
Short: LICENSE_ID,XAUUSD,modifysell,sl_price={{be_price}}

be_price (long)  = locked_entry + (ts_be_buffer_pts × mintick × 10)
be_price (short) = locked_entry - (ts_be_buffer_pts × mintick × 10)
```

### TP2 → Trailing Stop Modify

```
Trigger: long_tp2_confirmed AND ts_trail_on_tp2 ON

Long:  LICENSE_ID,XAUUSD,modifybuy,trail=1,trail_start={{trail_start}},trail_step={{trail_step}}
Short: LICENSE_ID,XAUUSD,modifysell,trail=1,trail_start={{trail_start}},trail_step={{trail_step}}

_atr_now    = ATR(14) at current bar
trail_start = _atr_now × 1.5   (price, not pips — uses f_alert_p formatting)
trail_step  = _atr_now × 0.5
```

---

## 12. Glass Box Event System

**Source:** Section 26 — `trigger_signal` evaluation and event_title building

### All Event Types

| event_title | Pine Trigger | Priority |
|---|---|---|
| 🔥 MASTER SYNC LONG — 4-LAYER ALIGNED | buy_signal_confirmed AND master_sync_buy | 1 (highest) |
| 🥶 MASTER SYNC SHORT — 4-LAYER ALIGNED | sell_signal_confirmed AND master_sync_sell | 1 |
| ⚠️ SOVEREIGN COUNTER-TREND LONG | buy_signal_confirmed AND sovereign_counter_buy | 2 |
| ⚠️ SOVEREIGN COUNTER-TREND SHORT | sell_signal_confirmed AND sovereign_counter_sell | 2 |
| 🟢 LONG SIGNAL CONFIRMED | buy_signal_confirmed (local) | 3 |
| 🔴 SHORT SIGNAL CONFIRMED | sell_signal_confirmed (local) | 3 |
| 🎯 TP1 HIT — PARTIAL SECURED (1:1) | tp1_alert_event | 4 |
| 🎯🎯 TP2 HIT — MOVE STOP TO BREAKEVEN (1.5:1) | tp2_alert_event | 4 |
| 🚀 TP3 HIT — HOLDER MODE ACTIVATED (2:1) | tp3_alert_event | 4 |
| 💀 STOP HIT — GLASS BOX AUTOPSY | sl_alert_event | 4 |
| 🏁 HOLDER MODE EXIT — VWAP CROSSED | holder_exit_event | 4 |
| ⛔ SIGNAL BLOCKED — REGIME FILTER | rejection_alert | 5 |
| ⚠️ BUY-SIDE LIQUIDITY SWEPT | crossover(close, ph_top) | 6 |
| ⚠️ SELL-SIDE LIQUIDITY SWEPT | crossunder(close, pl_btm) | 6 |
| 📈 BULLISH STRUCTURE SHIFT (BOS/CHoCH) | swingBullishBOS or CHoCH | 7 |
| 📉 BEARISH STRUCTURE SHIFT (BOS/CHoCH) | swingBearishBOS or CHoCH | 7 |
| 🕒 SESSION OPEN — ENVIRONMENTAL SCAN | vp_newSession | 8 |
| 🔇 ADMIN SILENCE — STANDING ASIDE | silence_mode AND vp_newSession | 9 |

---

## 13. War Room Telegram — Full Message Anatomy

**Source:** Section 26 — string variable `prem`

### Message Structure

```
━━━━━━━━━━━━━━━━━━━━━        ← _SEP constant
🔥 ABSOLUTE DOLLAR — WAR ROOM
Supreme Agent ADSA v8.0
━━━━━━━━━━━━━━━━━━━━━
📊 Asset   : {syminfo.ticker} | {timeframe.period}
💰 Price   : {_p(close)}
🌍 Session : {current_session}
📅 Daily   : {pdh_pdl_status}
📌 Context : {asset_context}          ← only if non-empty
─────────────────────        ← _SEP2 constant
🔔 EVENT: {event_title}
─────────────────────
📝 AGENT COMMENTARY
{event_commentary}
─────────────────────
🎯 TRADE PARAMETERS              ← only on entry signals
─────────────────────
Direction  : 🟢 LONG / 🔴 SHORT
Entry      : {locked_entry}
Stop Loss  : {locked_sl}  ({_pip_str(risk_dist)})
TP1 (1:1)  : {locked_tp1}  ({_pip_str})
TP2 (1.5:1): {locked_tp2}  ({_pip_str})
TP3 (2:1)  : {locked_tp3}  ({_pip_str})
Risk $     : ${risk_per_trade} → {size_display}
Min-unit risk: ~${locked_actual_risk}       ← if show_risk_info ON
Trade ID   : {atm_trade_id}
4-Layer    : {agent_sync_phase}
─────────────────────
🧠 GLASS BOX AI NARRATIVE
─────────────────────
Master Bias  : {effective_bias}
Score        : {total_score}/15
Daily Context: {pdh_pdl_status}
─────────────────────
5-LAYER TREE
 ├── D  (Sovereign) {icon}
 │    Regime :{sov_r} V.WAP :{sov_v} Fib Trend :{sov_f} RSI:{sov_ri}
 ├── H4 (Anchor) {icon}
 │    Regime :{h4_r}  V.WAP :{h4_v}  Fib Trend :{h4_f}  RSI:{h4_ri}
 ├── H1 {icon}
 │    Regime :{h1_r}  V.WAP :{h1_v}  Fib Trend :{h1_f}  RSI:{h1_ri}
 ├── M15 {icon}
 │    Regime :{m15_r} V.WAP :{m15_v} Fib Trend :{m15_f} RSI:{m15_ri}
 └── M5 {icon}
      Regime :{m5_r}  V.WAP :{m5_v}  Fib Trend :{m5_f}  RSI:{m5_ri}
─────────────────────
💡 AGENT ADVICE
{ai_advice}
PF: {pip_pf}  WR: {pip_win_rate}%
─────────────────────        ← only on admin commentary
💬 OPERATOR NOTE
{admin_commentary}
─────────────────────
🧊 LIQUIDITY
Buy-side  : {ph_top}
Sell-side : {pl_btm}
Context   : {liq_bias}
━━━━━━━━━━━━━━━━━━━━━
⚠️ Not financial advice. © 2026 Absolute Dollar
```

### Event Commentary by Event Type

| Event | commentary source |
|---|---|
| MASTER SYNC BUY | "All 4 layers BULLISH. Score: X/15 \| ATR: Y \| High-probability..." |
| COUNTER-TREND LONG | "⚠️ Daily is BEARISH. RULE: Target TP1 only. Do NOT hold to TP3." |
| LOCAL LONG | "Local alignment confirmed. Sovereign: {status} \| Score: X/15 \| {ai_advice}" |
| TP1 HIT | "Take 25–33% off. Tighten SL toward entry. Next target: TP2 at {locked_tp2}." |
| TP2 HIT | "Take 50% off. Move SL to entry: {locked_entry}. Position is now RISK-FREE." |
| TP3 HIT | "Close 75% at TP3 ({locked_tp3}). Trail 25% using Adaptive VWAP: {vap_current}." |
| SL HIT | "🔬 {sl_autopsy}. Peak before stop: {max_profit_pips} pips. Min-unit loss: ~${locked_actual_risk}." |
| HOLDER EXIT | "Direction: {dir}. VWAP Trail crossed: {vap_current}. Peak run: {max_profit_pips} pips." |
| BLOCKED | "LONG blocked. Sovereign: {status} \| Score: X/15 \| RSI/VWAP/Regime misaligned." |
| BUY-SIDE SWEEP | "Pool at {ph_top} swept. FALSE BREAK → Reversal long? BREAKOUT → Continuation?" |
| SESSION OPEN | "{session} \| ATR={atrHL} \| Score={total_score}/15 \| Sovereign={sovereignStatus}" |

### Mock War Room Message — LONG ENTRY (LOCAL)

```
━━━━━━━━━━━━━━━━━━━━━
🔥 ABSOLUTE DOLLAR — WAR ROOM
Supreme Agent ADSA v8.0
━━━━━━━━━━━━━━━━━━━━━
📊 Asset   : XAUUSD | 1
💰 Price   : 4218.17
🌍 Session : 👑 LONDON SESSION (12:xx EAT)
📅 Daily   : 🔼 Above PDH (4220.15)
📌 Context : GOLD — London breakout watch
─────────────────────
🔔 EVENT: 🟢 LONG SIGNAL CONFIRMED
─────────────────────
📝 AGENT COMMENTARY
Local alignment confirmed. Sovereign: BULL
Score: -2.0/15 | Neutral. Stand aside. No edge present.
─────────────────────
🎯 TRADE PARAMETERS
─────────────────────
Direction  : 🟢 LONG
Entry      : 4218.17
Stop Loss  : 4205.96  (122.1 pts)
TP1 (1:1)  : 4230.38  (122.1 pts)
TP2 (1.5:1): 4236.48  (183.2 pts)
TP3 (2:1)  : 4242.59  (244.2 pts)
Risk $     : $15 → 1.2287 Units
Min-unit risk: ~$12.21
Trade ID   : ATM-20260612-0424-BUY-01
4-Layer    : L2 PULLBACK — Wait for Anchor Bull Flip
─────────────────────
🧠 GLASS BOX AI NARRATIVE
─────────────────────
Master Bias  : ⏳ QUIET BEAR — WAIT
Score        : -2.0/15
Daily Context: 🔼 Above PDH (4220.15)
─────────────────────
5-LAYER TREE
 ├── D  (Sovereign) 🟠
 │    Regime :Neut V.WAP :Bear Fib Trend :Bear RSI:Bear
 ├── H4 (Anchor) 🔴
 │    Regime :Short V.WAP :Bear Fib Trend :Bear RSI:Neut
 ├── H1 ⚪
 │    Regime :Neut V.WAP :Bear Fib Trend :Bull RSI:Bull
 ├── M15 🟡
 │    Regime :Neut V.WAP :Bear Fib Trend :Bull RSI:Neut
 └── M5 🟢
      Regime :Long V.WAP :Bull Fib Trend :Bull RSI:Bull
─────────────────────
💡 AGENT ADVICE
Neutral. Stand aside. No edge present.
PF: 1.19  WR: 79.6%
─────────────────────
🧊 LIQUIDITY
Buy-side  : 4225.98
Sell-side : 4183.87
Context   : 🧲 NEAR SWING HIGH
━━━━━━━━━━━━━━━━━━━━━
⚠️ Not financial advice. © 2026 Absolute Dollar
```

### Mock War Room Message — STOP HIT

```
━━━━━━━━━━━━━━━━━━━━━
🔥 ABSOLUTE DOLLAR — WAR ROOM
Supreme Agent ADSA v8.0
━━━━━━━━━━━━━━━━━━━━━
📊 Asset   : XAUUSD | 1
💰 Price   : 4205.50
🌍 Session : 👑 LONDON SESSION (13:xx EAT)
📅 Daily   : 🔼 Above PDH (4220.15)
─────────────────────
🔔 EVENT: 💀 STOP HIT — GLASS BOX AUTOPSY
─────────────────────
📝 AGENT COMMENTARY
🔬 MACRO ROTATION: Higher-TF structure shifted post-entry.
Trade was structurally valid — context rotated against us.
Review session timing as a contributing factor.
Peak before stop: 78.1 pts
Min-unit loss est.: ~$12.21
Score at entry: -2.0/15
Every loss is data. Reassessing now.
─────────────────────
🧠 GLASS BOX AI NARRATIVE
Master Bias  : ⏳ QUIET BEAR — WAIT
Score        : -2.0/15
Daily Context: 🔼 Above PDH (4220.15)
[... 5-layer tree ...]
─────────────────────
🧊 LIQUIDITY
Buy-side  : 4225.98
Sell-side : 4183.87
Context   : 🧲 NEAR SWING HIGH
━━━━━━━━━━━━━━━━━━━━━
⚠️ Not financial advice. © 2026 Absolute Dollar
```

---

## 14. Dashboard Field Map

**Source:** Section 23 of Pine Script — `panelText` string

Every line in the dashboard mapped to its Pine Script origin.

### Header Block

| Dashboard line | Pine variable | Example |
|---|---|---|
| `🔐 AUTO \| Sovereign (D): BULL` | `admin_manual_bias`, `sovereign_tf`, `sovereignStatus` | `🔐 AUTO \| 👑 Sovereign (D): BULL` |
| `Score: -2/15` | `total_score` | sum of 5-layer n_score() |
| `Public: SANITIZED` | `tg_public_sanitize` | on/off toggle |
| `📌 [asset_context]` | `asset_context` input | "GOLD — London watch" |

### 4-Layer Sync Block

| Line | Source |
|---|---|
| `L1 Sovereign (D): BULL` | `sovereign_state == 1` |
| `L2 Anchor (60): BEAR` | `anchor_state == -1` |
| `L3 Filter (15): BEAR` | `filter_state == -1` |
| `L4 Exec (1): BEAR` | `exec_state == -1` |
| `🔄 L2 PULLBACK...` | `agent_sync_phase` string |

### Core Signals Block

| Line | Source |
|---|---|
| `XAUUSD \| 1 \| 4223.42` | `syminfo.ticker`, `timeframe.period`, `_p(close)` |
| `LONDON SESSION (12:xx EAT)` | `current_session` from UTC hour |
| `ATR: Med (2.37)` | `atrHL` ("High"/"Med"/"Low"), `atrN` |
| `Daily Context: Above PDH (4220.15)` | `pdh_pdl_status` |
| `Claw Trail: PARTIAL BULL` | `claw_dir_str` |
| `Confidence: 54% bull (need 60%)` | `claw_conf_str`, `claw_threshold` |
| `ATM 🟢` | `posState` |
| `Regime 📈` | `regimeBullish` |
| `VWAP 📈` | `lastSwing == 1` |
| `Fib 📈` | `trend_fib == 1` |
| `RSI (58)` | `rsi` value |
| `MACD: Bull/Bear` | `macdB` |

### 5-Layer AI Narrative Block

| Line | Source |
|---|---|
| `🧠 5-LAYER AI NARRATIVE [-2/15]` | `total_score` |
| `⏳ QUIET BEAR — WAIT` | `effective_bias` → `master_bias` |
| ` ├── D (Sovereign) 🟠` | `sov_score`, icon computed from score range |
| ` │    Regime:Neut V.WAP:Bear Fib Trend:Bear RSI:Bear` | `sov_r, sov_v, sov_f, sov_ri` from `get_narrative_status("D")` |
| [H4/H1/M15/M5 rows] | Same pattern per timeframe |

### Trade Setup Block

| Line | Source |
|---|---|
| `Phase: 🟡 ENTRY ACTIVE` | `trade_phase_display` |
| `ATM-20260612-0424-BUY-01` | `atm_trade_id` |
| `Dir: 🟢 LONG` | `trade_direction == 1` |
| `Min-Unit Risk: ~$12.21` | `_risk_at_min_lot(locked_risk_dist)` |
| `Variable: $15 → 1.2287 Units` | `risk_per_trade`, `_size_display(locked_position_size)` |
| `Live P&L: +$6.45 (+52.5 pts)` | `_live_pnl()`, live_pips_val |
| `Entry: 4218.17` | `locked_entry` |
| `SL: 4205.96 (122.1 pts)` | `locked_sl`, `_pip_str(locked_risk_dist)` |
| `TP1: 4230.38 ✅` | `locked_tp1`, `tp1_hit ? "✅" : ""` |
| `TP2/TP3 rows` | Same pattern |
| `Peak: 78.1 pts` | `max_profit_pips` |
| `🔱 VWAP Trail: 4221.xx` | `vap_current` when holder_mode_active |

### Today Block

| Line | Source |
|---|---|
| `Sigs: 90 Blocked: 23` | `dpt_total_sigs`, `dpt_rejected_cnt` |
| `LDN: 45 NY: 38` | `dpt_london_cnt`, `dpt_ny_cnt` |
| `TP1: 71 TP2: 45 TP3: 22 SL: 22` | `pip_tp1_hits`, `pip_tp2_hits`, `pip_tp3_hits`, `pip_losses` |
| `WR: 79.6%` | `pip_win_rate` |
| `PF: 1.19` | `pip_pf` = gross_win_pips / gross_loss_pips |
| `Net: +842.3 pts` | `pip_net` |

---

## 15. Performance Dashboard Metrics

**Source:** Section 21 (pip tracker), Section 22 (dpt arrays), Section 24 (perf table)

### Pip Tracker (Daily Reset)

```
pip_actual_tp1_sum   += |locked_tp1 - locked_entry| in pips  (on tp1 hit)
pip_exp_tp1_sum      += _pips(locked_risk_dist × 1.0)         (expected)

pip_actual_sl_sum    += |locked_sl - locked_entry| in pips    (on sl hit)
pip_gross_wins_pips  += tp1 pips + (tp2-tp1) pips + (tp3-tp2) pips
pip_gross_loss_pips  += sl pips

pip_win_rate  = wins / total_signals × 100
pip_pf        = gross_wins_pips / gross_loss_pips
pip_net       = gross_wins_pips - gross_loss_pips
```

### Performance Table Columns

| Column | Description |
|---|---|
| METRIC | TP1/TP2/TP3/SL/PF/WinRate/Net |
| UNIT | "pts" for XAUUSD, "pips" for forex |
| ACTUAL | Real avg pips captured |
| EXPECTED | Theoretical target pips (1R, 1.5R, 2R) |
| HITS | Count of occurrences |

### Key Composite Ratings

| PF | Rating |
|---|---|
| ≥ 2.5 | ELITE ✅ |
| ≥ 2.0 | STRONG ✅ |
| ≥ 1.5 | GOOD |
| ≥ 1.0 | MARGINAL ⚠️ |
| < 1.0 | NEGATIVE ❌ |
| 0 | NO DATA |

---

## 16. SL Autopsy Engine

**Source:** Section 25 — `_build_sl_autopsy()`

Fired only on `sl_alert_event`. Provides a transparent loss narrative.

| Condition checked | Autopsy verdict |
|---|---|
| `liq_bias` contains "BREAKING" | LIQUIDITY TRAP: Institutions swept stop for resting orders. |
| `atrHL == "Low"` | VOLATILITY COLLAPSE: ATR LOW — stop not wide enough for noise. |
| `sovereign_state == -1` AND `trade_direction == 1` | SOVEREIGN VETO: Daily BEARISH at entry. Counter-trend. TP1 only rule. |
| `sovereign_state == 1` AND `trade_direction == -1` | SOVEREIGN VETO: Daily BULLISH. TP1 only. |
| `abs(total_score) < 4` | WEAK 5-LAYER ALIGNMENT: Score below threshold at entry. |
| else | MACRO ROTATION: Context shifted post-entry. Review session timing. |

---

## 17. Rules of Engagement Summary

### Entry Rules

```
✅ EXECUTE when:
   - 4-Layer SYNC (all 4 aligned) → SYNC4 signal → full TP3 target
   - Score abs ≥ 6 → bias confirmed
   - Confidence ≥ threshold (default 60%)
   - ATR = Med or High (not Low)
   - Session = London or NY (not Asia)

⚠️ CAUTION when:
   - Signal type = LOCAL (only 1-2 layers aligned)
   - Score abs 3-5 → moderate alignment
   - Confidence 40-59%
   - Above PDH (longs) / Below PDL (shorts)
   - NEAR SWING HIGH/LOW in liquidity context

⛔ STAND ASIDE when:
   - Regime filter blocks signal → BLOCKED event
   - Score abs < 3 → NEUTRAL / QUIET
   - ATR = Low → thin conditions
   - Admin SILENCE mode active

🔄 COUNTER-TREND (TP1 only):
   - sovereign_counter_buy/sell = true
   - Sovereign opposes direction
   - Take profit at TP1, do NOT hold to TP3
   - Reduce size or skip
```

### Trade Management Rules (Embedded in Super Payload)

```
On TP1 hit (betrig pips reached):
  → EA auto-moves SL to breakeven + buffer (bedist pips)
  → TS Automation sends confirm modifybuy/sell

On TP2 hit (trtrig=2):
  → EA activates trailing stop
  → Trail distance: trdist pips (1.5× ATR)
  → Trail step: trstep pips (0.5× ATR)
  → TS Automation sends confirm trail modify

On TP3 hit:
  → Close 75% via pct2 split
  → Remaining 25% trails via VWAP (Holder Mode)
  → Dashboard shows 🔱 Holder Mode Trail: [price]

On SL hit:
  → Glass Box Autopsy fires
  → Telegram War Room sends full loss narrative
  → dpt_ performance arrays updated

On Holder Exit (VWAP cross):
  → 🏁 HOLDER MODE EXIT event fires
  → Remaining position closed
```

### Liquidity Context Rules

| `liq_bias` value | Meaning | Action |
|---|---|---|
| 💧 BREAKING SWING HIGH | Price above swing high pool | Longs: continuation. Shorts: failed sweep. |
| 💧 BREAKING SWING LOW | Price below swing low pool | Shorts: continuation. Longs: failed sweep. |
| 🧲 NEAR SWING HIGH | Close to sell-side pool | Longs: tight TP1. Shorts: possible magnet target. |
| 🧲 NEAR SWING LOW | Close to buy-side pool | Shorts: tight TP1. Longs: possible magnet target. |
| ⚪ Neutral | No immediate liquidity interaction | Standard R:R applies. |

---

## Appendix A — Trade ID Format

```
ATM-YYYYMMDD-HHMM-DIR-N

ATM-20260612-0424-BUY-01
     │        │    │   └── daily counter (01, 02...)
     │        │    └────── BUY or SELL
     │        └─────────── hour + minute at signal bar (EAT/local)
     └──────────────────── date
```

---

## Appendix B — Session Classification

| UTC Hour | Session | Dashboard label |
|---|---|---|
| 07:00–15:59 | London | 👑 LONDON SESSION (XX:xx EAT) |
| 13:00–21:59 | New York | 🗽 NY SESSION (XX:xx EAT) |
| Otherwise | Tokyo/Asia | 🗼 TOKYO/ASIA (XX:xx EAT) |

*(London/NY overlap 13:00–16:00 UTC shows as NY)*

---

## Appendix C — PDH/PDL Context Engine

```pine
[pdh_level, pdl_level] = request.security(syminfo.tickerid, "D", [high[1], low[1]])

pdh_pdl_status =
  close > pdh_level → "🔼 Above PDH (4220.15)"
  close < pdl_level → "🔽 Below PDL (4183.xx)"
  else              → "↔ Inside Range [PDH: 4220 | PDL: 4183]"
```

**Trading implication:**
- Above PDH = strong bull continuation OR over-extended (liquidity magnet cleared)
- Below PDL = strong bear continuation OR bear trap zone
- Inside Range = highest probability mean-reversion zone

---

*Document version: ADSA v8.0 — June 2026*
*© 2026 Absolute Dollar Intelligence | Not Financial Advice*
