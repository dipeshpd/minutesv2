export type NavId = 'meetings' | 'todos' | 'initiatives' | 'map' | 'helper'

export interface Meeting {
  id: string
  path?: string
  title: string
  people: string[]
  initiatives: string[]
  time: string
  day: string
  duration: string
  status: 'done' | 'recording' | 'upcoming'
  source?: 'backend' | 'mock'
}

export interface UpcomingItem {
  date: string
  month: string
  weekday: string
  title: string
  time: string
  empty?: boolean
}

export interface Todo {
  id: string
  label: string
  owner: string
  due: string
  initiative: string
  meetingPath?: string
  meetingTitle?: string
}

export const meetings: Meeting[] = [
  {
    id: 'm-passwordless-kickoff',
    title: 'Passwordless - Web Sign in Kickoff',
    people: ['Nvera', 'Sammy', 'Cassidy'],
    initiatives: ['Passwordless rollout'],
    time: '3:30 PM',
    day: 'Yesterday',
    duration: '42m',
    status: 'done',
  },
  {
    id: 'm-coffee-donut',
    title: '#coffee-buddies Donut',
    people: ['Cassidy Edwards'],
    initiatives: ['Team health'],
    time: '2:30 PM',
    day: 'Yesterday',
    duration: '18m',
    status: 'done',
  },
  {
    id: 'm-life-comms',
    title: 'End of life comms',
    people: ['Michael Nguyen', 'Hilary Denton'],
    initiatives: ['Lifecycle comms'],
    time: '1:00 PM',
    day: 'Yesterday',
    duration: '36m',
    status: 'done',
  },
  {
    id: 'm-standup-metrics',
    title: 'B&B Standup + Metrics Review',
    people: ['Adam', 'Chris', 'Jonathan'],
    initiatives: ['Metrics review', 'Platform quality'],
    time: '11:45 AM',
    day: 'Yesterday',
    duration: '29m',
    status: 'done',
  },
  {
    id: 'm-hilary-weekly',
    title: 'Hilary - Dipesh Weekly 1 on 1',
    people: ['Hilary Denton'],
    initiatives: ['Leadership sync'],
    time: '11:15 AM',
    day: 'Yesterday',
    duration: '31m',
    status: 'done',
  },
  {
    id: 'm-jonathan-weekly',
    title: 'Jonathan-Dipesh Weekly',
    people: ['Jonathan Monforti'],
    initiatives: ['Platform quality', 'Leadership sync'],
    time: '11:00 AM',
    day: 'Yesterday',
    duration: '45m',
    status: 'done',
  },
  {
    id: 'm-geolocation',
    title: 'Geolocation',
    people: ['Christan', 'Jasonwang'],
    initiatives: ['Risk controls'],
    time: '5:15 PM',
    day: 'Tue, Jul 28',
    duration: '50m',
    status: 'done',
  },
  {
    id: 'm-rachel-weekly',
    title: 'Dipesh / Rachel Weekly',
    people: ['Rachel Strubhar'],
    initiatives: ['Leadership sync'],
    time: '1:45 PM',
    day: 'Tue, Jul 28',
    duration: '35m',
    status: 'done',
  },
  {
    id: 'm-platform-leads',
    title: 'Bi Weekly Platforms Leads Sync',
    people: ['Jonathan', 'Rachel', 'Chris', 'Adam'],
    initiatives: ['Platform quality', 'Metrics review'],
    time: '1:00 PM',
    day: 'Tue, Jul 28',
    duration: '54m',
    status: 'done',
  },
]

export const upcoming: UpcomingItem[] = [
  { date: '30', month: 'July', weekday: 'Thu', title: 'No events today', time: '', empty: true },
  { date: '4', month: 'August', weekday: 'Tue', title: 'Commute', time: '7:10 - 9:15 AM' },
  { date: '4', month: 'August', weekday: 'Tue', title: 'DACI for passwordless rollout', time: '9:15 - 10:15 AM' },
  { date: '4', month: 'August', weekday: 'Tue', title: 'Team FE Standup', time: '11:30 - 11:45 AM' },
  { date: '4', month: 'August', weekday: 'Tue', title: 'IN Standup & Metrics', time: '11:45 AM - 12:15 PM' },
]

export const todos: Todo[] = [
  {
    id: 't-daci',
    label: 'Send DACI draft before passwordless review',
    owner: 'Dipesh',
    due: 'Aug 1',
    initiative: 'Passwordless rollout',
  },
  {
    id: 't-metrics',
    label: 'Pull frontend sign-in error rates for leads sync',
    owner: 'Chris',
    due: 'Today',
    initiative: 'Metrics review',
  },
  {
    id: 't-comms',
    label: 'Confirm wording for end-of-life customer note',
    owner: 'Michael',
    due: 'Tomorrow',
    initiative: 'Lifecycle comms',
  },
]

export const navItems: { id: NavId; label: string; hint: string }[] = [
  { id: 'meetings', label: 'Meetings', hint: 'chronological memory' },
  { id: 'todos', label: 'To-do', hint: 'open commitments' },
  { id: 'initiatives', label: 'Initiatives', hint: 'workstreams' },
  { id: 'map', label: 'Context Map', hint: 'people and initiatives' },
  { id: 'helper', label: 'Meeting Helper', hint: 'live prep and coaching' },
]
