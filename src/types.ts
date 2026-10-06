export type Objective = 4 | 10 | 40

export type SpecimenId = 'mould' | 'yeast' | 'bacteria' | 'onion'

export type PartId =
  | 'eyepiece'
  | 'objective'
  | 'nosepiece'
  | 'stage'
  | 'clips'
  | 'coarse'
  | 'fine'
  | 'diaphragm'
  | 'light'
  | 'arm'
  | 'base'

export type Temp = 'cold' | 'room' | 'warm'
export type Moisture = 'dry' | 'wet'
export type Expectation = 'none' | 'some' | 'lots'

export type TabId = 'parts' | 'scope' | 'experiment'

export interface Trial {
  id: string
  temp: Temp
  moisture: Moisture
  preservative: boolean
  day: number
  score: number
  expectation: Expectation | null
}

export interface Setup {
  temp: Temp
  moisture: Moisture
  preservative: boolean
}
