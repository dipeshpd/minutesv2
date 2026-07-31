import {
  meetings as mockMeetings,
  todos as mockTodos,
  upcoming as mockUpcoming,
  type Meeting,
  type Todo,
  type UpcomingItem,
} from './data'

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>
type Unlisten = () => void
type Listen = (
  event: string,
  handler: (event: { payload: unknown }) => void,
) => Promise<Unlisten>

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: Invoke
      }
      event?: {
        listen?: Listen
      }
      window?: {
        getCurrentWindow?: () => {
          close: () => Promise<void>
          startDragging: () => Promise<void>
        }
      }
    }
  }
}

interface BackendSearchResult {
  path?: string
  title?: string
  date?: string
  content_type?: string
}

export interface MeetingSection {
  heading: string
  content: string
}

export interface MeetingDecision {
  text: string
  topic?: string | null
}

export interface MeetingActionItem {
  assignee?: string
  task?: string
  due?: string | null
  status?: string
}

export interface BackendMeetingDetail {
  path?: string
  title?: string
  date?: string
  duration?: string
  content_type?: string
  status?: string | null
  context?: string | null
  attendees?: string[]
  related_topics?: string[]
  action_items?: MeetingActionItem[]
  decisions?: MeetingDecision[]
  sections?: MeetingSection[]
}

interface BackendCalendarEvent {
  title?: string
  start?: string
  minutes_until?: number
}

export interface ActivationMilestones {
  modelReadyAt?: string | null
  firstRecordingStartedAt?: string | null
  firstArtifactSavedAt?: string | null
  nextStepNudgeShownAt?: string | null
}

export interface ActivationStatus {
  phase: string
  nextAction: string
  hasModel: boolean
  hasSavedArtifact: boolean
  firstArtifactPath?: string | null
  milestones?: ActivationMilestones
}

interface ParakeetStatus {
  ready?: boolean
  issues?: string[]
  guideUrl?: string
  setupCommand?: string
}

interface SetupSurface {
  resolved_backend?: string
  detail?: string
  ready?: boolean
}

export interface SetupState {
  needsSetup?: boolean
  hasModel?: boolean
  engine?: string
  modelName?: string
  parakeet?: ParakeetStatus | null
  batch_transcription?: SetupSurface
  standalone_live?: SetupSurface
  activation?: ActivationStatus
}

interface CoachGuidedSetup {
  message?: string
}

export interface CoachSettings {
  enabled: boolean
  meetingGoal?: string
  modelChoice?: string
  cloudConfigured?: boolean
  armingBehavior?: string
  criticalNotificationsOnly?: boolean
  onboardingSeen?: boolean
  localModelReady?: boolean
  guidedSetup?: CoachGuidedSetup | null
  advancedProvider?: string
  advancedModel?: string
  cloudNote?: string | null
}

export interface RecordingStatus {
  recording: boolean
  starting: boolean
  processing: boolean
  recordingMode?: string
  processingStage?: string | null
  processingStageLabel?: string | null
  elapsed?: string | null
  audioLevel?: number
  latestOutput?: {
    kind?: string
    title?: string
    path?: string
    detail?: string
  } | null
}

export interface LiveTranscriptDraft {
  text: string
  lineCount: number
}

export interface RecordingStartOptions {
  mode?: 'meeting' | 'quick-thought'
  title?: string
  intent?: string
  source?: string
  consentConfirmed?: boolean
}

export type StartRecordingOutcome =
  | { status: 'started' }
  | { status: 'consentRequired'; disclosure: string }

export interface CopilotStatus {
  active: boolean
  paused: boolean
  state: string
  goal: string
  detail: string
  limitation?: string | null
  guidance?: {
    cover?: string[]
    followUp?: string[]
    attention?: string[]
  }
  nudge?: {
    text?: string
    title?: string
  } | null
  criticalNotificationsEnabled?: boolean
}

export interface ClaudeSecretStatus {
  supported: boolean
  keySet: boolean
  storedKeySet: boolean
  storageLabel: string
  envVar: string
  message: string
}

export interface RecallChatChunk {
  type?: string
  text?: string
  result?: string
  event?: {
    type?: string
    delta?: {
      type?: string
      text?: string
    }
  }
  message?: {
    content?: Array<{
      type?: string
      text?: string
    }>
  }
}

export interface SearchHit {
  path: string
  title: string
  date?: string
  contentType?: string
}

export interface MicrophonePermission {
  kind: 'microphone'
  label: string
  status: 'granted' | 'denied' | 'not_determined' | 'not_needed' | 'unsupported' | 'stale_or_restart_needed' | 'unknown'
  runtimeUsable: boolean
  detail: string
  settingsUrl?: string | null
  canOpenSettings?: boolean
}

export interface HomebaseData {
  meetings: Meeting[]
  upcoming: UpcomingItem[]
  todos: Todo[]
  setup?: SetupState | null
  coach?: CoachSettings | null
  source: 'backend' | 'mock'
  error?: string
}

const desktopInvoke = (): Invoke | null => window.__TAURI__?.core?.invoke ?? null

export const isDesktopApp = () => Boolean(desktopInvoke())

const stableId = (value: string, fallback: string) =>
  (value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || fallback

const parseDate = (value?: string) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const dayLabel = (value?: string) => {
  const date = parseDate(value)
  if (!date) return 'Recent'

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.round((startOfDate - startOfToday) / 86400000)

  if (days === 0) return 'Today'
  if (days === -1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const timeLabel = (value?: string) => {
  const date = parseDate(value)
  if (!date) return ''
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const titleToInitiative = (title: string) => {
  const cleaned = title
    .replace(/^#/, '')
    .replace(/\s+(sync|standup|kickoff|review|weekly|meeting|1 on 1)$/i, '')
    .trim()
  return cleaned || 'General context'
}

const normalizeMeeting = (
  result: BackendSearchResult,
  index: number,
  detail?: BackendMeetingDetail,
): Meeting => {
  const title = detail?.title || result.title || 'Untitled'
  const path = result.path || detail?.path
  const people = detail?.attendees?.filter(Boolean) ?? []
  const relatedTopics = detail?.related_topics?.filter(Boolean) ?? []

  return {
    id: stableId(path || title, `meeting-${index}`),
    path,
    title,
    people: people.length > 0 ? people : ['Unknown attendees'],
    initiatives: relatedTopics.length > 0 ? relatedTopics.slice(0, 4) : [titleToInitiative(title)],
    time: timeLabel(detail?.date || result.date),
    day: dayLabel(detail?.date || result.date),
    duration: detail?.duration || '',
    status: 'done',
    source: 'backend',
  }
}

const calendarRow = (event: BackendCalendarEvent): UpcomingItem => {
  const date = parseDate(event.start) ?? new Date(Date.now() + Math.max(0, event.minutes_until ?? 0) * 60000)
  const starts = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const minutes = event.minutes_until ?? 0
  const relative = minutes <= 0 ? 'starting now' : minutes < 60 ? `in ${minutes}m` : `in ${Math.floor(minutes / 60)}h ${minutes % 60}m`

  return {
    date: String(date.getDate()),
    month: date.toLocaleDateString(undefined, { month: 'long' }),
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    title: event.title || 'Upcoming meeting',
    time: `${starts} - ${relative}`,
  }
}

const noEventsTodayRow = (): UpcomingItem => {
  const today = new Date()
  return {
    date: String(today.getDate()),
    month: today.toLocaleDateString(undefined, { month: 'long' }),
    weekday: today.toLocaleDateString(undefined, { weekday: 'short' }),
    title: 'No events today',
    time: '',
    empty: true,
  }
}

const todosFromDetails = (details: BackendMeetingDetail[]): Todo[] => {
  const todos = details.flatMap((detail, meetingIndex) =>
    (detail.action_items ?? [])
      .filter((item) => item.task && item.status !== 'done')
      .map((item, itemIndex) => ({
        id: stableId(`${detail.path || detail.title}-${itemIndex}`, `todo-${meetingIndex}-${itemIndex}`),
        label: item.task || 'Follow up',
        owner: item.assignee || 'Unassigned',
        due: item.due || 'Open',
        initiative: detail.related_topics?.[0] || titleToInitiative(detail.title || 'Meeting'),
        meetingPath: detail.path,
        meetingTitle: detail.title,
      })),
  )

  return todos.slice(0, 12)
}

export async function loadHomebaseData(): Promise<HomebaseData> {
  const invoke = desktopInvoke()
  if (!invoke) {
    return { meetings: mockMeetings, upcoming: mockUpcoming, todos: mockTodos, setup: null, coach: null, source: 'mock' }
  }

  try {
    const [rawMeetings, rawUpcoming, setup, coach] = await Promise.all([
      invoke<BackendSearchResult[]>('cmd_list_meetings', { limit: 30 }),
      invoke<BackendCalendarEvent[]>('cmd_upcoming_meetings').catch(() => []),
      invoke<SetupState>('cmd_needs_setup').catch(() => null),
      invoke<CoachSettings>('cmd_get_coach_settings').catch(() => null),
    ])

    const detailResults = await Promise.allSettled(
      rawMeetings
        .filter((meeting) => meeting.path)
        .slice(0, 16)
        .map((meeting) => invoke<BackendMeetingDetail>('cmd_get_meeting_detail', { path: meeting.path })),
    )
    const details = detailResults
      .filter((result): result is PromiseFulfilledResult<BackendMeetingDetail> => result.status === 'fulfilled')
      .map((result) => result.value)
    const detailByPath = new Map(details.map((detail) => [detail.path, detail]))

    return {
      meetings: rawMeetings.map((meeting, index) => normalizeMeeting(meeting, index, detailByPath.get(meeting.path))),
      upcoming: rawUpcoming.length > 0 ? rawUpcoming.map(calendarRow) : [noEventsTodayRow()],
      todos: todosFromDetails(details),
      setup,
      coach,
      source: 'backend',
    }
  } catch (error) {
    return {
      meetings: mockMeetings,
      upcoming: mockUpcoming,
      todos: mockTodos,
      setup: null,
      coach: null,
      source: 'mock',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const requireDesktopInvoke = () => {
  const invoke = desktopInvoke()
  if (!invoke) throw new Error('This action is available in the Minutes desktop app.')
  return invoke
}

export async function downloadSpeechModel(model: string) {
  const invoke = requireDesktopInvoke()
  const result = await invoke<string>('cmd_download_model', { model })
  await Promise.allSettled([
    invoke<string>('cmd_set_setting', { section: 'transcription', key: 'model', value: model }),
    invoke<string>('cmd_set_setting', { section: 'dictation', key: 'model', value: model }),
  ])
  return result
}

export async function switchToWhisper() {
  const invoke = requireDesktopInvoke()
  return invoke<string>('cmd_set_setting', { section: 'transcription', key: 'engine', value: 'whisper' })
}

export async function openParakeetGuide(setup?: SetupState | null) {
  const invoke = requireDesktopInvoke()
  return invoke<void>('cmd_open_file', {
    path: setup?.parakeet?.guideUrl || 'https://github.com/silverstein/minutes/blob/main/docs/architecture/parakeet.md',
  })
}

export async function markActivationNudgeShown(kind = 'first-run-onboarding') {
  const invoke = desktopInvoke()
  if (!invoke) return
  await invoke<void>('cmd_mark_activation_nudge_shown', { kind }).catch(() => undefined)
}

export async function setupCoachModel() {
  const invoke = requireDesktopInvoke()
  return invoke<CoachSettings>('cmd_setup_coach_model')
}

export async function markCoachOnboardingSeen() {
  const invoke = desktopInvoke()
  if (!invoke) return
  await invoke<void>('cmd_mark_coach_onboarding_seen').catch(() => undefined)
}

export async function getCaptureStatus(): Promise<RecordingStatus> {
  const invoke = requireDesktopInvoke()
  return invoke<RecordingStatus>('cmd_capture_status')
}

export async function startRecording(options: RecordingStartOptions = {}) {
  const invoke = requireDesktopInvoke()
  return invoke<StartRecordingOutcome>('cmd_start_recording', { ...options })
}

export async function stopRecording() {
  const invoke = requireDesktopInvoke()
  return invoke<void>('cmd_stop_recording')
}

export async function getMicrophoneMuted() {
  const invoke = requireDesktopInvoke()
  return invoke<boolean>('cmd_mic_mute_state')
}

export async function setMicrophoneMuted(muted: boolean) {
  const invoke = requireDesktopInvoke()
  return invoke<boolean>('cmd_toggle_mic_mute', { forceState: muted })
}

export async function addRecordingNote(text: string) {
  const normalized = text.trim()
  if (!normalized) throw new Error('Write a note before saving it.')
  const invoke = requireDesktopInvoke()
  return invoke<string>('cmd_add_note', { text: normalized })
}

export async function getRecentLiveTranscript(sinceMs = 5 * 60 * 1000): Promise<LiveTranscriptDraft> {
  const invoke = desktopInvoke()
  if (!invoke) return { text: '', lineCount: 0 }
  return invoke<LiveTranscriptDraft>('cmd_recent_live_transcript', { sinceMs })
}

export async function getMeetingDetail(path: string) {
  const invoke = requireDesktopInvoke()
  return invoke<BackendMeetingDetail>('cmd_get_meeting_detail', { path })
}

export async function openMeetingFile(path: string) {
  const invoke = requireDesktopInvoke()
  return invoke<void>('cmd_open_file', { path })
}

export async function searchLocalMemory(query: string): Promise<SearchHit[]> {
  const normalized = query.trim()
  if (!normalized) return []
  const invoke = requireDesktopInvoke()
  const results = await invoke<BackendSearchResult[]>('cmd_search', { query: normalized })
  return results
    .filter((result): result is BackendSearchResult & { path: string } => Boolean(result.path))
    .slice(0, 12)
    .map((result) => ({
      path: result.path,
      title: result.title || 'Untitled meeting',
      date: result.date,
      contentType: result.content_type,
    }))
}

export async function getMeetingHelperStatus() {
  const invoke = requireDesktopInvoke()
  return invoke<CopilotStatus>('cmd_copilot_surface_status')
}

export async function startMeetingHelper(goal: string) {
  const invoke = requireDesktopInvoke()
  return invoke<CopilotStatus>('cmd_start_copilot_surface', { goal: goal.trim() || undefined })
}

export async function stopMeetingHelper() {
  const invoke = requireDesktopInvoke()
  return invoke<CopilotStatus>('cmd_stop_copilot_surface')
}

export async function showMeetingHelper() {
  const invoke = requireDesktopInvoke()
  return invoke<CopilotStatus>('cmd_show_copilot_surface')
}

export async function listenForHelperNextSteps(onOpen: () => void): Promise<Unlisten> {
  const listen = window.__TAURI__?.event?.listen
  if (!listen) return () => undefined
  return listen('homebase:open-next-steps', () => onOpen())
}

export async function pauseMeetingHelper() {
  const invoke = requireDesktopInvoke()
  return invoke<CopilotStatus>('cmd_pause_copilot_surface')
}

export async function resumeMeetingHelper() {
  const invoke = requireDesktopInvoke()
  return invoke<CopilotStatus>('cmd_resume_copilot_surface')
}

export async function finishMeetingHelper() {
  const invoke = requireDesktopInvoke()
  return invoke<void>('cmd_finish_copilot_surface')
}

export async function setMeetingHelperCompact(
  compact: boolean,
  restoreWidth?: number | null,
  restoreHeight?: number | null,
) {
  const invoke = requireDesktopInvoke()
  return invoke<void>('cmd_set_copilot_hud_compact', {
    compact,
    restoreWidth: restoreWidth ?? null,
    restoreHeight: restoreHeight ?? null,
  })
}

export async function sendRecallChatMessage(message: string) {
  const normalized = message.trim()
  if (!normalized) throw new Error('Write a question first.')
  const invoke = requireDesktopInvoke()
  return invoke<void>('cmd_recall_chat_send', { message: normalized })
}

export async function cancelRecallChat() {
  const invoke = requireDesktopInvoke()
  return invoke<void>('cmd_recall_chat_cancel')
}

export async function clearRecallChat() {
  const invoke = requireDesktopInvoke()
  return invoke<void>('cmd_recall_chat_clear')
}

export async function listenForRecallChat({
  onChunk,
  onDone,
  onError,
}: {
  onChunk: (chunk: RecallChatChunk) => void
  onDone: () => void
  onError: (message: string) => void
}): Promise<Unlisten> {
  const listen = window.__TAURI__?.event?.listen
  if (!listen) return () => undefined

  const unlisten = await Promise.all([
    listen('recall-chat-chunk', (event) => onChunk((event.payload || {}) as RecallChatChunk)),
    listen('recall-chat-done', () => onDone()),
    listen('recall-chat-error', (event) => onError(String(event.payload || 'Claude could not answer.'))),
  ])
  return () => unlisten.forEach((stop) => stop())
}

export async function getClaudeSecretStatus() {
  const invoke = requireDesktopInvoke()
  return invoke<ClaudeSecretStatus>('cmd_anthropic_secret_status')
}

export async function saveClaudeApiKey(apiKey: string) {
  const normalized = apiKey.trim()
  if (!normalized) throw new Error('Paste an API key first.')
  const invoke = requireDesktopInvoke()
  return invoke<ClaudeSecretStatus>('cmd_set_anthropic_api_key', { apiKey: normalized })
}

export async function clearClaudeApiKey() {
  const invoke = requireDesktopInvoke()
  return invoke<ClaudeSecretStatus>('cmd_clear_anthropic_api_key')
}

export async function getMicrophonePermission() {
  const invoke = requireDesktopInvoke()
  const rows = await invoke<MicrophonePermission[]>('cmd_macos_permission_rows')
  return rows.find((row) => row.kind === 'microphone') ?? null
}

export async function openSystemSettings(url: string) {
  const invoke = requireDesktopInvoke()
  return invoke<void>('cmd_open_file', { path: url })
}
