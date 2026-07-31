import { StrictMode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  AssistantChat,
  AssistantFrame,
  GuidanceBoard,
  type ChatDraftSeed,
} from './AssistantSurface'
import {
  finishMeetingHelper,
  getCaptureStatus,
  getMeetingHelperStatus,
  pauseMeetingHelper,
  resumeMeetingHelper,
  setMeetingHelperCompact,
  type CopilotStatus,
  type RecordingStatus,
} from './backend'
import './copilot-hud.css'

type HudView = 'guide' | 'chat'

const defaultStatus: CopilotStatus = {
  active: false,
  paused: false,
  state: 'Arming',
  goal: '',
  detail: 'Loading local meeting context.',
}

const stateLabels: Record<string, string> = {
  off: 'Off',
  arming: 'Preparing',
  listening: 'Listening',
  thinking: 'Thinking',
  nudge: 'Guidance ready',
  paused: 'Paused',
  degraded: 'Limited',
}

const expandedSizeKey = 'minutes.homebase.coachExpandedSize'
const fullSizeThreshold = { width: 500, height: 420 }

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

function Grip() {
  return (
    <span className="hud-grip" aria-hidden="true" data-tauri-drag-region>
      <i /><i /><i /><i /><i /><i />
    </span>
  )
}

function CollapseIcon() {
  return <span className="hud-collapse-icon" aria-hidden="true" />
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 4H4v3.5M12.5 4H16v3.5M7.5 16H4v-3.5M12.5 16H16v-3.5" />
    </svg>
  )
}

function PauseIcon({ paused }: { paused: boolean }) {
  return paused ? (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m7 5 7 5-7 5V5Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 5v10M13 5v10" />
    </svg>
  )
}

function StopIcon() {
  return <span className="hud-stop-icon" aria-hidden="true" />
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </svg>
  )
}

function loadExpandedSize() {
  try {
    const stored = JSON.parse(localStorage.getItem(expandedSizeKey) || 'null')
    if (
      Number.isFinite(stored?.width)
      && Number.isFinite(stored?.height)
      && Number(stored.width) >= fullSizeThreshold.width
      && Number(stored.height) >= fullSizeThreshold.height
    ) {
      return { width: Number(stored.width), height: Number(stored.height) }
    }
  } catch {
    return null
  }
  return null
}

function currentWindow() {
  return window.__TAURI__?.window?.getCurrentWindow?.() ?? null
}

function MeetingHelperHud() {
  const [snapshot, setSnapshot] = useState<CopilotStatus>(defaultStatus)
  const [capture, setCapture] = useState<RecordingStatus | null>(null)
  const [view, setView] = useState<HudView>('guide')
  const [draftSeed, setDraftSeed] = useState<ChatDraftSeed | null>(null)
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [error, setError] = useState('')
  const [controlBusy, setControlBusy] = useState('')
  const draftId = useRef(1)
  const resizeTimer = useRef<number | null>(null)

  const normalizedState = String(snapshot.state || 'off').toLowerCase()
  const stateLabel = stateLabels[normalizedState] || 'Limited'
  const compact = viewport.height < 180
  const needsExpand = (
    viewport.width < fullSizeThreshold.width
    || viewport.height < fullSizeThreshold.height
  )
  const paused = snapshot.paused || normalizedState === 'paused'
  const recording = Boolean(capture?.recording || capture?.starting)
  const processing = Boolean(capture?.processing)

  const compactMeta = recording
    ? capture?.elapsed || 'Live'
    : processing
      ? capture?.processingStageLabel || 'Working'
      : stateLabel
  const compactState = paused
    ? ' is-paused'
    : recording
      ? ' is-recording'
      : processing || normalizedState === 'arming' || normalizedState === 'thinking'
        ? ' is-processing'
        : ''

  useEffect(() => {
    let disposed = false
    const unlisten: Array<() => void> = []
    const listen = window.__TAURI__?.event?.listen

    void getMeetingHelperStatus()
      .then((next) => {
        if (!disposed) setSnapshot(next)
      })
      .catch((nextError) => {
        if (!disposed) setError(errorMessage(nextError))
      })

    if (listen) {
      void listen('copilot:state', (event) => {
        if (!disposed) setSnapshot((event.payload || defaultStatus) as CopilotStatus)
      }).then((stop) => unlisten.push(stop))
      void listen('copilot:nudge', (event) => {
        if (!disposed) {
          setSnapshot((current) => ({
            ...current,
            state: 'Nudge',
            nudge: event.payload as CopilotStatus['nudge'],
          }))
        }
      }).then((stop) => unlisten.push(stop))
    }

    const refreshCapture = () => {
      void getCaptureStatus()
        .then((next) => {
          if (!disposed) setCapture(next)
        })
        .catch(() => {
          if (!disposed) setCapture(null)
        })
    }
    refreshCapture()
    const captureTimer = window.setInterval(refreshCapture, 1000)

    return () => {
      disposed = true
      window.clearInterval(captureTimer)
      unlisten.forEach((stop) => stop())
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      const nextViewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      }
      const nextCompact = window.innerHeight < 180
      setViewport(nextViewport)
      if (resizeTimer.current !== null) window.clearTimeout(resizeTimer.current)
      resizeTimer.current = window.setTimeout(() => {
        if (
          !nextCompact
          && nextViewport.width >= fullSizeThreshold.width
          && nextViewport.height >= fullSizeThreshold.height
        ) {
          localStorage.setItem(
            expandedSizeKey,
            JSON.stringify(nextViewport),
          )
        }
      }, 180)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (resizeTimer.current !== null) window.clearTimeout(resizeTimer.current)
    }
  }, [])

  useEffect(() => {
    const desktopWindow = currentWindow()
    if (!desktopWindow) return
    const startDrag = (event: MouseEvent) => {
      if (
        event.button !== 0
        || (event.target as HTMLElement).closest('button, a, input, textarea, [role="tab"]')
      ) {
        return
      }
      void desktopWindow.startDragging()
    }
    document.addEventListener('mousedown', startDrag)
    return () => document.removeEventListener('mousedown', startDrag)
  }, [])

  const collapse = async () => {
    if (
      !compact
      && window.innerWidth >= fullSizeThreshold.width
      && window.innerHeight >= fullSizeThreshold.height
    ) {
      localStorage.setItem(
        expandedSizeKey,
        JSON.stringify({ width: window.innerWidth, height: window.innerHeight }),
      )
    }
    try {
      await setMeetingHelperCompact(true)
    } catch (nextError) {
      setError(errorMessage(nextError))
    }
  }

  const expand = async () => {
    const stored = loadExpandedSize()
    try {
      await setMeetingHelperCompact(false, stored?.width, stored?.height)
    } catch (nextError) {
      setError(errorMessage(nextError))
    }
  }

  const close = () => {
    void currentWindow()?.close()
  }

  const togglePause = async () => {
    setControlBusy('pause')
    try {
      setSnapshot(await (paused ? resumeMeetingHelper() : pauseMeetingHelper()))
    } catch (nextError) {
      setError(errorMessage(nextError))
    } finally {
      setControlBusy('')
    }
  }

  const finish = async () => {
    setControlBusy('stop')
    try {
      await finishMeetingHelper()
      await currentWindow()?.close()
    } catch (nextError) {
      setError(errorMessage(nextError))
      setControlBusy('')
    }
  }

  const ask = (prompt: string) => {
    setDraftSeed({ id: draftId.current++, text: prompt })
    setView('chat')
  }

  const status = useMemo(() => (
    <>
      <span className={`hud-status-dot ${normalizedState}`} aria-hidden="true" />
      <span>{stateLabel}</span>
    </>
  ), [normalizedState, stateLabel])

  if (compact) {
    return (
      <main
        className={`hud-compact${snapshot.active ? ' is-active' : ''}${compactState}`}
        aria-label="Meeting Helper controls"
      >
        <button
          type="button"
          className="hud-compact-main"
          aria-label="Expand Meeting Helper"
          title="Expand Meeting Helper"
          onClick={() => void expand()}
        >
          <span className="hud-compact-dot" aria-hidden="true" />
          <span className="hud-compact-copy">
            <strong>Meeting Helper</strong>
            <small>{compactMeta}</small>
          </span>
        </button>
        <button
          type="button"
          className="assistant-icon-button hud-expand-button"
          onClick={() => void expand()}
          aria-label="Expand Meeting Helper"
          title="Expand Meeting Helper"
        >
          <ExpandIcon />
        </button>
        {snapshot.active ? (
          <>
            <button
              type="button"
              className="assistant-icon-button"
              disabled={Boolean(controlBusy)}
              aria-label={paused ? 'Resume meeting guidance' : 'Pause meeting guidance'}
              title={paused ? 'Resume meeting guidance' : 'Pause meeting guidance'}
              onClick={() => void togglePause()}
            >
              <PauseIcon paused={paused} />
            </button>
            <button
              type="button"
              className="assistant-icon-button hud-stop-button"
              disabled={Boolean(controlBusy)}
              aria-label="Stop Helper and open next steps"
              title="Stop Helper and open next steps"
              onClick={() => void finish()}
            >
              <StopIcon />
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="assistant-icon-button"
          aria-label="Close Meeting Helper window"
          title="Close Meeting Helper window"
          onClick={close}
        >
          <CloseIcon />
        </button>
      </main>
    )
  }

  return (
    <main className="hud-root" data-view={view}>
      <AssistantFrame
        title="Meeting Helper"
        subtitle="Private meeting context"
        status={status}
        dragRegion
        leading={(
          <>
            <Grip />
            <button
              type="button"
              className="assistant-icon-button hud-collapse-button"
              aria-label="Collapse Meeting Helper to recording pill"
              title="Collapse to recording pill"
              onClick={() => void collapse()}
            >
              <CollapseIcon />
            </button>
          </>
        )}
        actions={(
          <>
            {needsExpand ? (
              <button
                type="button"
                className="assistant-icon-button hud-expand-button"
                aria-label="Restore full Meeting Helper size"
                title="Restore full size"
                onClick={() => void expand()}
              >
                <ExpandIcon />
              </button>
            ) : null}
            <button
              type="button"
              className="assistant-icon-button"
              disabled={!snapshot.active || Boolean(controlBusy)}
              aria-label={paused ? 'Resume meeting guidance' : 'Pause meeting guidance'}
              title={paused ? 'Resume meeting guidance' : 'Pause meeting guidance'}
              onClick={() => void togglePause()}
            >
              <PauseIcon paused={paused} />
            </button>
            <button
              type="button"
              className="assistant-icon-button hud-stop-button"
              disabled={!snapshot.active || Boolean(controlBusy)}
              aria-label="Stop Helper and open next steps"
              title="Stop Helper and open next steps"
              onClick={() => void finish()}
            >
              <StopIcon />
            </button>
          </>
        )}
        tabs={[
          { id: 'guide', label: 'Guide' },
          { id: 'chat', label: 'Ask Claude' },
        ]}
        activeTab={view}
        onTabChange={(next) => setView(next as HudView)}
        onClose={close}
        className="hud-frame"
      >
        <div className="hud-workspace">
          <section className={`hud-pane guidance-pane ${view === 'guide' ? 'active' : ''}`}>
            <div className="hud-goal">
              <span>Goal</span>
              <p>{snapshot.goal || 'Leave with clear decisions, owners, and next steps.'}</p>
            </div>
            <GuidanceBoard
              guidance={snapshot.guidance}
              goal={snapshot.goal}
              currentNudge={snapshot.nudge?.text}
              onAsk={ask}
            />
            <footer className="hud-detail">
              <span className={snapshot.limitation ? 'limited' : ''} aria-hidden="true" />
              <p>{error || snapshot.limitation || snapshot.detail || 'Private, local meeting guidance.'}</p>
            </footer>
          </section>
          <section className={`hud-pane chat-pane ${view === 'chat' ? 'active' : ''}`}>
            <AssistantChat draftSeed={draftSeed} />
          </section>
        </div>
      </AssistantFrame>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MeetingHelperHud />
  </StrictMode>,
)
