import {
  CONTROL,
  computeOptics,
  describeMould,
  diffCount,
  fieldDiameterUm,
  focusZ,
  mouldScore,
  sharpnessOf,
  totalMagnification,
} from '../src/science.ts'

let failed = 0

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  }
}

assert(totalMagnification(4) === 40, '4× objective is 40× total')
assert(totalMagnification(10) === 100, '10× objective is 100× total')
assert(totalMagnification(40) === 400, '40× objective is 400× total')
assert(fieldDiameterUm(4) > fieldDiameterUm(10), 'field shrinks from 4× to 10×')
assert(fieldDiameterUm(10) > fieldDiameterUm(40), 'field shrinks from 10× to 40×')

const blurry = sharpnessOf(focusZ(22, 50), 4)
const sharpLow = sharpnessOf(focusZ(50, 50), 4)
const softHigh = sharpnessOf(focusZ(50, 50), 40)
const sharpHigh = sharpnessOf(focusZ(50, 66), 40)
assert(blurry < 0.2, `starting coarse focus is blurry (${blurry})`)
assert(sharpLow === 1, 'coarse focus can sharpen the 4× view')
assert(softHigh < 0.05, `40× stays blurry if only low-power focus was used (${softHigh})`)
assert(sharpHigh === 1, 'fine focus can sharpen 40×')

const warm = mouldScore('warm', 'wet', false, 7)
const room = mouldScore('room', 'wet', false, 7)
const cold = mouldScore('cold', 'wet', false, 7)
const dry = mouldScore('warm', 'dry', false, 7)
const preserved = mouldScore('warm', 'wet', true, 7)
assert(mouldScore('room', 'wet', false, 0) === 0, 'day 0 has no mould')
assert(mouldScore('warm', 'wet', false, 1) === 0, 'day 1 is still in the lag')
assert(warm > room && room > cold, `warm > room > cold (${warm}, ${room}, ${cold})`)
assert(warm > dry, `moisture matters (${warm} vs ${dry})`)
assert(warm > preserved, `preservative slows mould (${warm} vs ${preserved})`)
assert(describeMould(warm) === '很多', 'heavy growth reads as 很多')
assert(describeMould(dry) === '幾乎沒有' || describeMould(dry) === '很少', 'dry bread barely moulds')

assert(diffCount({ temp: 'cold', moisture: 'wet', preservative: false }, CONTROL) === 1, 'one changed condition')
assert(diffCount({ temp: 'cold', moisture: 'dry', preservative: true }, CONTROL) === 3, 'three changed conditions')
assert(diffCount(CONTROL, CONTROL) === 0, 'control matches itself')

const optics = computeOptics({
  objective: 40,
  coarse: 50,
  fine: 66,
  brightness: 70,
  diaphragm: 4,
  lightOn: true,
})
assert(optics.totalMag === 400, 'optics total mag')
assert(optics.sharpness === 1, 'optics sharpness')
assert(optics.wash > 0.2, 'diaphragm too open at 40× washes the image')

if (failed > 0) {
  console.error(`${failed} check(s) failed`)
  process.exit(1)
}
console.log('science checks passed', { warm, room, cold, dry, preserved, blurry, softHigh })
