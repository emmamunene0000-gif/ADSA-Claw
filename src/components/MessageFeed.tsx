import { useState } from 'react'
import { GlassBoxMessage } from '../types'
import { eventColor, eventBg, formatTime } from '../utils/formatters'

interface Props {
  messages: GlassBoxMessage[]
}

const VERDICT_COLOR: Record<string, string> = {
  EXECUTE: '#00c9a7',
  CAUTION: '#f4a523',
  STAND_ASIDE: '#6b6b8a',
  COUNTER_TREND_ONLY: '#FFD700',
}

export default function MessageFeed({ messages }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const unread = messages.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0"
           style={{ borderBottom: '1px solid #1e1e3a' }}>
        <span className="font-sans text-xs font-semibold" style={{ color: '#e8e8f0', letterSpacing: '0.05em' }}>
          📱 WAR ROOM FEED
        </span>
        {unread > 0 && (
          <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(0,201,167,0.15)', color: '#00c9a7', border: '1px solid rgba(0,201,167,0.3)' }}>
            {unread}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: '#6b6b8a' }}>
            <div className="font-mono text-xs">Awaiting Glass Box alerts...</div>
            <div className="font-mono text-xs mt-1">Configure TradingView webhook →</div>
            <div className="font-mono text-xs mt-1" style={{ color: '#1e1e3a' }}>POST /webhook/message</div>
          </div>
        )}

        {messages.map((msg) => {
          const isOpen = expanded.has(msg.id)
          const borderColor = eventColor(msg.event_type)
          const bg = eventBg(msg.event_type)

          return (
            <div key={msg.id}
                 className="rounded cursor-pointer"
                 style={{ border: `1px solid ${borderColor}40`, borderLeft: `3px solid ${borderColor}`,
                          background: bg, animation: 'slide-in 200ms ease-out' }}
                 onClick={() => toggle(msg.id)}>

              {/* Card header */}
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-bold shrink-0"
                        style={{ color: borderColor, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg.event_type || 'EVENT'}
                  </span>
                  {msg.parsed?.score !== undefined && (
                    <span className="font-mono text-xs shrink-0"
                          style={{ color: msg.parsed.score >= 6 ? '#FFD700' : msg.parsed.score <= -6 ? '#ff4757' : '#6b6b8a' }}>
                      {msg.parsed.score}/15
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs" style={{ color: '#6b6b8a' }}>
                    {formatTime(msg.timestamp)} EAT
                  </span>
                  <span style={{ color: '#6b6b8a', fontSize: 10 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Claude analysis strip (always visible if present) */}
              {msg.claude_analysis && (
                <div className="mx-2 mb-1.5 px-2 py-1 rounded"
                     style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-sans text-xs font-semibold" style={{ color: '#FFD700' }}>⚡ CLAUDE</span>
                    <span className="font-mono text-xs px-1 rounded"
                          style={{ color: VERDICT_COLOR[msg.claude_analysis.verdict] || '#6b6b8a',
                                   background: (VERDICT_COLOR[msg.claude_analysis.verdict] || '#6b6b8a') + '20' }}>
                      {msg.claude_analysis.verdict}
                    </span>
                    <span className="font-mono text-xs" style={{ color: '#6b6b8a' }}>
                      {msg.claude_analysis.max_tp} | {msg.claude_analysis.confidence}%
                    </span>
                  </div>
                  <div className="font-mono text-xs" style={{ color: '#e8e8f0' }}>
                    {msg.claude_analysis.edge_note}
                  </div>
                </div>
              )}

              {/* Full message */}
              {isOpen && (
                <div className="px-2 pb-2">
                  <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
                       style={{ color: '#e8e8f0', fontSize: 10, maxHeight: 400, overflowY: 'auto' }}>
                    {msg.content}
                  </pre>
                </div>
              )}

              {/* Collapsed preview (symbol + direction hint) */}
              {!isOpen && msg.parsed?.symbol && (
                <div className="px-2 pb-1.5 font-mono text-xs" style={{ color: '#6b6b8a' }}>
                  {msg.parsed.symbol}
                  {msg.parsed.direction && (
                    <span style={{ color: msg.parsed.direction === 'LONG' ? '#00c9a7' : '#ff4757' }}>
                      {' '}{msg.parsed.direction}
                    </span>
                  )}
                  {msg.parsed.entry && <span> @ {msg.parsed.entry}</span>}
                  {msg.parsed.price && !msg.parsed.entry && <span> @ {msg.parsed.price}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
