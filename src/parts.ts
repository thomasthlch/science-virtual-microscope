import type { PartId } from './types'
import { live, emit } from './state'
import { persist, progress } from './storage'

export interface PartInfo {
  id: PartId
  name: string
  blurb: string
  hint: string
}

export const PARTS: PartInfo[] = [
  {
    id: 'eyepiece',
    name: '目鏡',
    blurb: '眼睛靠近這裏觀察。目鏡把物鏡造成的影像再放大。這部顯微鏡的目鏡是 10×，總放大倍數＝目鏡倍數 × 物鏡倍數。',
    hint: '在整部顯微鏡的最上方。',
  },
  {
    id: 'objective',
    name: '物鏡',
    blurb: '最接近玻片的鏡頭，負責第一步放大。有 4×（低倍）、10×（中倍）和 40×（高倍）。倍數越高，看到的範圍越小，細節越大。',
    hint: '在載物台上方、朝向玻片的鏡頭。',
  },
  {
    id: 'nosepiece',
    name: '物鏡轉換器',
    blurb: '用來轉動並轉換物鏡的圓盤。應握住轉換器轉動，聽到「咔」一聲才算到位，不要只扭鏡頭本身。',
    hint: '物鏡上方可以轉動的圓盤。',
  },
  {
    id: 'stage',
    name: '載物台',
    blurb: '放置玻片的平台。中央有一個孔，讓光線穿過標本，再進入物鏡。',
    hint: '中間有孔、用來放玻片的平台。',
  },
  {
    id: 'clips',
    name: '壓片夾',
    blurb: '把玻片固定在載物台上，避免你移動視野或調焦時玻片滑走。',
    hint: '在載物台上、用來夾住玻片的金屬夾。',
  },
  {
    id: 'coarse',
    name: '粗調焦輪',
    blurb: '較大的旋鈕。轉動時，鏡筒和玻片的距離改變得比較多，用來盡快找到影像。只適宜在低倍物鏡（4×）使用。',
    hint: '鏡臂側面較大的旋鈕。',
  },
  {
    id: 'fine',
    name: '細調焦輪',
    blurb: '較小的旋鈕，只作輕微調節，使影像更清晰。使用 10× 或 40× 時應只用細調焦輪，以免鏡頭壓破玻片。',
    hint: '靠近粗調焦輪、比較小的旋鈕。',
  },
  {
    id: 'diaphragm',
    name: '光圈／聚光器',
    blurb: '聚光器把光線集中到標本上，光圈則控制光孔大小。光太強，影像會發白；光太弱，又會看不清楚。',
    hint: '在載物台下方、光源上方。',
  },
  {
    id: 'light',
    name: '光源／反光鏡',
    blurb: '用來照亮標本。新式顯微鏡多用電燈，舊式則用反光鏡把光線反射到載物台。用完記得關掉光源。',
    hint: '靠近鏡座、向上發光的部分。',
  },
  {
    id: 'arm',
    name: '鏡臂',
    blurb: '連接上方鏡筒和鏡座的彎曲部分。搬動顯微鏡時，一手握緊鏡臂。',
    hint: '背面彎曲、連接上下的部分。',
  },
  {
    id: 'base',
    name: '鏡座',
    blurb: '顯微鏡最底部，支承整部儀器。搬動時另一手托着鏡座，並保持鏡身垂直。',
    hint: '最底部、支承全機的座。',
  },
]

const byId = new Map(PARTS.map((part) => [part.id, part]))

export function partInfo(id: PartId): PartInfo {
  return byId.get(id) ?? PARTS[0]
}

function shuffle<T>(list: T[]): T[] {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = next[i]
    next[i] = next[j]
    next[j] = swap
  }
  return next
}

const SVG = `
<svg class="microscope-svg" viewBox="0 0 480 760" role="img" aria-label="複式光學顯微鏡">
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7fbfc"/>
      <stop offset="0.5" stop-color="#d5dee2"/>
      <stop offset="1" stop-color="#b7c3c8"/>
    </linearGradient>
  </defs>
  <ellipse cx="230" cy="728" rx="170" ry="12" fill="rgba(16,40,40,0.12)"/>
  <g class="part" data-part="base">
    <path class="hit" d="M40 650 H400 L450 700 Q460 724 420 732 H70 Q30 724 40 650Z"/>
    <path class="body base-body" d="M58 656 H392 L430 700 Q438 718 404 722 H78 Q48 718 58 656Z"/>
    <rect x="150" y="678" width="120" height="14" rx="3" fill="#8fd0c8" opacity="0.35"/>
  </g>
  <g class="part" data-part="arm">
    <path class="hit" d="M300 120 H430 V630 H330 V250 H318 C318 180 310 140 300 120Z"/>
    <path class="body arm-body" d="M318 150
      H372
      C398 150 404 168 404 196
      V548
      C404 586 382 608 348 614
      H330
      V548
      H368
      C380 548 382 536 382 524
      V200
      C382 176 368 166 346 166
      H330Z"/>
  </g>
  <g class="part" data-part="light">
    <circle class="hit" cx="214" cy="560" r="62"/>
    <rect class="body light-house" x="164" y="520" width="100" height="86" rx="18"/>
    <circle class="bulb" cx="214" cy="556" r="28"/>
    <circle cx="206" cy="546" r="8" fill="#fff" opacity="0.75"/>
  </g>
  <g class="part" data-part="diaphragm">
    <path class="hit" d="M160 390 H280 V500 H160Z"/>
    <path class="body condenser" d="M176 430 L214 500 L252 430Z"/>
    <rect class="body diaphragm-ring" x="184" y="392" width="60" height="30" rx="10"/>
    <circle cx="214" cy="407" r="7" fill="#14181a"/>
  </g>
  <g class="part" data-part="stage">
    <rect class="hit" x="70" y="346" width="250" height="52" rx="8"/>
    <rect class="body stage-body" x="78" y="356" width="230" height="24" rx="3"/>
    <rect x="190" y="356" width="48" height="24" fill="#121416"/>
  </g>
  <g class="decor">
    <rect x="132" y="344" width="150" height="14" rx="2" fill="rgba(214,236,245,0.92)" stroke="#9ec3d4"/>
  </g>
  <g class="part" data-part="clips">
    <rect class="hit" x="90" y="300" width="250" height="52"/>
    <path class="body clip" d="M118 356 C132 318 176 314 196 346" fill="none"/>
    <path class="body clip" d="M300 356 C286 318 242 314 222 346" fill="none"/>
  </g>
  <g class="decor tube-decor">
    <rect x="190" y="86" width="48" height="130" rx="8" fill="url(#metal)"/>
  </g>
  <g class="part" data-part="eyepiece">
    <rect class="hit" x="150" y="8" width="130" height="92"/>
    <rect class="body ocular" x="176" y="40" width="76" height="58" rx="12"/>
    <rect x="190" y="16" width="48" height="30" rx="10" fill="#1a1d1f"/>
    <ellipse cx="214" cy="24" rx="14" ry="5" fill="#9fd7ff" opacity="0.45"/>
  </g>
  <g class="part" data-part="nosepiece">
    <ellipse class="hit" cx="214" cy="220" rx="78" ry="26"/>
    <ellipse class="body nose" cx="214" cy="224" rx="70" ry="24"/>
    <ellipse cx="214" cy="216" rx="42" ry="10" fill="#f4f8f8" opacity="0.55"/>
  </g>
  <g class="part" data-part="objective">
    <rect class="hit" x="148" y="248" width="130" height="92"/>
    <g>
      <rect class="body obj" x="156" y="246" width="26" height="46" rx="5"/>
      <rect x="160" y="274" width="18" height="8" fill="#22282b"/>
      <text class="lens-text" x="169" y="268" text-anchor="middle">4×</text>
    </g>
    <g>
      <rect class="body obj obj-mid" x="198" y="242" width="30" height="78" rx="5"/>
      <rect x="203" y="296" width="20" height="10" fill="#22282b"/>
      <text class="lens-text" x="213" y="270" text-anchor="middle">10×</text>
    </g>
    <g>
      <rect class="body obj" x="242" y="246" width="22" height="64" rx="5"/>
      <rect x="245" y="290" width="16" height="8" fill="#22282b"/>
      <text class="lens-text" x="253" y="268" text-anchor="middle">40×</text>
    </g>
  </g>
  <g class="part" data-part="coarse">
    <circle class="hit" cx="404" cy="286" r="58"/>
    <circle class="body knob-big" cx="404" cy="286" r="40"/>
    <circle cx="404" cy="286" r="26" fill="none" stroke="#aeb6ba" stroke-width="7"/>
    <line x1="404" y1="252" x2="404" y2="272" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  </g>
  <g class="part" data-part="fine">
    <circle class="hit" cx="430" cy="372" r="44"/>
    <circle class="body knob-small" cx="430" cy="372" r="24"/>
    <line x1="430" y1="352" x2="430" y2="364" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  </g>
</svg>`

function starsForMistakes(mistakes: number): number {
  if (mistakes <= 0) return 3
  if (mistakes <= 3) return 2
  return 1
}

function starText(n: number): string {
  return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`
}

function onPick(id: PartId, root: HTMLElement): void {
  const challenge = live.challenge
  if (challenge && !challenge.done) {
    const expected = challenge.order[challenge.index]
    if (id === expected) {
      challenge.lastCorrect = id
      challenge.wrongStreak = 0
      challenge.index += 1
      live.selectedPart = id
      if (challenge.index >= challenge.order.length) {
        challenge.done = true
        progress.partsComplete = true
        if (progress.partsMistakes === null || challenge.mistakes < progress.partsMistakes) {
          progress.partsMistakes = challenge.mistakes
        }
        persist()
      }
    } else {
      challenge.mistakes += 1
      challenge.wrongStreak += 1
      challenge.lastCorrect = null
      root.querySelector('.diagram-wrap')?.classList.add('shake')
      window.setTimeout(() => root.querySelector('.diagram-wrap')?.classList.remove('shake'), 450)
    }
    emit()
    return
  }
  live.selectedPart = id
  emit()
}

let cardSig = ''

export function mountParts(root: HTMLElement): void {
  const tags = PARTS.map((part) => {
    const pos = tagPosition(part.id)
    return `<button type="button" class="tag" data-part="${part.id}" style="--x:${pos.x};--y:${pos.y}">${part.name}</button>`
  }).join('')

  root.innerHTML = `
    <div class="parts-layout">
      <div class="diagram-column card">
        <p class="lead">按顯微鏡上的部件或旁邊的名稱，認識它的功能。課堂搬動顯微鏡時，要一手握鏡臂、一手托鏡座。</p>
        <div class="diagram-wrap">
          ${SVG}
          <div class="tag-layer">${tags}</div>
        </div>
      </div>
      <aside class="part-card card" id="part-card"></aside>
    </div>`

  root.querySelectorAll('.microscope-svg .part').forEach((el) => {
    const id = el.getAttribute('data-part') as PartId
    el.setAttribute('tabindex', '0')
    el.setAttribute('role', 'button')
    el.setAttribute('aria-label', partInfo(id).name)
  })

  root.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest('[data-part]')
    if (!target || !root.contains(target)) return
    const id = target.getAttribute('data-part') as PartId | null
    if (!id || !byId.has(id)) return
    onPick(id, root)
  })

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = (event.target as Element | null)?.closest('[data-part]')
    if (!target) return
    event.preventDefault()
    const id = target.getAttribute('data-part') as PartId | null
    if (!id) return
    onPick(id, root)
  })
}

function tagPosition(id: PartId): { x: string; y: string } {
  const map: Record<PartId, { x: string; y: string }> = {
    eyepiece: { x: '18%', y: '6%' },
    nosepiece: { x: '16%', y: '30%' },
    objective: { x: '14%', y: '40%' },
    clips: { x: '78%', y: '43%' },
    stage: { x: '12%', y: '50%' },
    diaphragm: { x: '20%', y: '60%' },
    coarse: { x: '84%', y: '33%' },
    fine: { x: '88%', y: '49%' },
    arm: { x: '86%', y: '64%' },
    light: { x: '22%', y: '74%' },
    base: { x: '46%', y: '94%' },
  }
  return map[id]
}

export function updateParts(root: HTMLElement): void {
  const selected = live.selectedPart
  root.querySelectorAll('[data-part]').forEach((node) => {
    const on = node.getAttribute('data-part') === selected
    node.classList.toggle('is-selected', on)
    if (node.classList.contains('tag')) node.setAttribute('aria-pressed', on ? 'true' : 'false')
  })
  root.querySelector('.diagram-wrap')?.classList.toggle('is-challenge', Boolean(live.challenge && !live.challenge.done))

  const challenge = live.challenge
  const sig = JSON.stringify({
    selected,
    active: Boolean(challenge),
    index: challenge?.index ?? -1,
    mistakes: challenge?.mistakes ?? 0,
    done: challenge?.done ?? false,
    wrong: challenge?.wrongStreak ?? 0,
    best: progress.partsMistakes,
    complete: progress.partsComplete,
    last: challenge?.lastCorrect ?? null,
  })
  if (sig === cardSig) return
  cardSig = sig

  const card = root.querySelector('#part-card')
  if (!card) return
  card.innerHTML = renderCard()
  card.querySelector('[data-action="start"]')?.addEventListener('click', () => {
    live.challenge = {
      order: shuffle(PARTS.map((part) => part.id)),
      index: 0,
      mistakes: 0,
      wrongStreak: 0,
      done: false,
      lastCorrect: null,
    }
    cardSig = ''
    emit()
  })
  card.querySelector('[data-action="stop"]')?.addEventListener('click', () => {
    live.challenge = null
    cardSig = ''
    emit()
  })
}

function renderCard(): string {
  const challenge = live.challenge
  if (challenge?.done) {
    const mistakes = challenge.mistakes
    const stars = starsForMistakes(mistakes)
    const best = progress.partsMistakes === null ? stars : starsForMistakes(progress.partsMistakes)
    return `
      <p class="kicker">部件小挑戰</p>
      <h2>完成了</h2>
      <p class="star-row" aria-label="${stars} 粒星">${starText(stars)}</p>
      <p>今次找錯 ${mistakes} 次。${mistakes === 0 ? '全部一次找對，很好。' : '可以再看一看位置，然後再練一次。'}</p>
      <p class="muted">最佳成績：${starText(best)}</p>
      <div class="button-row">
        <button type="button" class="primary" data-action="start">再練一次</button>
        <button type="button" class="ghost" data-action="stop">返回認識部件</button>
      </div>`
  }
  if (challenge) {
    const current = partInfo(challenge.order[challenge.index])
    const correct = challenge.lastCorrect ? partInfo(challenge.lastCorrect) : null
    const showHint = challenge.wrongStreak >= 2
    return `
      <p class="kicker">部件小挑戰 · 第 ${challenge.index + 1}／${challenge.order.length} 題</p>
      <h2>請按出：${current.name}</h2>
      <p>在左方的顯微鏡圖上按正確的部分。名稱標籤已隱藏。</p>
      ${correct ? `<p class="good-note">正確。${correct.name}：${correct.blurb}</p>` : ''}
      ${showHint ? `<p class="hint-note">提示：${current.hint}</p>` : ''}
      <p class="muted">找錯次數：${challenge.mistakes}</p>
      <button type="button" class="ghost" data-action="stop">離開挑戰</button>`
  }

  const part = partInfo(live.selectedPart)
  const best =
    progress.partsComplete && progress.partsMistakes !== null
      ? `<p class="muted">小挑戰最佳成績：${starText(starsForMistakes(progress.partsMistakes))}</p>`
      : ''
  return `
    <p class="kicker">部件功能</p>
    <h2>${part.name}</h2>
    <p>${part.blurb}</p>
    <p class="hint-note">位置：${part.hint}</p>
    ${best}
    <button type="button" class="primary" data-action="start">開始部件小挑戰</button>
    <p class="muted">小挑戰會隱藏名稱，請靠形狀和位置找出 11 個部件。</p>`
}

export function partsStars(): number {
  if (!progress.partsComplete || progress.partsMistakes === null) return 0
  return starsForMistakes(progress.partsMistakes)
}
