import type { Objective, SpecimenId } from './types'
import { live, emit } from './state'
import { persistSoon, progress } from './storage'
import { computeOptics, fieldDiameterUm } from './science'
import { drawSpecimen, specimenBlurb, specimenName } from './specimens'
import { toast } from './toast'

const SPECIMENS: SpecimenId[] = ['mould', 'yeast', 'bacteria', 'onion']

let lensCanvas: HTMLCanvasElement | null = null
let scheduled = false
let dirTimer = 0

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function opticsNow() {
  return computeOptics({
    objective: live.objective,
    coarse: live.coarse,
    fine: live.fine,
    brightness: live.brightness,
    diaphragm: live.diaphragm,
    lightOn: live.lightOn,
  })
}

function setCoarse(value: number): void {
  const next = clamp(value, 0, 100)
  if (live.objective === 40 && Math.abs(next - live.coarse) > 0.04) {
    live.coarseWarn = true
    progress.flags.usedCoarseAt40 = true
    persistSoon()
  }
  live.coarse = next
  emit()
}

function setFine(value: number): void {
  live.fine = clamp(value, 0, 100)
  emit()
}

function panBy(dx: number, dy: number): void {
  if (!live.specimen || !lensCanvas || lensCanvas.clientWidth < 20) return
  const cssPx = lensCanvas.clientWidth / fieldDiameterUm(live.objective)
  live.sampleX = clamp(live.sampleX - dx / cssPx, -900, 900)
  live.sampleY = clamp(live.sampleY - dy / cssPx, -900, 900)
  emit()
}

function showDirection(dx: number, dy: number): void {
  const el = document.getElementById('drag-dir')
  if (!el) return
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  let text = '移動玻片時，影像會向相反方向移動。'
  if (dx !== 0 || dy !== 0) {
    if (horizontal) {
      text = dx > 0 ? '玻片向右 →　　影像向左 ←' : '玻片向左 ←　　影像向右 →'
    } else {
      text = dy > 0 ? '玻片向下 ↓　　影像向上 ↑' : '玻片向上 ↑　　影像向下 ↓'
    }
  }
  el.textContent = text
  el.classList.add('show')
  window.clearTimeout(dirTimer)
  dirTimer = window.setTimeout(() => el.classList.remove('show'), 1600)
}

function bindDrag(el: HTMLElement): void {
  let dragging = false
  let lastX = 0
  let lastY = 0
  el.addEventListener('pointerdown', (event) => {
    if (!live.specimen) return
    dragging = true
    lastX = event.clientX
    lastY = event.clientY
    el.setPointerCapture(event.pointerId)
    el.classList.add('is-grabbing')
  })
  el.addEventListener('pointermove', (event) => {
    if (!dragging) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    if (dx === 0 && dy === 0) return
    panBy(dx, dy)
    showDirection(dx, dy)
  })
  const end = () => {
    dragging = false
    el.classList.remove('is-grabbing')
  }
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
}

function bindKnob(el: HTMLElement, kind: 'coarse' | 'fine'): void {
  const face = el.querySelector('.knob-face') as HTMLElement
  let startY = 0
  let start = 0
  face.addEventListener('pointerdown', (event) => {
    face.setPointerCapture(event.pointerId)
    startY = event.clientY
    start = kind === 'coarse' ? live.coarse : live.fine
    const move = (ev: PointerEvent) => {
      const delta = (startY - ev.clientY) * (kind === 'coarse' ? 0.16 : 0.2)
      if (kind === 'coarse') setCoarse(start + delta)
      else setFine(start + delta)
    }
    const up = () => {
      face.removeEventListener('pointermove', move)
      face.removeEventListener('pointerup', up)
      face.removeEventListener('pointercancel', up)
    }
    face.addEventListener('pointermove', move)
    face.addEventListener('pointerup', up)
    face.addEventListener('pointercancel', up)
  })
  face.addEventListener('keydown', (event) => {
    const step = kind === 'coarse' ? 4 : 3
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      if (kind === 'coarse') setCoarse(live.coarse + step)
      else setFine(live.fine + step)
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      if (kind === 'coarse') setCoarse(live.coarse - step)
      else setFine(live.fine - step)
    }
  })
  el.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const dir = Number(button.dataset.step)
      if (kind === 'coarse') setCoarse(live.coarse + dir * 4)
      else setFine(live.fine + dir * 3)
    })
  })
}

function hintText(): string {
  const optics = opticsNow()
  if (live.fromExperiment && live.specimen === 'mould') {
    if (live.mouldDensity < 0.08 && optics.sharpness > 0.85 && live.lightOn) {
      return '這是實驗麵包的玻片。幾乎找不到菌絲，因為這個環境不大適合霉菌生長。'
    }
  }
  if (!live.specimen) return '第一步：選擇一種標本，按「放到載物台」。壓片夾會把玻片夾穩。'
  if (!live.lightOn) return '玻片已放好。請開啟光源，否則視野是黑的。'
  if (live.objective !== 4 && !progress.flags.focused4) {
    return '建議先轉回 4× 低倍物鏡。用粗調焦輪找到影像，對準想看的位置，才轉高倍。'
  }
  if (optics.dim > 0.45) return '光線太暗。可增加亮度，或把光圈開大一點。'
  if (optics.wash > 0.34) return '光線太強，影像發白。試試收細光圈，或降低亮度。'
  if (live.specimen === 'bacteria' && live.objective < 40) {
    return '細菌比酵母菌細小得多。4× 和 10× 通常看不清細胞，請轉到 40×，再用細調焦輪對焦。'
  }
  if (optics.sharpness < 0.55) {
    if (live.objective === 4) return '影像仍然模糊。慢慢轉動粗調焦輪，直至看到輪廓，再用細調焦輪調清楚。'
    return '高倍影像很模糊。請只用細調焦輪。如果完全找不到，轉回 4× 重新對焦。'
  }
  if (optics.sharpness < 0.92) return '已經大致看到了。再用細調焦輪輕輕調，直到最清晰。'
  if (live.specimen === 'mould') {
    return live.fromExperiment
      ? '這是實驗麵包的玻片。找出絲狀菌絲和深色孢子囊。生長較多的麵包，視野裏的霉會較密。'
      : '影像清晰。找出絲狀的菌絲，以及頂端深色的孢子囊。倍數越高，越容易看見散出的孢子。'
  }
  if (live.specimen === 'yeast') return '影像清晰。酵母菌是橢圓形單細胞，留意旁邊有沒有長出小芽（出芽）。'
  if (live.specimen === 'bacteria') return '影像清晰。這些短棒狀的是細菌，比酵母菌小很多；視野也比低倍時窄。'
  return '影像清晰。洋蔥表皮細胞像長方形砌在一起，有細胞壁和細胞核。它們比微生物大。'
}

function sharpWord(): string {
  if (!live.specimen) return '未放玻片'
  if (!live.lightOn) return '沒有光線'
  const optics = opticsNow()
  if (optics.dim > 0.55) return '太暗'
  if (optics.wash > 0.45) return '發白'
  if (optics.sharpness > 0.9) return '清晰'
  if (optics.sharpness > 0.55) return '略為模糊'
  return '模糊'
}

function drawLens(): void {
  const canvas = lensCanvas
  if (!canvas) return
  const cssW = canvas.clientWidth
  const cssH = canvas.clientHeight
  if (cssW < 20 || cssH < 20) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.round(cssW * dpr)
  const h = Math.round(cssH * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const optics = opticsNow()
  const cx = w / 2
  const cy = h / 2
  const radius = Math.min(w, h) / 2 - dpr
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#070808'
  ctx.fillRect(0, 0, w, h)

  if (live.lightOn && live.specimen) {
    const pxPerUm = w / optics.fieldUm
    ctx.save()
    ctx.globalAlpha = Math.max(0.12, Math.min(1, 0.22 + optics.visibility * 0.9))
    if (optics.blurCss > 0.35) {
      const contrast = (0.7 + optics.sharpness * 0.3).toFixed(3)
      ctx.filter = `blur(${(optics.blurCss * dpr).toFixed(2)}px) contrast(${contrast})`
    }
    ctx.translate(cx, cy)
    ctx.scale(-pxPerUm, -pxPerUm)
    ctx.translate(-live.sampleX, -live.sampleY)
    drawSpecimen(
      ctx,
      live.specimen,
      live.sampleX,
      live.sampleY,
      optics.fieldUm / 2,
      pxPerUm,
      live.objective,
      live.mouldDensity,
    )
    ctx.restore()
    if (optics.wash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${optics.wash})`
      ctx.fillRect(0, 0, w, h)
    }
    if (optics.dim > 0.02) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.92, optics.dim)})`
      ctx.fillRect(0, 0, w, h)
    }
  } else if (live.lightOn) {
    const bright = 0.28 + (live.brightness / 100) * 0.62
    ctx.fillStyle = `rgba(255, 236, 196, ${bright})`
    ctx.fillRect(0, 0, w, h)
    if (optics.dim > 0.02) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.9, optics.dim)})`
      ctx.fillRect(0, 0, w, h)
    }
  }

  const vignette = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.52)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)
  ctx.restore()

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 2.2 * dpr
  ctx.arc(cx - radius * 0.34, cy - radius * 0.36, radius * 0.2, Math.PI * 0.9, Math.PI * 1.7)
  ctx.stroke()
}

function requestDraw(): void {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    drawLens()
  })
}

function placeSpecimen(id: SpecimenId): void {
  live.specimen = id
  live.sampleX = 0
  live.sampleY = 0
  live.mouldDensity = 0.85
  live.fromExperiment = false
  progress.flags.placedSlide = true
  persistSoon()
  emit()
}

let sketchCtx: CanvasRenderingContext2D | null = null
let sketchCanvas: HTMLCanvasElement | null = null
let pen = '#1c1c1c'
let erasing = false

function blankSketch(): void {
  if (!sketchCtx || !sketchCanvas) return
  sketchCtx.fillStyle = '#fffaf0'
  sketchCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height)
}

function loadSketch(id: SpecimenId): void {
  blankSketch()
  const url = progress.sketches[id]
  if (!url || !sketchCtx || !sketchCanvas) return
  const image = new Image()
  image.onload = () => {
    if (live.specimen !== id || !sketchCtx || !sketchCanvas) return
    sketchCtx.drawImage(image, 0, 0, sketchCanvas.width, sketchCanvas.height)
  }
  image.src = url
}

function formatMags(id: SpecimenId | null): string {
  if (!id) return '尚未記錄'
  const list = progress.recordedMags[id] ?? []
  if (!list.length) return '尚未記錄。對焦後可按「記錄現時放大倍數」。'
  return list.map((mag) => `${mag}×`).join('、')
}

export function mountScope(root: HTMLElement): void {
  const specimenButtons = SPECIMENS.map((id) => {
    return `<button type="button" class="specimen-btn" data-specimen="${id}">
      <span class="specimen-name">${specimenName(id)}</span>
      <span class="specimen-sub">${id === 'onion' ? '用來比較的植物細胞' : id === 'bacteria' ? '要高倍才看得見' : id === 'yeast' ? '單細胞，會出芽' : '菌絲和孢子'}</span>
    </button>`
  }).join('')

  root.innerHTML = `
    <div class="scope-layout">
      <section class="card scope-specimens">
        <h2>選擇玻片</h2>
        <div class="specimen-list">${specimenButtons}</div>
        <button type="button" class="ghost" id="remove-slide">取下玻片</button>
        <p class="blurb" id="specimen-blurb">選擇標本後，玻片會放到載物台，並由壓片夾固定。</p>
        <ol class="steps" id="step-list">
          <li data-step="slide">1. 放玻片</li>
          <li data-step="light">2. 開啟光源</li>
          <li data-step="low">3. 低倍對焦</li>
          <li data-step="glow">4. 調校光線</li>
          <li data-step="high">5. 高倍細調</li>
        </ol>
      </section>
      <section class="scope-center card">
        <div class="lens-stage">
          <div class="lens-wrap" id="lens-wrap">
            <canvas id="lens" aria-label="目鏡視野"></canvas>
            <p class="lens-message" id="lens-msg"></p>
          </div>
          <p class="drag-dir" id="drag-dir">移動玻片時，影像會向相反方向移動。</p>
          <div class="stage-demo" id="stage-demo">
            <div class="stage-hole" id="stage-hole"></div>
            <div class="clip-visual left"></div>
            <div class="clip-visual right"></div>
            <div class="glass-slide" id="glass-slide">尚未放上玻片</div>
          </div>
          <div class="nudge" aria-label="移動玻片">
            <button type="button" data-pan="0,-36">玻片向上</button>
            <button type="button" data-pan="-36,0">玻片向左</button>
            <button type="button" data-pan="36,0">玻片向右</button>
            <button type="button" data-pan="0,36">玻片向下</button>
          </div>
        </div>
        <div class="meter-row">
          <span>模糊</span>
          <div class="meter-track" aria-hidden="true"><div id="sharp-fill"></div></div>
          <span>清晰</span>
          <strong id="sharp-word">未放玻片</strong>
        </div>
        <p class="hint-box" id="scope-hint" aria-live="polite"></p>
        <p class="static-tip">先用低倍尋找影像。粗調焦輪只在 4× 使用。40× 時如果用粗調焦輪，鏡頭可能壓破玻片。</p>
      </section>
      <section class="card scope-controls">
        <div class="mag-hero" aria-live="polite">
          <p id="mag-formula">目鏡 10× × 物鏡 4×</p>
          <p id="mag-total">40×</p>
          <p id="field-label">視野闊度</p>
        </div>
        <button type="button" class="light-switch" id="light-switch" aria-pressed="false">開啟光源</button>
        <label class="slider-label">亮度
          <input id="brightness" type="range" min="0" max="100" value="72" />
        </label>
        <div>
          <p class="control-label">光圈（1 最細，5 最開）</p>
          <div class="seg" id="diaphragm-seg">
            ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-diaphragm="${n}">${n}</button>`).join('')}
          </div>
        </div>
        <div>
          <p class="control-label">物鏡</p>
          <div class="seg objectives" id="objective-seg">
            <button type="button" data-objective="4">4×<small>低倍</small></button>
            <button type="button" data-objective="10">10×<small>中倍</small></button>
            <button type="button" data-objective="40">40×<small>高倍</small></button>
          </div>
        </div>
        <div class="knob-row">
          <div class="knob-block" data-kind="coarse">
            <p>粗調焦輪</p>
            <div class="knob-tools">
              <button type="button" class="step" data-step="-1" aria-label="粗調焦減少">－</button>
              <div class="knob-face" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-label="粗調焦輪">
                <span class="knob-notch"></span>
              </div>
              <button type="button" class="step" data-step="1" aria-label="粗調焦增加">＋</button>
            </div>
          </div>
          <div class="knob-block" data-kind="fine">
            <p>細調焦輪</p>
            <div class="knob-tools">
              <button type="button" class="step" data-step="-1" aria-label="細調焦減少">－</button>
              <div class="knob-face" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-label="細調焦輪">
                <span class="knob-notch"></span>
              </div>
              <button type="button" class="step" data-step="1" aria-label="細調焦增加">＋</button>
            </div>
          </div>
        </div>
        <p class="warn" id="coarse-warn" hidden>注意：你正在 40× 物鏡下轉動粗調焦輪。這樣很容易讓鏡頭壓破玻片。請改用細調焦輪。</p>
        <button type="button" class="ghost" id="dismiss-warn" hidden>我知道了，改用細調焦輪</button>
      </section>
    </div>
    <section class="notes-panel card">
      <div class="notes-head">
        <div>
          <h2>觀察紀錄</h2>
          <p class="muted">寫低和畫下你看見的東西。紀錄只儲存在這部裝置，不會上傳。</p>
        </div>
        <p class="mag-used">已記錄的總放大倍數：<span id="mag-used">尚未記錄</span></p>
      </div>
      <div class="notes-grid">
        <label>筆記
          <textarea id="note-text" rows="6" placeholder="例如：我看見絲狀的菌絲，頂端有深色圓形的孢子囊。"></textarea>
        </label>
        <div>
          <p class="control-label">素描</p>
          <canvas id="sketch" width="640" height="360" aria-label="觀察素描板"></canvas>
          <div class="pen-row">
            <button type="button" class="swatch is-on" data-pen="#1c1c1c" style="--swatch:#1c1c1c" aria-label="黑色">黑</button>
            <button type="button" class="swatch" data-pen="#1d4e89" style="--swatch:#1d4e89" aria-label="藍色">藍</button>
            <button type="button" class="swatch" data-pen="#1f7a45" style="--swatch:#1f7a45" aria-label="綠色">綠</button>
            <button type="button" class="swatch" data-pen="#8a4b1f" style="--swatch:#8a4b1f" aria-label="啡色">啡</button>
            <button type="button" class="swatch" data-pen="erase" aria-label="擦膠">擦膠</button>
            <button type="button" class="ghost" id="clear-sketch">清除畫板</button>
            <button type="button" class="primary" id="save-mag">記錄現時放大倍數</button>
          </div>
        </div>
      </div>
    </section>`

  lensCanvas = root.querySelector('#lens')
  sketchCanvas = root.querySelector('#sketch')
  sketchCtx = sketchCanvas?.getContext('2d') ?? null
  if (sketchCtx) {
    sketchCtx.lineCap = 'round'
    sketchCtx.lineJoin = 'round'
    blankSketch()
  }

  root.querySelectorAll<HTMLButtonElement>('[data-specimen]').forEach((button) => {
    button.addEventListener('click', () => placeSpecimen(button.dataset.specimen as SpecimenId))
  })
  root.querySelector('#remove-slide')?.addEventListener('click', () => {
    live.specimen = null
    live.fromExperiment = false
    emit()
  })
  root.querySelector('#light-switch')?.addEventListener('click', () => {
    live.lightOn = !live.lightOn
    if (live.lightOn) progress.flags.lightOn = true
    emit()
  })
  root.querySelector<HTMLInputElement>('#brightness')?.addEventListener('input', (event) => {
    live.brightness = Number((event.target as HTMLInputElement).value)
    emit()
  })
  root.querySelectorAll<HTMLButtonElement>('[data-diaphragm]').forEach((button) => {
    button.addEventListener('click', () => {
      live.diaphragm = Number(button.dataset.diaphragm)
      emit()
    })
  })
  root.querySelectorAll<HTMLButtonElement>('[data-objective]').forEach((button) => {
    button.addEventListener('click', () => {
      live.objective = Number(button.dataset.objective) as Objective
      if (live.objective !== 40) live.coarseWarn = false
      emit()
    })
  })
  root.querySelectorAll<HTMLElement>('.knob-block').forEach((block) => {
    bindKnob(block, block.dataset.kind === 'fine' ? 'fine' : 'coarse')
  })
  root.querySelector('#dismiss-warn')?.addEventListener('click', () => {
    live.coarseWarn = false
    emit()
  })
  root.querySelectorAll<HTMLButtonElement>('[data-pan]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!live.specimen) {
        toast('請先放上玻片。')
        return
      }
      const [dx, dy] = (button.dataset.pan ?? '0,0').split(',').map(Number)
      panBy(dx, dy)
      showDirection(dx, dy)
    })
  })
  if (lensCanvas) bindDrag(lensCanvas)
  const slide = root.querySelector<HTMLElement>('#glass-slide')
  if (slide) bindDrag(slide)

  const note = root.querySelector<HTMLTextAreaElement>('#note-text')
  note?.addEventListener('input', () => {
    if (!live.specimen) return
    progress.notes[live.specimen] = note.value
    persistSoon()
    emit()
  })
  root.querySelector('#save-mag')?.addEventListener('click', () => {
    if (!live.specimen) {
      toast('請先放上玻片。')
      return
    }
    const total = 10 * live.objective
    const list = progress.recordedMags[live.specimen] ?? []
    list.push(total)
    progress.recordedMags[live.specimen] = list.slice(-6)
    persistSoon()
    toast(`已記錄總放大倍數 ${total}×。`)
    emit()
  })
  root.querySelector('#clear-sketch')?.addEventListener('click', () => {
    if (!live.specimen) return
    delete progress.sketches[live.specimen]
    blankSketch()
    persistSoon()
    toast('已清除畫板。')
    emit()
  })
  root.querySelectorAll<HTMLButtonElement>('.swatch').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.pen ?? '#1c1c1c'
      erasing = value === 'erase'
      if (!erasing) pen = value
      root.querySelectorAll('.swatch').forEach((swatch) => swatch.classList.remove('is-on'))
      button.classList.add('is-on')
    })
  })

  if (sketchCanvas) {
    let drawing = false
    const pos = (event: PointerEvent) => {
      const rect = sketchCanvas!.getBoundingClientRect()
      return {
        x: ((event.clientX - rect.left) / rect.width) * sketchCanvas!.width,
        y: ((event.clientY - rect.top) / rect.height) * sketchCanvas!.height,
      }
    }
    sketchCanvas.addEventListener('pointerdown', (event) => {
      if (!live.specimen || !sketchCtx) return
      drawing = true
      sketchCanvas!.setPointerCapture(event.pointerId)
      const p = pos(event)
      sketchCtx.beginPath()
      sketchCtx.moveTo(p.x, p.y)
    })
    sketchCanvas.addEventListener('pointermove', (event) => {
      if (!drawing || !sketchCtx) return
      const p = pos(event)
      sketchCtx.strokeStyle = erasing ? '#fffaf0' : pen
      sketchCtx.lineWidth = erasing ? 18 : 4
      sketchCtx.lineTo(p.x, p.y)
      sketchCtx.stroke()
      sketchCtx.beginPath()
      sketchCtx.moveTo(p.x, p.y)
    })
    const finish = () => {
      if (!drawing) return
      drawing = false
      if (!live.specimen || !sketchCanvas) return
      try {
        progress.sketches[live.specimen] = sketchCanvas.toDataURL('image/png')
        persistSoon()
        emit()
      } catch {
        toast('畫板未能儲存，請清除後再試。')
      }
    }
    sketchCanvas.addEventListener('pointerup', finish)
    sketchCanvas.addEventListener('pointercancel', finish)
  }

  if (lensCanvas) {
    const observer = new ResizeObserver(() => requestDraw())
    observer.observe(lensCanvas)
  }
}

let noteSpecimen: string | null = null

export function updateScope(root: HTMLElement): void {
  const optics = opticsNow()
  root.querySelectorAll<HTMLButtonElement>('[data-specimen]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.specimen === live.specimen ? 'true' : 'false')
  })
  const blurb = root.querySelector('#specimen-blurb')
  if (blurb) {
    blurb.textContent = live.specimen
      ? specimenBlurb(live.specimen)
      : '選擇標本後，玻片會放到載物台，並由壓片夾固定。'
  }
  const lightBtn = root.querySelector('#light-switch')
  if (lightBtn) {
    lightBtn.textContent = live.lightOn ? '光源已開啟' : '開啟光源'
    lightBtn.setAttribute('aria-pressed', live.lightOn ? 'true' : 'false')
  }
  const brightness = root.querySelector<HTMLInputElement>('#brightness')
  if (brightness && document.activeElement !== brightness) brightness.value = String(live.brightness)
  root.querySelectorAll<HTMLButtonElement>('[data-diaphragm]').forEach((button) => {
    button.setAttribute('aria-pressed', Number(button.dataset.diaphragm) === live.diaphragm ? 'true' : 'false')
  })
  root.querySelectorAll<HTMLButtonElement>('[data-objective]').forEach((button) => {
    button.setAttribute('aria-pressed', Number(button.dataset.objective) === live.objective ? 'true' : 'false')
  })
  const formula = root.querySelector('#mag-formula')
  const total = root.querySelector('#mag-total')
  const field = root.querySelector('#field-label')
  if (formula) formula.textContent = `目鏡 10× × 物鏡 ${live.objective}×`
  if (total) total.textContent = `${optics.totalMag}×`
  if (field) field.textContent = `視野闊度${optics.fieldText}`
  root.querySelectorAll<HTMLElement>('.knob-face').forEach((face) => {
    const kind = face.closest('.knob-block')?.getAttribute('data-kind')
    const value = kind === 'fine' ? live.fine : live.coarse
    const notch = face.querySelector('.knob-notch') as HTMLElement | null
    if (notch) notch.style.transform = `rotate(${value * 12}deg)`
    face.setAttribute('aria-valuenow', String(Math.round(value)))
  })
  const warn = root.querySelector<HTMLElement>('#coarse-warn')
  const dismiss = root.querySelector<HTMLElement>('#dismiss-warn')
  const showWarn = live.coarseWarn && live.objective === 40
  if (warn) warn.hidden = !showWarn
  if (dismiss) dismiss.hidden = !showWarn
  const hint = root.querySelector('#scope-hint')
  if (hint) hint.textContent = hintText()
  const word = root.querySelector('#sharp-word')
  if (word) word.textContent = sharpWord()
  const fill = root.querySelector<HTMLElement>('#sharp-fill')
  if (fill) fill.style.width = `${Math.round(optics.sharpness * 100)}%`
  const msg = root.querySelector('#lens-msg')
  if (msg) {
    if (!live.lightOn && live.specimen) msg.textContent = '光源未開啟'
    else if (!live.lightOn) msg.textContent = '請放上玻片，然後開啟光源'
    else if (!live.specimen) msg.textContent = '載物台還沒有玻片'
    else msg.textContent = ''
  }
  const slide = root.querySelector<HTMLElement>('#glass-slide')
  const stage = root.querySelector('#stage-demo')
  if (slide && stage) {
    stage.classList.toggle('has-slide', Boolean(live.specimen))
    slide.textContent = live.specimen ? specimenName(live.specimen) : '尚未放上玻片'
    const vx = clamp(-live.sampleX, -500, 500) / 500 * 26
    const vy = clamp(-live.sampleY, -500, 500) / 500 * 14
    slide.style.transform = `translate(calc(-50% + ${vx}px), calc(-50% + ${vy}px))`
  }
  const hole = root.querySelector('#stage-hole')
  hole?.classList.toggle('off', !live.lightOn)
  const lit = live.lightOn && optics.dim < 0.45 && optics.wash < 0.45
  const steps: Record<string, boolean> = {
    slide: Boolean(live.specimen),
    light: live.lightOn,
    low: progress.flags.focused4,
    glow: live.lightOn && lit,
    high: progress.flags.focusedHigh,
  }
  root.querySelectorAll<HTMLElement>('#step-list [data-step]').forEach((item) => {
    const key = item.dataset.step ?? ''
    item.classList.toggle('done', Boolean(steps[key]))
  })

  const note = root.querySelector<HTMLTextAreaElement>('#note-text')
  const magUsed = root.querySelector('#mag-used')
  if (magUsed) magUsed.textContent = formatMags(live.specimen)
  if (note) {
    const key = live.specimen ?? ''
    note.disabled = !live.specimen
    if (key !== noteSpecimen) {
      noteSpecimen = key
      note.value = live.specimen ? progress.notes[live.specimen] ?? '' : ''
      if (live.specimen) loadSketch(live.specimen)
      else blankSketch()
    }
  }
  root.querySelector('#save-mag')?.toggleAttribute('disabled', !live.specimen)
  root.querySelector('#clear-sketch')?.toggleAttribute('disabled', !live.specimen)
  requestDraw()
}
