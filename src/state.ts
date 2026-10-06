import type { Expectation, Objective, PartId, SpecimenId, TabId, Temp, Moisture } from './types'
import { progress } from './storage'

export interface Challenge {
  order: PartId[]
  index: number
  mistakes: number
  wrongStreak: number
  done: boolean
  lastCorrect: PartId | null
}

export const live = {
  tab: 'parts' as TabId,
  teacher: progress.teacher,
  selectedPart: 'eyepiece' as PartId,
  challenge: null as Challenge | null,
  specimen: null as SpecimenId | null,
  lightOn: false,
  brightness: 72,
  diaphragm: 4,
  objective: 4 as Objective,
  coarse: 22,
  fine: 50,
  sampleX: 0,
  sampleY: 0,
  mouldDensity: 0.85,
  fromExperiment: false,
  coarseWarn: false,
  exp: {
    temp: 'room' as Temp,
    moisture: 'wet' as Moisture,
    preservative: false,
    day: 0,
    expectation: null as Expectation | null,
    started: false,
  },
}

type Listener = () => void
const listeners = new Set<Listener>()

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emit(): void {
  listeners.forEach((fn) => fn())
}

export function setTab(tab: TabId): void {
  live.tab = tab
  const hash = tab === 'parts' ? '#parts' : tab === 'scope' ? '#scope' : '#experiment'
  if (location.hash !== hash) history.replaceState(null, '', hash)
  emit()
}

export function tabFromHash(hash: string): TabId {
  if (hash === '#scope') return 'scope'
  if (hash === '#experiment') return 'experiment'
  return 'parts'
}
