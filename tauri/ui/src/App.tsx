/*
THESIS: Minutes Homebase opens on the conversation day, not a dashboard; it refuses the SaaS grid of metrics and cards.
OWN-WORLD: Dark graphite desktop shell, compact left rail, soft row surfaces, pale type, cyan relationship strokes, and restrained coral state markers.
STORY: The user sees what is coming, what was discussed, what is owed, and how people and initiatives connect.
FIRST VIEWPORT: Left navigation is fixed; the center column mirrors the provided Granola-like "Coming up" list; capture is always within reach.
FORM: Established app-shell extension with Galileo-style bipartite graph architecture, clean-room implementation, no AGPL source copied.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-2d'
import {
  addRecordingNote,
  downloadSpeechModel,
  getCaptureStatus,
  getMeetingDetail,
  getMeetingHelperStatus,
  getMicrophonePermission,
  isDesktopApp,
  listenForHelperNextSteps,
  loadHomebaseData,
  markActivationNudgeShown,
  markCoachOnboardingSeen,
  openMeetingFile,
  openParakeetGuide,
  openSystemSettings,
  pauseMeetingHelper,
  resumeMeetingHelper,
  searchLocalMemory,
  setupCoachModel,
  showMeetingHelper,
  startMeetingHelper,
  startRecording,
  stopMeetingHelper,
  stopRecording,
  switchToWhisper,
  type BackendMeetingDetail,
  type CoachSettings,
  type CopilotStatus,
  type HomebaseData,
  type MicrophonePermission,
  type RecordingStartOptions,
  type RecordingStatus,
  type SearchHit,
  type SetupState,
} from './backend'
import { buildMinutesGraph, type MinutesGraphLink, type MinutesGraphNode } from './graph'
import {
  meetings as mockMeetings,
  navItems,
  todos as mockTodos,
  upcoming as mockUpcoming,
  type Meeting,
  type NavId,
  type Todo,
  type UpcomingItem,
} from './data'

type GraphNode = MinutesGraphNode & NodeObject
type GraphLink = MinutesGraphLink & {
  source: string | GraphNode
  target: string | GraphNode
}
type NavMode = 'expanded' | 'rail' | 'hidden'
type MapLens = 'all' | 'person' | 'initiative'
type CapturePanelKind = 'note' | 'todo'

const emptyRecordingStatus: RecordingStatus = {
  recording: false,
  starting: false,
  processing: false,
  elapsed: null,
  audioLevel: 0,
}

const emptyCopilotStatus: CopilotStatus = {
  active: false,
  paused: false,
  state: 'Off',
  goal: '',
  detail: 'Coach is off.',
}

const initials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

function Icon({ name }: { name: NavId }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="nav-icon">
      {name === 'meetings' ? (
        <>
          <path d="M5.5 3.5h9a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15V5a1.5 1.5 0 0 1 1.5-1.5Z" />
          <path d="M7 2.5v3M13 2.5v3M4 7h12" />
        </>
      ) : name === 'todos' ? (
        <>
          <path d="m5 10 3 3 7-7" />
          <path d="M4.5 4.5h11v11h-11z" />
        </>
      ) : name === 'initiatives' ? (
        <>
          <path d="M4 15.5V4.5h12" />
          <path d="M4 8.5h10M4 12.5h7" />
        </>
      ) : name === 'map' ? (
        <>
          <circle cx="5" cy="10" r="2.3" />
          <circle cx="15" cy="5" r="2.3" />
          <circle cx="15" cy="15" r="2.3" />
          <path d="M7 9 13 6M7 11l6 3" />
        </>
      ) : (
        <>
          <path d="M4.5 13.5c2.2 2.2 8.8 2.2 11 0" />
          <path d="M5 11V8a5 5 0 0 1 10 0v3" />
          <path d="M8 16h4" />
        </>
      )}
    </svg>
  )
}

function SidebarModeIcon({ action }: { action: 'expand' | 'rail' | 'hide' }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {action === 'expand' ? (
        <>
          <path d="M4.5 4.5h11v11h-11z" />
          <path d="M8 4.5v11M10.5 10h3M12 8.5l1.5 1.5-1.5 1.5" />
        </>
      ) : action === 'rail' ? (
        <>
          <path d="M4.5 4.5h11v11h-11z" />
          <path d="M8 4.5v11M13.5 8.5 12 10l1.5 1.5" />
        </>
      ) : (
        <>
          <path d="M5 5h10v10H5z" />
          <path d="M7.5 7.5 12.5 12.5M12.5 7.5 7.5 12.5" />
        </>
      )}
    </svg>
  )
}

function RecordIcon({ stop = false }: { stop?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {stop ? <rect x="6" y="6" width="8" height="8" rx="1.5" /> : <circle cx="10" cy="10" r="5" />}
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  )
}

function InspectorToggleIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`inspector-toggle-icon${expanded ? ' expanded' : ''}`}
    >
      <path d="m7.5 5.5 4.5 4.5-4.5 4.5" />
    </svg>
  )
}

function Sidebar({
  current,
  onChange,
  source,
  navMode,
  onModeChange,
}: {
  current: NavId
  onChange: (id: NavId) => void
  source: HomebaseData['source']
  navMode: NavMode
  onModeChange: (mode: NavMode) => void
}) {
  const compact = navMode === 'rail'

  return (
    <aside className="sidebar">
      <div className="traffic">
        <div className="traffic-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="sidebar-window-actions" aria-label="Sidebar display">
          <button
            type="button"
            className="window-control"
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar to icons'}
            title={compact ? 'Expand sidebar' : 'Collapse sidebar to icons'}
            onClick={() => onModeChange(compact ? 'expanded' : 'rail')}
          >
            <SidebarModeIcon action={compact ? 'expand' : 'rail'} />
          </button>
          <button
            type="button"
            className="window-control"
            aria-label="Hide sidebar"
            title="Hide sidebar"
            onClick={() => onModeChange('hidden')}
          >
            <SidebarModeIcon action="hide" />
          </button>
        </div>
      </div>
      <div className="brand">
        <div className="brand-mark">M</div>
        <div>
          <div className="brand-name">Minutes</div>
          <div className="brand-subtitle">Local memory</div>
        </div>
      </div>
      <nav className="nav" aria-label="Primary">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={current === item.id ? 'nav-item active' : 'nav-item'}
            onClick={() => onChange(item.id)}
            aria-current={current === item.id ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
          >
            <Icon name={item.id} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className={source === 'backend' ? 'status-dot' : 'status-dot preview'} />
        <span>{source === 'backend' ? 'Connected to Minutes' : 'Desktop backend offline'}</span>
      </div>
    </aside>
  )
}

function TopActions({
  capture,
  busy,
  onStart,
  onStop,
  onNote,
}: {
  capture: RecordingStatus
  busy: string | null
  onStart: () => Promise<void>
  onStop: () => Promise<void>
  onNote: () => void
}) {
  const recording = capture.recording
  const blocked = capture.starting || capture.processing || Boolean(busy)
  const label = recording
    ? `Stop ${capture.elapsed || 'recording'}`
    : capture.starting
      ? 'Starting'
      : capture.processing
        ? 'Processing'
        : 'Record meeting'

  return (
    <div className="top-actions">
      <button
        type="button"
        className={recording ? 'capture-button recording' : 'capture-button'}
        disabled={!recording && blocked}
        onClick={() => {
          void (recording ? onStop() : onStart()).catch(() => undefined)
        }}
      >
        <RecordIcon stop={recording} />
        <span>{busy === 'stop' ? 'Stopping' : label}</span>
      </button>
      <button type="button" className="pill-button secondary" onClick={onNote}>
        Add note
      </button>
    </div>
  )
}

function UpcomingPanel({ items }: { items: UpcomingItem[] }) {
  if (items.length === 0) {
    return <div className="empty-state">No calendar events in the next two hours.</div>
  }

  return (
    <section className="upcoming-panel" aria-label="Coming up">
      {items.map((item, index) => (
        <div className="upcoming-row" key={`${item.date}-${item.title}-${index}`}>
          <div className="date-block">
            <div className="date-number">{item.date}</div>
            <div>
              <div className="date-month">{item.month}</div>
              <div className="date-weekday">{item.weekday}</div>
            </div>
          </div>
          <div className={item.empty ? 'event-line empty' : 'event-line'} />
          <div className="event-copy">
            <div className={item.empty ? 'event-title muted' : 'event-title'}>{item.title}</div>
            {item.time ? <div className="event-time">{item.time}</div> : null}
          </div>
        </div>
      ))}
    </section>
  )
}

function MeetingAvatar({ meeting }: { meeting: Meeting }) {
  const label = meeting.people[0] ?? meeting.title
  return <div className="avatar" aria-hidden="true">{initials(label)}</div>
}

function MeetingList({
  meetings,
  onOpen,
}: {
  meetings: Meeting[]
  onOpen: (meeting: Meeting) => void
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Meeting[]>()
    for (const meeting of meetings) {
      const bucket = map.get(meeting.day) ?? []
      bucket.push(meeting)
      map.set(meeting.day, bucket)
    }
    return [...map.entries()]
  }, [meetings])

  if (meetings.length === 0) {
    return <div className="empty-state">Your first completed recording will appear here.</div>
  }

  return (
    <div className="meeting-groups">
      {groups.map(([day, rows]) => (
        <section key={day} className="meeting-group" aria-labelledby={`day-${day.replace(/\W+/g, '-')}`}>
          <h2 id={`day-${day.replace(/\W+/g, '-')}`}>{day}</h2>
          <div className="meeting-list">
            {rows.map((meeting) => (
              <button
                type="button"
                className="meeting-row"
                key={meeting.id}
                onClick={() => onOpen(meeting)}
                aria-label={`Open ${meeting.title}`}
              >
                <MeetingAvatar meeting={meeting} />
                <span className="meeting-main">
                  <span className="meeting-title">{meeting.title}</span>
                  <span className="meeting-meta">{meeting.people.join(', ')}</span>
                </span>
                <span className="meeting-time">{meeting.time}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const stepClass = (done: boolean, active: boolean) =>
  ['setup-step', done ? 'done' : '', active ? 'active' : 'locked'].filter(Boolean).join(' ')

function ActivationPanel({
  setup,
  source,
  capture,
  onRefresh,
  onStart,
  onStop,
}: {
  setup?: SetupState | null
  source: HomebaseData['source']
  capture: RecordingStatus
  onRefresh: () => Promise<void>
  onStart: (options?: RecordingStartOptions) => Promise<void>
  onStop: () => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const activation = setup?.activation
  const milestones = activation?.milestones ?? {}
  const engine = setup?.batch_transcription?.resolved_backend || setup?.engine || 'whisper'
  const isParakeet = engine === 'parakeet'
  const hasModel = Boolean(setup?.hasModel || activation?.hasModel || milestones.modelReadyAt)
  const hasStarted = Boolean(milestones.firstRecordingStartedAt)
  const hasArtifact = Boolean(activation?.hasSavedArtifact || milestones.firstArtifactSavedAt)
  const recording = capture.recording || activation?.phase === 'recording-first-artifact'
  const processing = capture.processing || activation?.phase === 'processing-first-artifact'
  const showPanel = source === 'mock' || !activation || activation.phase !== 'activated'

  useEffect(() => {
    if (showPanel) markActivationNudgeShown()
  }, [showPanel])

  if (!showPanel) return null

  const run = async (name: string, action: () => Promise<unknown>, success: string) => {
    setBusy(name)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      await onRefresh()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const handleTestRecording = async () => {
    setBusy('record')
    setError('')
    try {
      await onStart({ title: 'Minutes test recording' })
      setMessage('Recording started. Speak for ten seconds, then stop.')
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="activation-panel" aria-label="Minutes setup">
      <div className="activation-intro">
        <span className="activation-kicker">First run</span>
        <h2>Make Minutes useful with one local recording.</h2>
        <p>Set up the speech engine once, capture a short test, and the meeting list becomes your real local archive.</p>
      </div>
      <div className="setup-steps">
        <article className={stepClass(hasModel, !hasModel)}>
          <div className="setup-step-head">
            <span className="setup-number">1</span>
            <div>
              <h3>{isParakeet ? 'Set up Parakeet locally' : 'Download speech model'}</h3>
              <p>{hasModel ? 'Speech is ready on this Mac.' : 'Minutes needs a local speech model before it can transcribe.'}</p>
            </div>
            <span className="setup-status">{hasModel ? 'Done' : isParakeet ? 'Needs setup' : 'Required'}</span>
          </div>
          {!hasModel ? (
            <div className="setup-actions">
              {isParakeet ? (
                <>
                  <button
                    type="button"
                    className="pill-button"
                    disabled={Boolean(busy)}
                    onClick={() => run('parakeet', () => openParakeetGuide(setup), 'Opened Parakeet setup.')}
                  >
                    Open guide
                  </button>
                  <button
                    type="button"
                    className="pill-button secondary"
                    disabled={Boolean(busy)}
                    onClick={() => run('whisper', switchToWhisper, 'Switched to Whisper.')}
                  >
                    Use Whisper
                  </button>
                </>
              ) : (
                <>
                  {['tiny', 'base', 'small'].map((model) => (
                    <button
                      type="button"
                      className={model === 'base' ? 'pill-button' : 'pill-button secondary'}
                      disabled={Boolean(busy)}
                      key={model}
                      onClick={() => run(model, () => downloadSpeechModel(model), `${model} model ready.`)}
                    >
                      {busy === model ? 'Downloading' : model === 'tiny' ? 'Tiny' : model === 'base' ? 'Base' : 'Small'}
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : null}
          {setup?.parakeet?.issues?.length && !hasModel ? (
            <div className="setup-note">{setup.parakeet.issues.slice(0, 2).join(' ')}</div>
          ) : null}
        </article>

        <article className={stepClass(hasStarted || hasArtifact, hasModel && !hasArtifact)}>
          <div className="setup-step-head">
            <span className="setup-number">2</span>
            <div>
              <h3>Create your first artifact</h3>
              <p>Make a quick ten-second recording. One sentence is enough.</p>
            </div>
            <span className="setup-status">{hasArtifact ? 'Done' : recording ? 'Recording' : hasStarted ? 'Started' : 'Next'}</span>
          </div>
          {!hasArtifact ? (
            <div className="setup-actions">
              {recording ? (
                <button
                  type="button"
                  className="pill-button danger"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    void onStop().catch((error) => setError(errorMessage(error)))
                  }}
                >
                  Stop test
                </button>
              ) : (
                <button
                  type="button"
                  className="pill-button"
                  disabled={!hasModel || Boolean(busy) || processing}
                  onClick={handleTestRecording}
                >
                  {busy === 'record' ? 'Starting' : processing ? 'Processing' : 'Record test'}
                </button>
              )}
            </div>
          ) : null}
        </article>

        <article className={stepClass(hasArtifact, hasStarted || recording || processing || hasArtifact)}>
          <div className="setup-step-head">
            <span className="setup-number">3</span>
            <div>
              <h3>Watch it appear here</h3>
              <p>Minutes saves the local audio, transcribes it, and adds the markdown artifact to this list.</p>
            </div>
            <span className="setup-status">{hasArtifact ? 'Saved' : processing ? 'Processing' : recording ? 'Recording' : 'Waiting'}</span>
          </div>
        </article>
      </div>
      <div className="setup-feedback" aria-live="polite">
        {message ? <div className="setup-message">{message}</div> : null}
        {error ? <div className="setup-error">{error}</div> : null}
      </div>
    </section>
  )
}

function MeetingsHome({
  meetings,
  upcoming,
  setup,
  source,
  error,
  capture,
  captureBusy,
  onRefresh,
  onStart,
  onStop,
  onNote,
  onOpenMeeting,
  microphone,
  onOpenMicrophoneSettings,
  onRefreshMicrophone,
}: {
  meetings: Meeting[]
  upcoming: UpcomingItem[]
  setup?: SetupState | null
  source: HomebaseData['source']
  error?: string
  capture: RecordingStatus
  captureBusy: string | null
  onRefresh: () => Promise<void>
  onStart: (options?: RecordingStartOptions) => Promise<void>
  onStop: () => Promise<void>
  onNote: () => void
  onOpenMeeting: (meeting: Meeting) => void
  microphone: MicrophonePermission | null
  onOpenMicrophoneSettings: () => Promise<void>
  onRefreshMicrophone: () => Promise<void>
}) {
  return (
    <main className="main-content">
      <header className="content-header">
        <div>
          <h1>Coming up</h1>
          <p className="header-subtitle">Calendar in the next two hours and your recent local meetings.</p>
        </div>
        <TopActions
          capture={capture}
          busy={captureBusy}
          onStart={() => onStart()}
          onStop={onStop}
          onNote={onNote}
        />
      </header>
      {error ? (
        <div className="inline-warning">
          Desktop backend unavailable. Open the native Minutes Homebase app to record and use local data.
        </div>
      ) : null}
      {microphone && !microphone.runtimeUsable ? (
        <section className="permission-notice" aria-label="Microphone permission">
          <div>
            <strong>Microphone access is not ready</strong>
            <span>{microphone.detail} Recordings may contain silence until macOS grants this app access.</span>
          </div>
          <div className="permission-actions">
            {microphone.settingsUrl ? (
              <button type="button" className="pill-button" onClick={onOpenMicrophoneSettings}>
                Open System Settings
              </button>
            ) : null}
            <button type="button" className="pill-button secondary" onClick={onRefreshMicrophone}>
              Check again
            </button>
          </div>
        </section>
      ) : null}
      <ActivationPanel
        setup={setup}
        source={source}
        capture={capture}
        onRefresh={onRefresh}
        onStart={onStart}
        onStop={onStop}
      />
      <UpcomingPanel items={upcoming} />
      <MeetingList meetings={meetings} onOpen={onOpenMeeting} />
    </main>
  )
}

function TodoView({
  todos,
  onCapture,
  onOpen,
}: {
  todos: Todo[]
  onCapture: () => void
  onOpen: (todo: Todo) => void
}) {
  return (
    <main className="main-content narrow">
      <header className="content-header">
        <div>
          <h1>To-do</h1>
          <p className="header-subtitle">Open action items extracted from your local meeting artifacts.</p>
        </div>
        <button type="button" className="pill-button" onClick={onCapture}>Capture item</button>
      </header>
      {todos.length === 0 ? (
        <div className="empty-state">No open action items found. Capture one during a recording.</div>
      ) : (
        <div className="todo-list">
          {todos.map((todo) => (
            <button
              type="button"
              className="todo-row"
              key={todo.id}
              onClick={() => onOpen(todo)}
              aria-label={`Open source for ${todo.label}`}
            >
              <span className="checkbox" aria-hidden="true" />
              <span className="todo-copy">
                <span>{todo.label}</span>
                <span>{todo.initiative} - {todo.owner}</span>
              </span>
              <span className="todo-due">{todo.due}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

function InitiativesView({
  meetings,
  onOpen,
}: {
  meetings: Meeting[]
  onOpen: (initiative: string) => void
}) {
  const initiativeRows = useMemo(() => {
    const map = new Map<string, { meetings: number; people: Set<string> }>()
    for (const meeting of meetings) {
      for (const initiative of meeting.initiatives) {
        const entry = map.get(initiative) ?? { meetings: 0, people: new Set<string>() }
        entry.meetings += 1
        meeting.people.forEach((person) => entry.people.add(person))
        map.set(initiative, entry)
      }
    }
    return [...map.entries()].sort((a, b) => b[1].meetings - a[1].meetings)
  }, [meetings])

  return (
    <main className="main-content narrow">
      <header className="content-header">
        <div>
          <h1>Initiatives</h1>
          <p className="header-subtitle">Workstreams inferred from meeting topics and recurring context.</p>
        </div>
      </header>
      {initiativeRows.length === 0 ? (
        <div className="empty-state">Initiatives appear after Minutes has meeting topics to connect.</div>
      ) : (
        <div className="initiative-list">
          {initiativeRows.map(([name, entry]) => (
            <button
              type="button"
              className="initiative-row"
              key={name}
              onClick={() => onOpen(name)}
              aria-label={`Show ${name} in Context Map`}
            >
              <span>
                <span className="initiative-name">{name}</span>
                <span className="initiative-meta">{entry.people.size} people talking across {entry.meetings} meetings</span>
              </span>
              <span className="initiative-count">{entry.meetings}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

function ContextMapView({
  meetings,
  focusLabel,
  onOpenMeeting,
}: {
  meetings: Meeting[]
  focusLabel?: string | null
  onOpenMeeting: (meeting: Meeting) => void
}) {
  const graph = useMemo(() => buildMinutesGraph(meetings), [meetings])
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [lens, setLens] = useState<MapLens>(focusLabel ? 'initiative' : 'all')
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const [graphSize, setGraphSize] = useState({ width: 640, height: 440 })

  const data = useMemo(() => {
    const visibleLinks = lens === 'all'
      ? graph.links
      : graph.links.filter((link) => link.kind === lens)
    const visibleIds = new Set(visibleLinks.flatMap((link) => [String(link.source), String(link.target)]))
    const visibleNodes = lens === 'all'
      ? graph.nodes
      : graph.nodes.filter((node) => visibleIds.has(node.id))
    return {
      nodes: visibleNodes.map((node) => ({ ...node })) as GraphNode[],
      links: visibleLinks.map((link) => ({ ...link })) as GraphLink[],
    }
  }, [graph, lens])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const syncSize = () => {
      const rect = host.getBoundingClientRect()
      setGraphSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(320, Math.floor(rect.height)),
      })
    }

    syncSize()
    const observer = new ResizeObserver(syncSize)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!focusLabel) return
    setLens('initiative')
    const node = graph.nodes.find((candidate) => candidate.label === focusLabel)
    if (!node) return
    setSelected(node as GraphNode)
    const timer = window.setTimeout(() => {
      const focused = data.nodes.find((candidate) => candidate.label === focusLabel)
      if (focused?.x != null && focused.y != null) {
        graphRef.current?.centerAt(focused.x, focused.y, 320)
        graphRef.current?.zoom(2.1, 320)
      }
    }, 380)
    return () => window.clearTimeout(timer)
  }, [data.nodes, focusLabel, graph.nodes])

  const selectLens = (next: MapLens) => {
    setLens(next)
    setSelected(null)
  }

  const selectedMeetings = selected?.kind === 'meeting'
    ? [selected.meeting]
    : selected
      ? meetings.filter((meeting) => {
          const label = selected.label
          return meeting.people.includes(label) || meeting.initiatives.includes(label)
        })
      : meetings.slice(0, 4)

  const lensOptions: { id: MapLens; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'person', label: 'People' },
    { id: 'initiative', label: 'Initiatives' },
  ]

  return (
    <main className="map-content">
      <header className="content-header map-header">
        <div>
          <h1>Context Map</h1>
          <p>{data.nodes.length} nodes - {data.links.length} relationships</p>
        </div>
        <div className="lens-switch" aria-label="Map lenses">
          {lensOptions.map((option) => (
            <button
              type="button"
              className={lens === option.id ? 'active' : ''}
              aria-pressed={lens === option.id}
              key={option.id}
              onClick={() => selectLens(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>
      <section className="map-stage" aria-label="Meeting relationship map">
        <div className="graph-canvas" ref={hostRef}>
          {data.nodes.length > 0 ? (
            <ForceGraph2D
              ref={graphRef}
              graphData={data}
              backgroundColor="rgba(0,0,0,0)"
              width={graphSize.width}
              height={graphSize.height}
              nodeRelSize={4.2}
              linkDirectionalParticles={0}
              linkWidth={(link) => (link.kind === 'initiative' ? 1.25 : 0.75)}
              linkColor={(link) => (link.kind === 'initiative' ? 'rgba(139, 213, 221, 0.44)' : 'rgba(255,255,255,0.12)')}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const n = node as GraphNode
                const baseRadius = n.kind === 'meeting' ? 4.5 : Math.min(13, 6 + n.degree * 1.25)
                const radius = baseRadius / Math.max(1, globalScale)
                ctx.beginPath()
                ctx.arc(n.x ?? 0, n.y ?? 0, radius, 0, Math.PI * 2)
                ctx.fillStyle = n.kind === 'initiative' ? '#8bd5dd' : n.kind === 'person' ? '#d6c7ff' : '#f2eee7'
                ctx.fill()
                if (n.kind !== 'meeting' && globalScale > 0.7) {
                  ctx.font = `${Math.min(11, 11 / globalScale)}px -apple-system, BlinkMacSystemFont, sans-serif`
                  ctx.fillStyle = 'rgba(242, 238, 231, 0.86)'
                  ctx.fillText(
                    n.label,
                    (n.x ?? 0) + radius + (4 / Math.max(1, globalScale)),
                    (n.y ?? 0) + (3 / Math.max(1, globalScale)),
                  )
                }
              }}
              onNodeClick={(node) => setSelected(node as GraphNode)}
              onNodeRightClick={(node) => {
                const meeting = (node as GraphNode).meeting
                if (meeting) onOpenMeeting(meeting)
              }}
              cooldownTicks={80}
              onEngineStop={() => graphRef.current?.zoomToFit(240, 60)}
            />
          ) : (
            <div className="graph-empty">Record a meeting to build your local context map.</div>
          )}
        </div>
        <div className={`map-inspector-shell${inspectorCollapsed ? ' is-collapsed' : ''}`}>
          <aside
            id="context-map-inspector"
            className="map-inspector"
            aria-hidden={inspectorCollapsed}
            inert={inspectorCollapsed}
          >
            <span className="inspector-kicker">{selected ? selected.kind : 'selection'}</span>
            <h2>{selected?.label ?? 'Recent conversation field'}</h2>
            <div className="inspector-list">
              {selectedMeetings.filter(Boolean).map((meeting) => (
                <button
                  type="button"
                  className="inspector-item"
                  key={meeting!.id}
                  onClick={() => onOpenMeeting(meeting!)}
                >
                  <span>{meeting!.title}</span>
                  <span>{meeting!.people.join(', ')}</span>
                </button>
              ))}
            </div>
          </aside>
          <button
            type="button"
            className="map-inspector-toggle"
            aria-controls="context-map-inspector"
            aria-expanded={!inspectorCollapsed}
            aria-label={inspectorCollapsed ? 'Expand selection inspector' : 'Collapse selection inspector'}
            title={inspectorCollapsed ? 'Expand inspector' : 'Collapse inspector'}
            onClick={() => setInspectorCollapsed((collapsed) => !collapsed)}
          >
            <InspectorToggleIcon expanded={!inspectorCollapsed} />
          </button>
        </div>
      </section>
    </main>
  )
}

function CoachOnboarding({
  coach,
  onRefresh,
}: {
  coach?: CoachSettings | null
  onRefresh: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(Boolean(coach?.onboardingSeen))
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setDismissed(Boolean(coach?.onboardingSeen))
  }, [coach?.onboardingSeen])

  if (dismissed) return null

  const guidedMessage = coach?.guidedSetup?.message || 'Set up a small on-device model for private coaching.'

  const dismiss = async () => {
    setDismissed(true)
    await markCoachOnboardingSeen()
    await onRefresh()
  }

  const setupLocal = async () => {
    setBusy(true)
    setStatus('Preparing private, on-device coaching.')
    setError('')
    try {
      await setupCoachModel()
      setStatus('Coach is ready on this Mac.')
      await onRefresh()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="coach-onboarding" aria-label="Meeting Helper onboarding">
      <div className="coach-onboarding-copy">
        <span className="activation-kicker">Meet Coach</span>
        <h2>A private second set of ears.</h2>
        <p>Coach follows the live conversation and offers short, timely suggestions while you meet.</p>
      </div>
      <div className="coach-points">
        <div className="coach-point">
          <span>1</span>
          <div>
            <strong>Start it your way</strong>
            <p>Start with every recording, ask each meeting, or keep it off until you choose it.</p>
          </div>
        </div>
        <div className="coach-point">
          <span>2</span>
          <div>
            <strong>Private on your screen</strong>
            <p>Screen-share protection keeps guidance out of your shared window by default.</p>
          </div>
        </div>
        <div className="coach-point">
          <span>3</span>
          <div>
            <strong>Recording stays separate</strong>
            <p>Turn Coach off at any time. It never stops, pauses, or changes capture.</p>
          </div>
        </div>
      </div>
      {!coach?.localModelReady ? (
        <div className="coach-setup-strip">
          <div>
            <strong>Ready in about 30 seconds</strong>
            <span>{guidedMessage}</span>
          </div>
          <button type="button" className="pill-button" disabled={busy} onClick={setupLocal}>
            {busy ? 'Setting up' : 'Set up on-device'}
          </button>
        </div>
      ) : null}
      <div className="coach-onboarding-actions">
        <button type="button" className="pill-button secondary" onClick={dismiss}>Not now</button>
      </div>
      <div aria-live="polite">
        {status ? <div className="setup-message">{status}</div> : null}
        {error ? <div className="setup-error">{error}</div> : null}
      </div>
    </section>
  )
}

function HelperView({
  meetings,
  todos,
  coach,
  helper,
  onRefresh,
  onStatusChange,
}: {
  meetings: Meeting[]
  todos: Todo[]
  coach?: CoachSettings | null
  helper: CopilotStatus
  onRefresh: () => Promise<void>
  onStatusChange: (status: CopilotStatus) => void
}) {
  const topInitiative = meetings[0]?.initiatives[0] ?? 'your next meeting'
  const nextTodo = todos[0]
  const [goal, setGoal] = useState(
    coach?.meetingGoal || 'Help me leave with clear decisions, owners, and next steps.',
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const run = async (name: string, action: () => Promise<CopilotStatus>) => {
    setBusy(name)
    setError('')
    try {
      onStatusChange(await action())
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="main-content helper-view">
      <header className="content-header">
        <div>
          <h1>Meeting Helper</h1>
          <p className="header-subtitle">Local, live coaching that stays isolated from recording.</p>
        </div>
        <div className="helper-actions">
          {helper.active ? (
            <>
              <button
                type="button"
                className="pill-button secondary"
                disabled={Boolean(busy)}
                onClick={() => run('show', showMeetingHelper)}
              >
                {busy === 'show' ? 'Opening' : 'Show helper'}
              </button>
              <button
                type="button"
                className="pill-button secondary"
                disabled={Boolean(busy)}
                onClick={() => run(helper.paused ? 'resume' : 'pause', helper.paused ? resumeMeetingHelper : pauseMeetingHelper)}
              >
                {busy === 'pause' ? 'Pausing' : busy === 'resume' ? 'Resuming' : helper.paused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                className="pill-button danger"
                disabled={Boolean(busy)}
                onClick={() => run('stop', stopMeetingHelper)}
              >
                {busy === 'stop' ? 'Stopping' : 'Stop helper'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="pill-button"
              disabled={Boolean(busy)}
              onClick={() => run('start', () => startMeetingHelper(goal))}
            >
              {busy === 'start' ? 'Starting' : 'Start helper'}
            </button>
          )}
        </div>
      </header>
      <CoachOnboarding coach={coach} onRefresh={onRefresh} />
      <section className="helper-panel">
        <div className="helper-goal">
          <span className="helper-label">Meeting goal</span>
          <label htmlFor="helper-goal" className="sr-only">Meeting Helper goal</label>
          <textarea
            id="helper-goal"
            value={goal}
            maxLength={320}
            disabled={helper.active}
            onChange={(event) => setGoal(event.target.value)}
          />
          <div className="helper-state" aria-live="polite">
            <span className={helper.active ? 'status-dot' : 'status-dot preview'} />
            <span>{helper.detail}</span>
          </div>
          {helper.limitation ? <div className="setup-error">{helper.limitation}</div> : null}
          {error ? <div className="setup-error">{error}</div> : null}
        </div>
        <div className="helper-notes">
          <span>{meetings.length} recent meetings are available from local memory.</span>
          <span>{topInitiative} is the strongest current context thread.</span>
          <span>{nextTodo ? `${nextTodo.owner}: ${nextTodo.label}` : 'No open action items found yet.'}</span>
          {helper.nudge?.title || helper.nudge?.text ? (
            <span className="helper-nudge">{helper.nudge.title || helper.nudge.text}</span>
          ) : null}
        </div>
      </section>
    </main>
  )
}

function BottomComposer({
  capture,
  captureBusy,
  onStart,
  onStop,
  onNote,
  onShowTodos,
  onOpenSearchHit,
}: {
  capture: RecordingStatus
  captureBusy: string | null
  onStart: () => Promise<void>
  onStop: () => Promise<void>
  onNote: () => void
  onShowTodos: () => void
  onOpenSearchHit: (hit: SearchHit) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [resultsOpen, setResultsOpen] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!query.trim() || searching) return
    setSearching(true)
    setSearchError('')
    setResultsOpen(true)
    try {
      setResults(await searchLocalMemory(query))
    } catch (error) {
      setResults([])
      setSearchError(errorMessage(error))
    } finally {
      setSearching(false)
    }
  }

  const recording = capture.recording
  const captureDisabled = !recording && (capture.starting || capture.processing || Boolean(captureBusy))

  return (
    <div className="composer-wrap">
      {resultsOpen ? (
        <section className="search-results" aria-label="Search results">
          <div className="search-results-header">
            <span>{searching ? 'Searching local memory' : `${results.length} result${results.length === 1 ? '' : 's'}`}</span>
            <button type="button" className="small-icon-button" aria-label="Close search results" onClick={() => setResultsOpen(false)}>
              <CloseIcon />
            </button>
          </div>
          {searchError ? <div className="search-message error">{searchError}</div> : null}
          {!searching && !searchError && results.length === 0 ? (
            <div className="search-message">No matching meetings found.</div>
          ) : null}
          {results.map((hit) => (
            <button
              type="button"
              className="search-result"
              key={hit.path}
              onClick={() => {
                onOpenSearchHit(hit)
                setResultsOpen(false)
              }}
            >
              <span>{hit.title}</span>
              <span>{hit.date ? new Date(hit.date).toLocaleDateString() : hit.contentType || 'Meeting'}</span>
            </button>
          ))}
        </section>
      ) : null}
      <form className="composer" onSubmit={submit}>
        <button
          type="button"
          className={recording ? 'composer-record recording' : 'composer-record'}
          disabled={captureDisabled}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
          title={recording ? 'Stop recording' : 'Start recording'}
          onClick={() => {
            void (recording ? onStop() : onStart()).catch(() => undefined)
          }}
        >
          <RecordIcon stop={recording} />
          {recording ? <span>{capture.elapsed || '0:00'}</span> : null}
        </button>
        <label htmlFor="ask" className="sr-only">Search local meeting memory</label>
        <input
          id="ask"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search local meeting memory"
          maxLength={240}
        />
        <button type="submit" className="composer-command" disabled={!query.trim() || searching}>
          {searching ? 'Searching' : 'Search'}
        </button>
        <button type="button" className="composer-command" onClick={onNote}>Add note</button>
        <button type="button" className="composer-command" onClick={onShowTodos}>To-do</button>
      </form>
    </div>
  )
}

function MeetingDetailDrawer({
  meeting,
  detail,
  loading,
  error,
  onClose,
  onOpenFile,
}: {
  meeting: Meeting
  detail: BackendMeetingDetail | null
  loading: boolean
  error: string
  onClose: () => void
  onOpenFile: () => Promise<void>
}) {
  const usefulSections = (detail?.sections ?? [])
    .filter((section) => section.heading.toLowerCase() !== 'transcript')
    .slice(0, 3)

  return (
    <div className="detail-scrim" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <header className="detail-header">
          <div>
            <span className="inspector-kicker">Meeting</span>
            <h2 id="detail-title">{detail?.title || meeting.title}</h2>
            <p>{detail?.date ? new Date(detail.date).toLocaleString() : `${meeting.day} ${meeting.time}`}</p>
          </div>
          <button type="button" className="small-icon-button" aria-label="Close meeting details" onClick={onClose} autoFocus>
            <CloseIcon />
          </button>
        </header>
        <div className="detail-body">
          {loading ? <div className="detail-message">Loading local meeting details.</div> : null}
          {error ? <div className="detail-message error">{error}</div> : null}
          {!loading ? (
            <>
              <section className="detail-meta">
                <span>{(detail?.attendees || meeting.people).join(', ') || 'No attendees listed'}</span>
                <span>{detail?.duration || meeting.duration || 'Duration unavailable'}</span>
              </section>
              {detail?.context ? (
                <section className="detail-section">
                  <h3>Context</h3>
                  <p>{detail.context}</p>
                </section>
              ) : null}
              {detail?.decisions?.length ? (
                <section className="detail-section">
                  <h3>Decisions</h3>
                  {detail.decisions.map((decision, index) => <p key={`${decision.text}-${index}`}>{decision.text}</p>)}
                </section>
              ) : null}
              {detail?.action_items?.length ? (
                <section className="detail-section">
                  <h3>Action items</h3>
                  {detail.action_items.map((item, index) => (
                    <p key={`${item.task}-${index}`}>
                      {item.task} <span>{item.assignee ? `- ${item.assignee}` : ''}</span>
                    </p>
                  ))}
                </section>
              ) : null}
              {usefulSections.map((section) => (
                <section className="detail-section" key={section.heading}>
                  <h3>{section.heading}</h3>
                  <p className="detail-section-content">{section.content}</p>
                </section>
              ))}
              {!detail && !error ? (
                <section className="detail-section">
                  <h3>Context</h3>
                  <p>{meeting.initiatives.join(', ')}</p>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
        {meeting.path ? (
          <footer className="detail-footer">
            <button type="button" className="pill-button secondary" onClick={onOpenFile}>Open markdown file</button>
          </footer>
        ) : null}
      </aside>
    </div>
  )
}

function CapturePanel({
  kind,
  capture,
  busy,
  onClose,
  onStart,
  onSave,
}: {
  kind: CapturePanelKind
  capture: RecordingStatus
  busy: string | null
  onClose: () => void
  onStart: () => Promise<void>
  onSave: (text: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const title = kind === 'todo' ? 'Capture action item' : 'Add recording note'

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!text.trim()) {
      setError('Write something before saving.')
      return
    }
    setError('')
    try {
      await onSave(kind === 'todo' ? `ACTION ITEM: ${text.trim()}` : text.trim())
    } catch (error) {
      setError(errorMessage(error))
    }
  }

  return (
    <section className="capture-panel" aria-labelledby="capture-panel-title">
      <div className="capture-panel-header">
        <div>
          <span className="inspector-kicker">Live capture</span>
          <h2 id="capture-panel-title">{title}</h2>
        </div>
        <button type="button" className="small-icon-button" aria-label="Close capture panel" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      {capture.recording ? (
        <form onSubmit={submit}>
          <label htmlFor="capture-note" className="sr-only">{title}</label>
          <textarea
            id="capture-note"
            value={text}
            maxLength={500}
            placeholder={kind === 'todo' ? 'What needs to happen, and who owns it?' : 'What should Minutes remember?'}
            onChange={(event) => setText(event.target.value)}
            autoFocus
          />
          {error ? <div className="setup-error" role="alert">{error}</div> : null}
          <button type="submit" className="pill-button" disabled={!text.trim() || Boolean(busy)}>
            {busy === 'note' ? 'Saving' : 'Save to recording'}
          </button>
        </form>
      ) : (
        <div className="capture-panel-idle">
          <p>Notes and action items are timestamped against an active recording.</p>
          <button
            type="button"
            className="pill-button"
            disabled={Boolean(busy)}
            onClick={() => {
              void onStart().catch((error) => setError(errorMessage(error)))
            }}
          >
            {busy === 'start' ? 'Starting' : 'Start recording'}
          </button>
        </div>
      )}
    </section>
  )
}

function ConsentDialog({
  disclosure,
  busy,
  onCancel,
  onConfirm,
}: {
  disclosure: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  return (
    <div className="consent-scrim" role="presentation">
      <section className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="consent-title">
        <span className="inspector-kicker">Recording consent</span>
        <h2 id="consent-title">Confirm everyone has been informed.</h2>
        <p>{disclosure}</p>
        <div className="consent-actions">
          <button type="button" className="pill-button secondary" disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="button" className="pill-button" disabled={busy} onClick={onConfirm} autoFocus>
            {busy ? 'Starting' : 'Confirm and record'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<NavId>('meetings')
  const [navMode, setNavMode] = useState<NavMode>('expanded')
  const [isDesktopShell, setIsDesktopShell] = useState(isDesktopApp)
  const [homebase, setHomebase] = useState<HomebaseData>({
    meetings: mockMeetings,
    upcoming: mockUpcoming,
    todos: mockTodos,
    source: 'mock',
  })
  const [capture, setCapture] = useState<RecordingStatus>(emptyRecordingStatus)
  const [captureBusy, setCaptureBusy] = useState<string | null>(null)
  const [capturePanel, setCapturePanel] = useState<CapturePanelKind | null>(null)
  const [consent, setConsent] = useState<{ disclosure: string; options: RecordingStartOptions } | null>(null)
  const [microphone, setMicrophone] = useState<MicrophonePermission | null>(null)
  const [helper, setHelper] = useState<CopilotStatus>(emptyCopilotStatus)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [meetingDetail, setMeetingDetail] = useState<BackendMeetingDetail | null>(null)
  const [meetingDetailBusy, setMeetingDetailBusy] = useState(false)
  const [meetingDetailError, setMeetingDetailError] = useState('')
  const [mapFocus, setMapFocus] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const captureRef = useRef(capture)

  useEffect(() => {
    captureRef.current = capture
  }, [capture])

  const notify = useCallback((message: string) => setToast(message), [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const refreshHomebase = useCallback(async () => {
    const data = await loadHomebaseData()
    setHomebase(data)
  }, [])

  useEffect(() => {
    if (!isDesktopShell) return
    let unlisten: (() => void) | undefined
    listenForHelperNextSteps(() => {
      setView('todos')
      setSelectedMeeting(null)
      notify('Meeting Helper stopped. Your next steps are ready to review.')
      refreshHomebase().catch(() => undefined)
      getMeetingHelperStatus().then(setHelper).catch(() => undefined)
    }).then((dispose) => {
      unlisten = dispose
    })
    return () => unlisten?.()
  }, [isDesktopShell, notify, refreshHomebase])

  const refreshCapture = useCallback(async () => {
    if (!isDesktopApp()) return emptyRecordingStatus
    const status = await getCaptureStatus()
    setCapture(status)
    return status
  }, [])

  const refreshMicrophone = useCallback(async () => {
    if (!isDesktopApp()) return
    const permission = await getMicrophonePermission()
    setMicrophone(permission)
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsDesktopShell(isDesktopApp())
    loadHomebaseData().then((data) => {
      if (!cancelled) setHomebase(data)
    })
    if (isDesktopApp()) {
      getMicrophonePermission()
        .then(setMicrophone)
        .catch(() => undefined)
      getMeetingHelperStatus()
        .then((status) => {
          if (!cancelled) setHelper(status)
        })
        .catch(() => undefined)
    }
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isDesktopShell) return
    let cancelled = false
    let timer = 0

    const poll = async () => {
      try {
        const previous = captureRef.current
        const status = await getCaptureStatus()
        if (cancelled) return
        captureRef.current = status
        setCapture(status)
        const wasActive = previous.recording || previous.starting || previous.processing
        const isActive = status.recording || status.starting || status.processing
        if (wasActive && !isActive) {
          await Promise.allSettled([refreshHomebase(), refreshMicrophone()])
        }
        timer = window.setTimeout(poll, isActive ? 750 : 2500)
      } catch {
        if (!cancelled) timer = window.setTimeout(poll, 3500)
      }
    }

    poll()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isDesktopShell, refreshHomebase, refreshMicrophone])

  useEffect(() => {
    if (!isDesktopShell || (!helper.active && view !== 'helper')) return
    const timer = window.setInterval(() => {
      getMeetingHelperStatus().then(setHelper).catch(() => undefined)
    }, helper.active ? 1200 : 4000)
    return () => window.clearInterval(timer)
  }, [helper.active, isDesktopShell, view])

  useEffect(() => {
    if (!selectedMeeting && !consent) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (consent) setConsent(null)
      else setSelectedMeeting(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [consent, selectedMeeting])

  const handleStartRecording = async (options: RecordingStartOptions = {}) => {
    setCaptureBusy('start')
    try {
      const currentPermission = await getMicrophonePermission().catch(() => microphone)
      if (currentPermission) setMicrophone(currentPermission)
      if (
        currentPermission &&
        (currentPermission.status === 'denied' || currentPermission.status === 'stale_or_restart_needed')
      ) {
        throw new Error(`${currentPermission.detail} Use Open System Settings, then check again.`)
      }
      const outcome = await startRecording(options)
      if (outcome?.status === 'consentRequired') {
        setConsent({ disclosure: outcome.disclosure, options })
        return
      }
      setCapture((current) => ({ ...current, starting: true }))
      notify(
        currentPermission?.runtimeUsable
          ? 'Recording is starting on this Mac.'
          : 'Recording is starting. Approve microphone access if macOS asks.',
      )
      window.setTimeout(() => refreshCapture().catch(() => undefined), 250)
    } catch (error) {
      notify(`Recording not started: ${errorMessage(error)}`)
      throw error
    } finally {
      setCaptureBusy(null)
    }
  }

  const confirmRecording = async () => {
    if (!consent) return
    const request = consent
    setCaptureBusy('start')
    try {
      await startRecording({ ...request.options, consentConfirmed: true })
      setConsent(null)
      setCapture((current) => ({ ...current, starting: true }))
      notify('Recording is starting on this Mac.')
      window.setTimeout(() => refreshCapture().catch(() => undefined), 250)
    } catch (error) {
      notify(`Recording not started: ${errorMessage(error)}`)
    } finally {
      setCaptureBusy(null)
    }
  }

  const handleStopRecording = async () => {
    setCaptureBusy('stop')
    try {
      await stopRecording()
      notify('Stopping safely. Minutes is preserving the audio before processing.')
      window.setTimeout(() => refreshCapture().catch(() => undefined), 250)
    } catch (error) {
      notify(`Could not stop recording: ${errorMessage(error)}`)
      throw error
    } finally {
      setCaptureBusy(null)
    }
  }

  const handleSaveNote = async (text: string) => {
    setCaptureBusy('note')
    try {
      const line = await addRecordingNote(text)
      setCapturePanel(null)
      notify(`Saved ${line}.`)
    } catch (error) {
      notify(`Note not saved: ${errorMessage(error)}`)
      throw error
    } finally {
      setCaptureBusy(null)
    }
  }

  const openMeeting = async (meeting: Meeting) => {
    setSelectedMeeting(meeting)
    setMeetingDetail(null)
    setMeetingDetailError('')
    if (!meeting.path) return
    setMeetingDetailBusy(true)
    try {
      setMeetingDetail(await getMeetingDetail(meeting.path))
    } catch (error) {
      setMeetingDetailError(errorMessage(error))
    } finally {
      setMeetingDetailBusy(false)
    }
  }

  const openSearchHit = (hit: SearchHit) => {
    openMeeting({
      id: hit.path,
      path: hit.path,
      title: hit.title,
      people: [],
      initiatives: [],
      day: hit.date ? new Date(hit.date).toLocaleDateString() : 'Search result',
      time: hit.date ? new Date(hit.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
      duration: '',
      status: 'done',
      source: 'backend',
    })
  }

  const openTodo = (todo: Todo) => {
    if (!todo.meetingPath) {
      notify('This preview item has no source meeting. Native action items open their original meeting.')
      return
    }
    openMeeting({
      id: todo.meetingPath,
      path: todo.meetingPath,
      title: todo.meetingTitle || todo.initiative,
      people: [todo.owner],
      initiatives: [todo.initiative],
      day: 'Source meeting',
      time: '',
      duration: '',
      status: 'done',
      source: 'backend',
    })
  }

  const showInitiative = (initiative: string) => {
    setMapFocus(initiative)
    setView('map')
  }

  const openSelectedMeetingFile = async () => {
    if (!selectedMeeting?.path) return
    try {
      await openMeetingFile(selectedMeeting.path)
    } catch (error) {
      notify(`Could not open meeting file: ${errorMessage(error)}`)
    }
  }

  const openMicrophoneSettings = async () => {
    if (!microphone?.settingsUrl) return
    try {
      await openSystemSettings(microphone.settingsUrl)
    } catch (error) {
      notify(`Could not open Microphone settings: ${errorMessage(error)}`)
    }
  }

  const checkMicrophonePermission = async () => {
    try {
      await refreshMicrophone()
      notify('Microphone permission status refreshed.')
    } catch (error) {
      notify(`Could not check Microphone permission: ${errorMessage(error)}`)
    }
  }

  return (
    <div className={`app-shell nav-${navMode}${isDesktopShell ? ' is-desktop' : ''}`}>
      {navMode !== 'hidden' ? (
        <Sidebar
          current={view}
          onChange={setView}
          source={homebase.source}
          navMode={navMode}
          onModeChange={setNavMode}
        />
      ) : (
        <button
          type="button"
          className="nav-reveal-button"
          aria-label="Show sidebar"
          title="Show sidebar"
          onClick={() => setNavMode('rail')}
        >
          <SidebarModeIcon action="expand" />
        </button>
      )}
      <div className="workspace">
        {view === 'meetings' ? (
          <MeetingsHome
            meetings={homebase.meetings}
            upcoming={homebase.upcoming}
            setup={homebase.setup}
            source={homebase.source}
            error={homebase.error}
            capture={capture}
            captureBusy={captureBusy}
            onRefresh={refreshHomebase}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
            onNote={() => setCapturePanel('note')}
            onOpenMeeting={openMeeting}
            microphone={microphone}
            onOpenMicrophoneSettings={openMicrophoneSettings}
            onRefreshMicrophone={checkMicrophonePermission}
          />
        ) : null}
        {view === 'todos' ? (
          <TodoView todos={homebase.todos} onCapture={() => setCapturePanel('todo')} onOpen={openTodo} />
        ) : null}
        {view === 'initiatives' ? (
          <InitiativesView meetings={homebase.meetings} onOpen={showInitiative} />
        ) : null}
        {view === 'map' ? (
          <ContextMapView meetings={homebase.meetings} focusLabel={mapFocus} onOpenMeeting={openMeeting} />
        ) : null}
        {view === 'helper' ? (
          <HelperView
            meetings={homebase.meetings}
            todos={homebase.todos}
            coach={homebase.coach}
            helper={helper}
            onRefresh={refreshHomebase}
            onStatusChange={setHelper}
          />
        ) : null}
        <BottomComposer
          capture={capture}
          captureBusy={captureBusy}
          onStart={() => handleStartRecording()}
          onStop={handleStopRecording}
          onNote={() => setCapturePanel('note')}
          onShowTodos={() => setView('todos')}
          onOpenSearchHit={openSearchHit}
        />
        {capturePanel ? (
          <CapturePanel
            key={capturePanel}
            kind={capturePanel}
            capture={capture}
            busy={captureBusy}
            onClose={() => setCapturePanel(null)}
            onStart={() => handleStartRecording()}
            onSave={handleSaveNote}
          />
        ) : null}
      </div>
      {selectedMeeting ? (
        <MeetingDetailDrawer
          meeting={selectedMeeting}
          detail={meetingDetail}
          loading={meetingDetailBusy}
          error={meetingDetailError}
          onClose={() => setSelectedMeeting(null)}
          onOpenFile={openSelectedMeetingFile}
        />
      ) : null}
      {consent ? (
        <ConsentDialog
          disclosure={consent.disclosure}
          busy={captureBusy === 'start'}
          onCancel={() => setConsent(null)}
          onConfirm={confirmRecording}
        />
      ) : null}
      <div className={toast ? 'toast visible' : 'toast'} role="status" aria-live="polite">{toast}</div>
    </div>
  )
}
