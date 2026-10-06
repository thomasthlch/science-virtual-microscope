import type { Expectation, SpecimenId, Trial } from './types'

const KEY = 'hk-p5-virtual-microscope-v1'

export interface Flags {
  placedSlide: boolean
  lightOn: boolean
  focused4: boolean
  focusedHigh: boolean
  usedCoarseAt40: boolean
  bacteriaFocused: boolean
  specimenFocused: Record<SpecimenId, boolean>
}

export interface Progress {
  version: 1
  teacher: boolean
  notes: Partial<Record<SpecimenId, string>>
  sketches: Partial<Record<SpecimenId, string>>
  recordedMags: Partial<Record<SpecimenId, number[]>>
  trials: Trial[]
  conclusion: string
  everPredicted: boolean
  partsComplete: boolean
  partsMistakes: number | null
  flags: Flags
}

function emptyFlags(): Flags {
  return {
    placedSlide: false,
    lightOn: false,
    focused4: false,
    focusedHigh: false,
    usedCoarseAt40: false,
    bacteriaFocused: false,
    specimenFocused: {
      mould: false,
      yeast: false,
      bacteria: false,
      onion: false,
    },
  }
}

export function emptyProgress(): Progress {
  return {
    version: 1,
    teacher: false,
    notes: {},
    sketches: {},
    recordedMags: {},
    trials: [],
    conclusion: '',
    everPredicted: false,
    partsComplete: false,
    partsMistakes: null,
    flags: emptyFlags(),
  }
}

function merge(raw: unknown): Progress {
  const base = emptyProgress()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<Progress>
  return {
    ...base,
    ...data,
    version: 1,
    notes: { ...base.notes, ...(data.notes ?? {}) },
    sketches: { ...base.sketches, ...(data.sketches ?? {}) },
    recordedMags: { ...base.recordedMags, ...(data.recordedMags ?? {}) },
    trials: Array.isArray(data.trials) ? data.trials : [],
    flags: {
      ...base.flags,
      ...(data.flags ?? {}),
      specimenFocused: {
        ...base.flags.specimenFocused,
        ...(data.flags?.specimenFocused ?? {}),
      },
    },
  }
}

export const progress: Progress = load()

function load(): Progress {
  try {
    const text = localStorage.getItem(KEY)
    if (!text) return emptyProgress()
    return merge(JSON.parse(text) as unknown)
  } catch {
    return emptyProgress()
  }
}

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {
    // Quota or private mode: the session still works, notes may not survive reload.
  }
}

let timer = 0
export function persistSoon(): void {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => persist(), 200)
}

export function resetProgress(): void {
  const teacher = progress.teacher
  const next = emptyProgress()
  next.teacher = teacher
  Object.assign(progress, next)
  progress.notes = {}
  progress.sketches = {}
  progress.recordedMags = {}
  progress.trials = []
  progress.flags = emptyFlags()
  persist()
}

export function hasNote(id: SpecimenId): boolean {
  return (progress.notes[id] ?? '').trim().length >= 2
}

export function hasSketch(id: SpecimenId): boolean {
  return Boolean(progress.sketches[id])
}

export function hasMag(id: SpecimenId): boolean {
  return (progress.recordedMags[id]?.length ?? 0) > 0
}

export function expectationLabel(value: Expectation): string {
  if (value === 'none') return '幾乎不發霉'
  if (value === 'some') return '會有少許霉'
  return '會有很多霉'
}
