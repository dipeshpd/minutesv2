import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  cancelRecallChat,
  clearClaudeApiKey,
  clearRecallChat,
  getClaudeSecretStatus,
  isDesktopApp,
  listenForRecallChat,
  saveClaudeApiKey,
  sendRecallChatMessage,
  type ClaudeSecretStatus,
  type CopilotStatus,
  type RecallChatChunk,
} from './backend'
import './assistant-surface.css'

type GuidanceKey = 'cover' | 'followUp' | 'attention'
type ChatMessage = {
  id: number
  role: 'user' | 'assistant'
  text: string
  error?: boolean
}

export type AssistantTab = {
  id: string
  label: string
}

export type ChatDraftSeed = {
  id: number
  text: string
}

type AssistantFrameProps = {
  title: string
  subtitle?: string
  status?: ReactNode
  leading?: ReactNode
  actions?: ReactNode
  tabs?: AssistantTab[]
  activeTab?: string
  onTabChange?: (tab: string) => void
  onClose: () => void
  dragRegion?: boolean
  className?: string
  children: ReactNode
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 6h12M8 3.5h4M6.5 6l.7 10h5.6l.7-10M8.5 9v4.5m3-4.5v4.5" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m3.5 10 12.8-6-4.5 12.5-2.2-5.1L3.5 10Z" />
      <path d="m9.6 11.4 3.4-3.2" />
    </svg>
  )
}

function StopIcon() {
  return <span className="assistant-stop-icon" aria-hidden="true" />
}

export function AssistantFrame({
  title,
  subtitle,
  status,
  leading,
  actions,
  tabs = [],
  activeTab,
  onTabChange,
  onClose,
  dragRegion = false,
  className = '',
  children,
}: AssistantFrameProps) {
  return (
    <section className={`assistant-frame ${className}`.trim()}>
      <header className="assistant-header" data-tauri-drag-region={dragRegion ? '' : undefined}>
        <div className="assistant-identity" data-tauri-drag-region={dragRegion ? '' : undefined}>
          {leading}
          <div className="assistant-title-copy" data-tauri-drag-region={dragRegion ? '' : undefined}>
            <strong data-tauri-drag-region={dragRegion ? '' : undefined}>{title}</strong>
            {subtitle ? <span data-tauri-drag-region={dragRegion ? '' : undefined}>{subtitle}</span> : null}
          </div>
        </div>
        {status ? <div className="assistant-status" data-tauri-drag-region={dragRegion ? '' : undefined}>{status}</div> : null}
        <div className="assistant-window-actions">
          {actions}
          <button
            type="button"
            className="assistant-icon-button"
            aria-label={`Close ${title}`}
            title={`Close ${title}`}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      {tabs.length > 0 ? (
        <div className="assistant-tabs" role="tablist" aria-label={`${title} views`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => onTabChange?.(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="assistant-body">{children}</div>
    </section>
  )
}

export function ClaudeSettingsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="assistant-settings-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <ClaudeSettings onClose={onClose} />
    </div>
  )
}

function ClaudeSettings({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<ClaudeSecretStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void getClaudeSecretStatus()
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch((nextError) => {
        if (!cancelled) setError(errorMessage(nextError))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const next = await saveClaudeApiKey(apiKey)
      setStatus(next)
      setApiKey('')
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    setError('')
    try {
      setStatus(await clearClaudeApiKey())
      setApiKey('')
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="assistant-settings" role="dialog" aria-modal="true" aria-labelledby="claude-settings-title">
      <div className="assistant-settings-header">
        <div>
          <span>Provider</span>
          <h2 id="claude-settings-title">Claude API</h2>
        </div>
        <button type="button" className="assistant-icon-button" aria-label="Close Claude settings" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <p className="assistant-settings-copy">
        When configured, questions and selected meeting context are sent to Anthropic. The key is stored in macOS Keychain and is never shown again.
      </p>
      <div className={`assistant-provider-status ${status?.keySet ? 'connected' : ''}`} role="status">
        <span aria-hidden="true" />
        {status?.message || 'Checking secure storage.'}
      </div>
      <form onSubmit={save}>
        <label htmlFor="claude-api-key">Anthropic API key</label>
        <input
          id="claude-api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          placeholder={status?.keySet ? 'Replace saved key' : 'sk-ant-...'}
          onChange={(event) => setApiKey(event.target.value)}
        />
        {error ? <p className="assistant-error" role="alert">{error}</p> : null}
        <div className="assistant-settings-actions">
          {status?.keySet ? (
            <button type="button" className="assistant-button secondary" disabled={busy} onClick={() => void clear()}>
              Remove key
            </button>
          ) : null}
          <button type="submit" className="assistant-button" disabled={busy || !apiKey.trim()}>
            {busy ? 'Saving' : 'Save securely'}
          </button>
        </div>
      </form>
      {!status?.keySet ? (
        <p className="assistant-provider-fallback">Without a key, Minutes keeps using your configured local provider or installed agent CLI.</p>
      ) : null}
    </section>
  )
}

function chunkText(chunk: RecallChatChunk, hasStreamedText: boolean) {
  if (chunk.type === 'text' && typeof chunk.text === 'string') return chunk.text

  if (chunk.type === 'stream_event') {
    const event = chunk.event
    if (
      event?.type === 'content_block_delta'
      && event.delta?.type === 'text_delta'
      && typeof event.delta.text === 'string'
    ) {
      return event.delta.text
    }
  }

  if (!hasStreamedText && chunk.type === 'assistant') {
    const content = chunk.message?.content
    if (Array.isArray(content)) {
      return content
        .map((block) => typeof block?.text === 'string' ? block.text : '')
        .join('')
    }
  }

  if (!hasStreamedText && chunk.type === 'result' && typeof chunk.result === 'string') {
    return chunk.result
  }

  return ''
}

export function AssistantChat({
  draftSeed,
  compact = false,
}: {
  draftSeed?: ChatDraftSeed | null
  compact?: boolean
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const nextMessageId = useRef(1)
  const assistantMessageId = useRef<number | null>(null)
  const streamedText = useRef(false)
  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (draftSeed?.text) setDraft(draftSeed.text)
  }, [draftSeed])

  useEffect(() => {
    let disposed = false
    let cleanup: () => void = () => undefined

    void listenForRecallChat({
      onChunk: (chunk) => {
        if (disposed) return
        const text = chunkText(chunk, streamedText.current)
        if (!text) return
        if (chunk.type === 'stream_event' || chunk.type === 'text') streamedText.current = true
        const id = assistantMessageId.current
        if (id === null) return
        setMessages((current) => current.map((message) => (
          message.id === id ? { ...message, text: message.text + text } : message
        )))
      },
      onError: (message) => {
        if (disposed) return
        setError(message)
        const id = assistantMessageId.current
        if (id !== null) {
          setMessages((current) => current.map((item) => (
            item.id === id && !item.text ? { ...item, text: message, error: true } : item
          )))
        }
      },
      onDone: () => {
        if (disposed) return
        setBusy(false)
        assistantMessageId.current = null
      },
    }).then((nextCleanup) => {
      if (disposed) nextCleanup()
      else cleanup = nextCleanup
    })

    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const message = draft.trim()
    if (!message || busy) return

    const userId = nextMessageId.current++
    const assistantId = nextMessageId.current++
    assistantMessageId.current = assistantId
    streamedText.current = false
    setMessages((current) => [
      ...current,
      { id: userId, role: 'user', text: message },
      { id: assistantId, role: 'assistant', text: '' },
    ])
    setDraft('')
    setError('')
    setBusy(true)

    try {
      await sendRecallChatMessage(message)
    } catch (nextError) {
      const messageText = errorMessage(nextError)
      setError(messageText)
      setBusy(false)
      setMessages((current) => current.map((item) => (
        item.id === assistantId ? { ...item, text: messageText, error: true } : item
      )))
      assistantMessageId.current = null
    }
  }

  const stop = async () => {
    try {
      await cancelRecallChat()
    } catch (nextError) {
      setError(errorMessage(nextError))
      setBusy(false)
    }
  }

  const reset = async () => {
    if (busy) await cancelRecallChat().catch(() => undefined)
    await clearRecallChat()
    setMessages([])
    setError('')
    setBusy(false)
    assistantMessageId.current = null
  }

  return (
    <section className={`assistant-chat ${compact ? 'compact' : ''}`} aria-label="Ask Claude about this meeting">
      <header className="assistant-chat-header">
        <div>
          <strong>Ask Claude</strong>
          <span>{isDesktopApp() ? 'Meeting-aware conversation' : 'Available in the desktop app'}</span>
        </div>
        {messages.length > 0 ? (
          <button type="button" className="assistant-icon-button" aria-label="Clear conversation" title="Clear conversation" onClick={() => void reset()}>
            <ClearIcon />
          </button>
        ) : null}
      </header>
      <div className="assistant-transcript" ref={transcriptRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="assistant-chat-empty">
            <strong>Ask about what is happening now.</strong>
            <span>Claude can use the focused meeting, relevant history, and current Helper context.</span>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`assistant-message ${message.role} ${message.error ? 'error' : ''}`}>
              <span>{message.role === 'user' ? 'You' : 'Claude'}</span>
              <p>{message.text || (busy && message.id === assistantMessageId.current ? 'Thinking…' : '')}</p>
            </div>
          ))
        )}
      </div>
      <form className="assistant-composer" onSubmit={submit}>
        <label htmlFor={`assistant-prompt-${compact ? 'compact' : 'full'}`} className="sr-only">Ask Claude</label>
        <textarea
          id={`assistant-prompt-${compact ? 'compact' : 'full'}`}
          rows={compact ? 1 : 2}
          value={draft}
          disabled={!isDesktopApp()}
          placeholder="Ask a question or test a point…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        {busy ? (
          <button type="button" className="assistant-send-button stop" aria-label="Stop response" title="Stop response" onClick={() => void stop()}>
            <StopIcon />
          </button>
        ) : (
          <button type="submit" className="assistant-send-button" disabled={!draft.trim() || !isDesktopApp()} aria-label="Send message" title="Send message">
            <SendIcon />
          </button>
        )}
      </form>
      {error ? <span className="assistant-inline-error" role="alert">{error}</span> : null}
    </section>
  )
}

const laneConfig: Record<GuidanceKey, { label: string; icon: string; empty: string; ask: string }> = {
  cover: {
    label: 'Points to cover',
    icon: '↑',
    empty: 'Add the outcome or question you need to cover.',
    ask: 'Help me prepare this point for the meeting: ',
  },
  followUp: {
    label: 'Follow up',
    icon: '?',
    empty: 'Capture an open question or promise to revisit.',
    ask: 'What should I ask or clarify about this follow-up: ',
  },
  attention: {
    label: 'Bring to attention',
    icon: '!',
    empty: 'Add a risk, contradiction, or decision that needs attention.',
    ask: 'Help me raise this clearly and constructively: ',
  },
}

export function GuidanceBoard({
  guidance,
  goal,
  currentNudge,
  onAsk,
  storageKey = 'minutes.homebase.helperGuidance',
}: {
  guidance?: CopilotStatus['guidance']
  goal?: string
  currentNudge?: string
  onAsk: (prompt: string) => void
  storageKey?: string
}) {
  const [collapsed, setCollapsed] = useState<Set<GuidanceKey>>(() => {
    try {
      const values = JSON.parse(localStorage.getItem(`${storageKey}.collapsed`) || '[]')
      return new Set(Array.isArray(values) ? values : [])
    } catch {
      return new Set()
    }
  })
  const [custom, setCustom] = useState<Record<GuidanceKey, string[]>>(() => {
    try {
      const values = JSON.parse(localStorage.getItem(`${storageKey}.items`) || '{}')
      return {
        cover: Array.isArray(values.cover) ? values.cover : [],
        followUp: Array.isArray(values.followUp) ? values.followUp : [],
        attention: Array.isArray(values.attention) ? values.attention : [],
      }
    } catch {
      return { cover: [], followUp: [], attention: [] }
    }
  })
  const [editing, setEditing] = useState<GuidanceKey | null>(null)
  const [draft, setDraft] = useState('')

  const generated = useMemo<Record<GuidanceKey, string[]>>(() => ({
    cover: guidance?.cover?.length ? guidance.cover : goal ? [goal] : [],
    followUp: guidance?.followUp ?? [],
    attention: guidance?.attention ?? [],
  }), [goal, guidance])

  const setLaneCollapsed = (lane: GuidanceKey, next: boolean) => {
    setCollapsed((current) => {
      const updated = new Set(current)
      if (next) updated.add(lane)
      else updated.delete(lane)
      localStorage.setItem(`${storageKey}.collapsed`, JSON.stringify([...updated]))
      return updated
    })
  }

  const addItem = (lane: GuidanceKey) => {
    const item = draft.trim()
    if (!item) return
    setCustom((current) => {
      const updated = { ...current, [lane]: [...current[lane], item] }
      localStorage.setItem(`${storageKey}.items`, JSON.stringify(updated))
      return updated
    })
    setDraft('')
    setEditing(null)
  }

  return (
    <section className="guidance-board" aria-label="Meeting guidance">
      {(Object.keys(laneConfig) as GuidanceKey[]).map((lane) => {
        const config = laneConfig[lane]
        const values = [...new Set([...generated[lane], ...custom[lane]])]
        const isCollapsed = collapsed.has(lane)
        return (
          <article key={lane} className={`guidance-lane ${lane} ${isCollapsed ? 'collapsed' : ''}`}>
            <header className="guidance-lane-header">
              <button
                type="button"
                className="guidance-lane-toggle"
                aria-expanded={!isCollapsed}
                onClick={() => setLaneCollapsed(lane, !isCollapsed)}
              >
                <span className="guidance-lane-icon" aria-hidden="true">{config.icon}</span>
                <span>{config.label}</span>
                <small>{values.length || ''}</small>
                <span className="guidance-chevron" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="guidance-add"
                aria-label={`Add to ${config.label}`}
                title={`Add to ${config.label}`}
                onClick={() => {
                  setLaneCollapsed(lane, false)
                  setEditing((current) => current === lane ? null : lane)
                  setDraft('')
                }}
              >
                +
              </button>
            </header>
            {!isCollapsed ? (
              <div className="guidance-lane-body">
                {values.length > 0 ? (
                  <ul>
                    {values.map((item) => (
                      <li key={item} className={item === currentNudge ? 'current' : ''}>
                        <span>{item}</span>
                        <button type="button" onClick={() => onAsk(`${config.ask}${item}`)}>Ask</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{config.empty}</p>
                )}
                {editing === lane ? (
                  <form
                    className="guidance-entry"
                    onSubmit={(event) => {
                      event.preventDefault()
                      addItem(lane)
                    }}
                  >
                    <input
                      value={draft}
                      maxLength={280}
                      autoFocus
                      placeholder={`Add to ${config.label.toLowerCase()}`}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <button type="submit" disabled={!draft.trim()}>Add</button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}
