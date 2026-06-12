import { useEffect, useRef, useCallback } from 'react'

type Handler = (data: unknown) => void

export function useSSE(url: string, handlers: Record<string, Handler>, onError?: () => void) {
  const esRef = useRef<EventSource | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close()

    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data)
        const handler = handlersRef.current[type]
        if (handler) handler(data)
      } catch (_) {}
    }

    es.onerror = () => {
      onError?.()
      es.close()
      esRef.current = null
      // reconnect after 3s
      setTimeout(connect, 3000)
    }
  }, [url, onError])

  useEffect(() => {
    connect()
    return () => { esRef.current?.close(); esRef.current = null }
  }, [connect])
}
