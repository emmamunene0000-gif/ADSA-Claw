export function formatPrice(v: number): string {
  if (!v || isNaN(v)) return '—'
  const t = Math.abs(v)
  if (t >= 10000) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (t >= 100)   return v.toFixed(2)
  if (t >= 1)     return v.toFixed(4)
  return v.toFixed(5)
}

export function formatPips(entry: number, price: number, symbol: string): string {
  const dist = Math.abs(price - entry)
  if (!dist) return '—'
  if (['GBPJPY','EURJPY','USDJPY'].some(s => symbol.includes(s))) return (dist / 0.01).toFixed(1) + ' pips'
  if (['GBPUSD','EURUSD','NZDUSD','EURAUD','AUDUSD','USDCAD'].some(s => symbol.includes(s))) return (dist / 0.0001).toFixed(1) + ' pips'
  return dist.toFixed(2) + ' pts'
}

export function pfTag(pf: number): string {
  if (pf === 0)   return 'NO DATA'
  if (pf >= 2.5)  return 'ELITE ✅'
  if (pf >= 2.0)  return 'STRONG ✅'
  if (pf >= 1.5)  return 'GOOD'
  if (pf >= 1.0)  return 'MARGINAL ⚠️'
  return 'NEGATIVE ❌'
}

export function scoreColor(score: number): string {
  if (score >= 6)  return '#FFD700'
  if (score >= 3)  return '#00c9a7'
  if (score >= 0)  return '#f4a523'
  if (score >= -3) return '#6b6b8a'
  return '#ff4757'
}

export function layerIcon(score: number): string {
  if (score >= 2.5)  return '🟢'
  if (score <= -2.5) return '🔴'
  if (score > 0)     return '🟡'
  if (score < 0)     return '🟠'
  return '⚪'
}

export function eventColor(event_type: string): string {
  const et = event_type.toUpperCase()
  if (et.includes('LONG') || et.includes('SYNC BUY') || et.includes('BULL')) return '#00c9a7'
  if (et.includes('SHORT') || et.includes('SYNC SELL') || et.includes('BEAR')) return '#ff4757'
  if (et.includes('TP1') || et.includes('TP2') || et.includes('TP3')) return '#FFD700'
  if (et.includes('STOP HIT') || et.includes('AUTOPSY') || et.includes('SL')) return 'rgba(255,71,87,0.6)'
  if (et.includes('LIQUIDITY') || et.includes('SWEPT')) return '#f4a523'
  if (et.includes('BLOCKED') || et.includes('REJECT')) return 'rgba(244,165,35,0.6)'
  return '#1e1e3a'
}

export function eventBg(event_type: string): string {
  const et = event_type.toUpperCase()
  if (et.includes('LONG') || et.includes('SYNC BUY'))  return 'rgba(0,201,167,0.08)'
  if (et.includes('SHORT') || et.includes('SYNC SELL')) return 'rgba(255,71,87,0.08)'
  if (et.includes('TP')) return 'rgba(255,215,0,0.06)'
  if (et.includes('STOP HIT') || et.includes('AUTOPSY')) return 'rgba(255,71,87,0.06)'
  if (et.includes('COUNTER')) return 'rgba(255,215,0,0.06)'
  return 'transparent'
}

export function formatTime(iso: string, offsetHours = 3): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const utc = d.getTime() + d.getTimezoneOffset() * 60000
    const local = new Date(utc + offsetHours * 3600000)
    return local.toTimeString().slice(0, 8)
  } catch { return '' }
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }
  catch { return '' }
}
