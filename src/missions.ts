import type { SpecimenId } from './types'
import { live, setTab } from './state'
import { hasMag, hasNote, hasSketch, persistSoon, progress, resetProgress } from './storage'
import { computeOptics, CONTROL, diffCount } from './science'
import { specimenName } from './specimens'

const SPECIMENS: SpecimenId[] = ['mould', 'yeast', 'bacteria', 'onion']

export function syncAchievements(): void {
  const optics = computeOptics({
    objective: live.objective,
    coarse: live.coarse,
    fine: live.fine,
    brightness: live.brightness,
    diaphragm: live.diaphragm,
    lightOn: live.lightOn,
  })
  const before = JSON.stringify(progress.flags)
  if (live.specimen) progress.flags.placedSlide = true
  if (live.lightOn) progress.flags.lightOn = true
  const lit = live.lightOn && optics.dim < 0.5 && optics.visibility > 0.35 && optics.wash < 0.62
  if (live.specimen && lit && optics.sharpness >= 0.9 && live.objective === 4) progress.flags.focused4 = true
  if (live.specimen && lit && optics.sharpness >= 0.9 && live.objective >= 10) progress.flags.focusedHigh = true
  if (live.specimen && lit && optics.sharpness >= 0.9) progress.flags.specimenFocused[live.specimen] = true
  if (live.specimen === 'bacteria' && live.objective === 40 && lit && optics.sharpness >= 0.88) {
    progress.flags.bacteriaFocused = true
  }
  if (JSON.stringify(progress.flags) !== before) {
    persistSoon()
  }
}

function starText(n: number): string {
  return `${'★'.repeat(n)}${'☆'.repeat(Math.max(0, 3 - n))}`
}

function specimenDone(id: SpecimenId): boolean {
  return progress.flags.specimenFocused[id] && (hasNote(id) || hasSketch(id)) && hasMag(id)
}

function hasFairComparison(): boolean {
  const trials = progress.trials
  for (let i = 0; i < trials.length; i += 1) {
    for (let j = i + 1; j < trials.length; j += 1) {
      if (diffCount(trials[i], trials[j]) === 1) return true
    }
  }
  return trials.some((trial) => diffCount(trial, CONTROL) === 1)
}

interface Mission {
  id: string
  title: string
  stars: number
  items: { label: string; done: boolean }[]
  goto: 'parts' | 'scope' | 'experiment'
}

function missions(): Mission[] {
  const observed = SPECIMENS.filter(specimenDone).length
  const observeStars = observed >= 4 ? 3 : observed === 3 ? 2 : observed >= 2 ? 1 : 0
  const operateDone =
    progress.flags.placedSlide && progress.flags.lightOn && progress.flags.focused4 && progress.flags.focusedHigh
  const operateStars = !operateDone ? 0 : progress.flags.usedCoarseAt40 ? 2 : 3
  const fair = hasFairComparison()
  const conclusionOk = progress.conclusion.trim().length >= 10
  const expItems = [
    progress.everPredicted,
    progress.trials.length >= 2,
    fair && progress.trials.length >= 2,
    conclusionOk,
  ]
  const expStars = expItems.every(Boolean) ? 3 : expItems.filter(Boolean).length >= 2 ? 1 : 0
  let partStars = 0
  if (progress.partsComplete && progress.partsMistakes !== null) {
    partStars = progress.partsMistakes <= 0 ? 3 : progress.partsMistakes <= 3 ? 2 : 1
  }
  return [
    {
      id: 'parts',
      title: '認識部件',
      stars: partStars,
      goto: 'parts',
      items: [{ label: '在小挑戰中找出全部 11 個部件', done: progress.partsComplete }],
    },
    {
      id: 'operate',
      title: '學會操作',
      stars: operateStars,
      goto: 'scope',
      items: [
        { label: '把玻片放到載物台', done: progress.flags.placedSlide },
        { label: '開啟光源', done: progress.flags.lightOn },
        { label: '在 4× 對焦到清晰', done: progress.flags.focused4 },
        { label: '在 10× 或 40× 看到清晰影像', done: progress.flags.focusedHigh },
      ],
    },
    {
      id: 'observe',
      title: '觀察四種標本',
      stars: observeStars,
      goto: 'scope',
      items: SPECIMENS.map((id) => ({
        label: `${specimenName(id)}：清晰觀察、筆記或素描，並記錄倍數`,
        done: specimenDone(id),
      })),
    },
    {
      id: 'bacteria',
      title: '高倍找細菌',
      stars: progress.flags.bacteriaFocused ? 3 : 0,
      goto: 'scope',
      items: [
        { label: '用 40× 物鏡（總放大 400×）把細菌對焦清晰', done: progress.flags.bacteriaFocused },
      ],
    },
    {
      id: 'exp',
      title: '公平測試',
      stars: expStars,
      goto: 'experiment',
      items: [
        { label: '觀察前先寫下預測', done: progress.everPredicted },
        { label: '至少記錄兩次結果', done: progress.trials.length >= 2 },
        { label: '其中有比較是只改變一個條件', done: fair && progress.trials.length >= 2 },
        { label: '寫下結論', done: conclusionOk },
      ],
    },
  ]
}

let openId: string | null = 'operate'
let sig = ''

export function updateMissions(slot: HTMLElement): void {
  if (live.teacher) {
    slot.hidden = true
    slot.innerHTML = ''
    sig = ''
    return
  }
  slot.hidden = false
  const list = missions()
  const doneCount = list.filter((mission) => mission.stars > 0).length
  const nextSig = JSON.stringify({ openId, list, doneCount })
  if (nextSig === sig) return
  sig = nextSig
  const detail = list.find((mission) => mission.id === openId)
  slot.innerHTML = `
    <div class="mission-bar" aria-label="學生任務">
      <p class="mission-count">任務 ${doneCount}/5</p>
      ${list
        .map(
          (mission) => `<button type="button" class="mission-chip ${mission.id === openId ? 'is-on' : ''}" data-mission="${mission.id}">
            ${mission.title} <span aria-label="${mission.stars} 粒星">${starText(mission.stars)}</span>
          </button>`,
        )
        .join('')}
    </div>
    ${
      detail
        ? `<div class="mission-detail card">
            <div class="notes-head">
              <h2>${detail.title}</h2>
              <button type="button" class="primary tiny" data-goto="${detail.goto}">前往</button>
            </div>
            <ul class="check-list">
              ${detail.items
                .map((item) => `<li class="${item.done ? 'done' : ''}">${item.label}</li>`)
                .join('')}
            </ul>
            <button type="button" class="ghost tiny" id="reset-progress">清除這部裝置上的學習紀錄</button>
          </div>`
        : ''
    }`
  slot.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.mission ?? null
      openId = openId === id ? null : id
      sig = ''
      updateMissions(slot)
    })
  })
  slot.querySelector('[data-goto]')?.addEventListener('click', () => {
    const dest = (slot.querySelector('[data-goto]') as HTMLElement | null)?.dataset.goto
    if (dest === 'parts' || dest === 'scope' || dest === 'experiment') setTab(dest)
  })
  slot.querySelector('#reset-progress')?.addEventListener('click', () => {
    const ok = window.confirm('清除這部裝置上的任務、筆記、畫板和實驗紀錄？')
    if (!ok) return
    resetProgress()
    live.specimen = null
    live.fromExperiment = false
    live.lightOn = false
    live.coarse = 22
    live.fine = 50
    live.objective = 4
    live.coarseWarn = false
    live.exp.started = false
    live.exp.day = 0
    live.exp.expectation = null
    sig = ''
    setTab(live.tab)
  })
}
