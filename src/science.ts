import type { Expectation, Objective, Setup } from './types'

/** Fixed school-microscope eyepiece. Total magnification = 10 × objective. */
export const EYEPIECE = 10

/** Teaching field diameter at the 40× objective, in micrometres. */
export const FIELD_UM_AT_40 = 200

export const FINE_WEIGHT = 0.2

export const CONTROL: Setup = {
  temp: 'room',
  moisture: 'wet',
  preservative: false,
}

export function totalMagnification(objective: Objective): number {
  return EYEPIECE * objective
}

export function fieldDiameterUm(objective: Objective): number {
  return FIELD_UM_AT_40 * (40 / objective)
}

export function fieldLabel(objective: Objective): string {
  const um = fieldDiameterUm(objective)
  if (um >= 1000) {
    const mm = um / 1000
    const text = mm >= 10 ? mm.toFixed(0) : mm.toFixed(1)
    return `約 ${text} 毫米`
  }
  return `約 ${Math.round(um)} 微米`
}

export function focusTarget(objective: Objective): number {
  if (objective === 4) return 50
  if (objective === 10) return 52.4
  return 54
}

export function depthOfField(objective: Objective): number {
  if (objective === 4) return 7
  if (objective === 10) return 1.6
  return 0.45
}

/** Coarse is 0–100. Fine is 0–100 and only nudges the focal plane. */
export function focusZ(coarse: number, fine: number): number {
  return coarse + (fine - 50) * FINE_WEIGHT
}

export function sharpnessOf(z: number, objective: Objective): number {
  const miss = Math.abs(z - focusTarget(objective))
  const dof = depthOfField(objective)
  if (miss <= dof) return 1
  const span = objective === 4 ? 18 : objective === 10 ? 6 : 1.15
  return Math.max(0, 1 - (miss - dof) / span)
}

export function optimalDiaphragm(objective: Objective): number {
  if (objective === 40) return 2
  if (objective === 10) return 3
  return 4
}

export interface Optics {
  totalMag: number
  fieldUm: number
  fieldText: string
  z: number
  sharpness: number
  /** Blur radius in CSS pixels. */
  blurCss: number
  visibility: number
  wash: number
  dim: number
  optimal: number
}

export function computeOptics(input: {
  objective: Objective
  coarse: number
  fine: number
  brightness: number
  diaphragm: number
  lightOn: boolean
}): Optics {
  const z = focusZ(input.coarse, input.fine)
  const sharpness = sharpnessOf(z, input.objective)
  const optimal = optimalDiaphragm(input.objective)
  let visibility = 0
  let wash = 0
  let dim = 1
  if (input.lightOn) {
    const lightLevel = (input.brightness / 100) * (0.42 + input.diaphragm * 0.12)
    visibility = Math.min(1, lightLevel * 1.25)
    dim = lightLevel < 0.38 ? (0.38 - lightLevel) / 0.38 : 0
    const openExcess = Math.max(0, input.diaphragm - optimal)
    wash = Math.min(0.72, openExcess * 0.2 + (input.brightness > 85 && openExcess > 0 ? 0.1 : 0))
  }
  return {
    totalMag: totalMagnification(input.objective),
    fieldUm: fieldDiameterUm(input.objective),
    fieldText: fieldLabel(input.objective),
    z,
    sharpness,
    blurCss: sharpness > 0.94 ? 0 : (1 - sharpness) * 16,
    visibility,
    wash,
    dim,
    optimal,
  }
}

/**
 * Qualitative bread-mould model for P5.
 * Moist, warm bread without preservative moulds fastest.
 * Cold, dry, or preservative-treated bread moulds slowly.
 * Day 0–1 is a lag (little or no visible mould).
 * Score is capped at 10.
 */
export function mouldScore(temp: Setup['temp'], moisture: Setup['moisture'], preservative: boolean, day: number): number {
  const d = Math.max(0, Math.min(7, day))
  if (d <= 0) return 0
  const moistureFactor = moisture === 'wet' ? 1.25 : 0.07
  const tempFactor = temp === 'cold' ? 0.18 : temp === 'room' ? 0.72 : 1.2
  const presFactor = preservative ? 0.2 : 1
  const lag = Math.max(0, d - 1)
  const raw = moistureFactor * tempFactor * presFactor * lag * 1.55
  return Math.round(Math.min(10, raw) * 10) / 10
}

export function describeMould(score: number): string {
  if (score < 0.5) return '幾乎沒有'
  if (score < 2) return '很少'
  if (score < 4.5) return '少許'
  if (score < 7.5) return '明顯'
  return '很多'
}

export function expectationMatches(expectation: Expectation, score: number): boolean {
  if (expectation === 'none') return score < 2
  if (expectation === 'some') return score >= 2 && score < 6.5
  return score >= 6.5
}

export function diffCount(a: Setup, b: Setup): number {
  let n = 0
  if (a.temp !== b.temp) n += 1
  if (a.moisture !== b.moisture) n += 1
  if (a.preservative !== b.preservative) n += 1
  return n
}

export function densityFromScore(score: number): number {
  return Math.max(0, Math.min(1, score / 8))
}

export function tempLabel(temp: Setup['temp']): string {
  if (temp === 'cold') return '冷'
  if (temp === 'room') return '室溫'
  return '暖'
}

export function moistureLabel(moisture: Setup['moisture']): string {
  return moisture === 'wet' ? '濕' : '乾'
}

export function presLabel(preservative: boolean): string {
  return preservative ? '有防腐劑' : '沒有防腐劑'
}

export function setupLabel(setup: Setup): string {
  return `${tempLabel(setup.temp)} · ${moistureLabel(setup.moisture)} · ${presLabel(setup.preservative)}`
}
