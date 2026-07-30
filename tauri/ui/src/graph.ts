import type { Meeting } from './data'

export type GraphNodeKind = 'meeting' | 'person' | 'initiative'

export interface MinutesGraphNode {
  id: string
  label: string
  kind: GraphNodeKind
  degree: number
  meeting?: Meeting
}

export interface MinutesGraphLink {
  source: string
  target: string
  kind: 'person' | 'initiative'
}

export interface MinutesGraph {
  nodes: MinutesGraphNode[]
  links: MinutesGraphLink[]
}

const personId = (name: string) => `person:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
const initiativeId = (name: string) => `initiative:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
const meetingId = (id: string) => `meeting:${id}`

export function buildMinutesGraph(meetings: Meeting[]): MinutesGraph {
  const nodes = new Map<string, MinutesGraphNode>()
  const links: MinutesGraphLink[] = []

  for (const meeting of meetings) {
    const mId = meetingId(meeting.id)
    nodes.set(mId, {
      id: mId,
      label: meeting.title,
      kind: 'meeting',
      degree: meeting.people.length + meeting.initiatives.length,
      meeting,
    })

    for (const person of meeting.people) {
      const id = personId(person)
      const existing = nodes.get(id)
      nodes.set(id, {
        id,
        label: person,
        kind: 'person',
        degree: (existing?.degree ?? 0) + 1,
      })
      links.push({ source: mId, target: id, kind: 'person' })
    }

    for (const initiative of meeting.initiatives) {
      const id = initiativeId(initiative)
      const existing = nodes.get(id)
      nodes.set(id, {
        id,
        label: initiative,
        kind: 'initiative',
        degree: (existing?.degree ?? 0) + 1,
      })
      links.push({ source: mId, target: id, kind: 'initiative' })
    }
  }

  return { nodes: [...nodes.values()], links }
}
