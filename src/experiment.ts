import { emit, live, setTab } from './state'
import { persist, persistSoon, progress, expectationLabel } from './storage'
import {
  CONTROL,
  densityFromScore,
  describeMould,
  diffCount,
  expectationMatches,
  moistureLabel,
  mouldScore,
  presLabel,
  setupLabel,
  tempLabel,
} from './science'
import { toast } from './toast'

function clampDay(day: number): number {
  return Math.max(0, Math.min(7, Math.round(day)))
}

function currentScore(): number {
  if (!live.exp.started) return 0
  return mouldScore(live.exp.temp, live.exp.moisture, live.exp.preservative, live.exp.day)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function drawBread(canvas: HTMLCanvasElement): void {
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
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const score = currentScore()
  const key = `${live.exp.temp}|${live.exp.moisture}|${live.exp.preservative}|${live.exp.day}|${score}`
  let seed = 17
  for (let i = 0; i < key.length; i += 1) seed = (seed * 33 + key.charCodeAt(i)) >>> 0
  const rand = mulberry32(seed || 1)

  const pad = 18 * dpr
  const bw = w - pad * 2
  const bh = h - pad * 2
  ctx.save()
  ctx.translate(pad, pad)
  ctx.beginPath()
  ctx.roundRect(0, bh * 0.08, bw, bh * 0.84, 28 * dpr)
  const crumb = ctx.createLinearGradient(0, 0, 0, bh)
  crumb.addColorStop(0, '#f3d7a4')
  crumb.addColorStop(1, '#e4b87a')
  ctx.fillStyle = crumb
  ctx.fill()
  ctx.lineWidth = 10 * dpr
  ctx.strokeStyle = '#b8884e'
  ctx.stroke()

  for (let i = 0; i < 16; i += 1) {
    const x = 24 * dpr + rand() * (bw - 48 * dpr)
    const y = bh * 0.2 + rand() * bh * 0.62
    ctx.beginPath()
    ctx.ellipse(x, y, (6 + rand() * 10) * dpr, (4 + rand() * 7) * dpr, rand() * 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,248,230,0.45)'
    ctx.fill()
  }

  if (score > 0.4) {
    ctx.beginPath()
    ctx.roundRect(0, bh * 0.08, bw, bh * 0.84, 28 * dpr)
    ctx.fillStyle = `rgba(58, 74, 48, ${Math.min(0.28, score / 28)})`
    ctx.fill()
  }
  const colonies = score < 0.4 ? 0 : Math.round(3 + score * 3.4)
  for (let i = 0; i < colonies; i += 1) {
    const x = 28 * dpr + rand() * (bw - 56 * dpr)
    const y = bh * 0.16 + rand() * bh * 0.68
    const r = (12 + rand() * 18 + score * 1.3) * dpr
    const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r)
    const dark = i % 3 === 0
    g.addColorStop(0, dark ? 'rgba(28, 30, 26, 0.95)' : 'rgba(74, 102, 58, 0.92)')
    g.addColorStop(0.72, dark ? 'rgba(20, 22, 18, 0.88)' : 'rgba(54, 78, 46, 0.9)')
    g.addColorStop(1, 'rgba(40, 52, 34, 0.05)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(16, 18, 14, 0.9)'
    const specks = 3 + Math.floor(score / 3)
    for (let s = 0; s < specks; s += 1) {
      ctx.beginPath()
      ctx.arc(x + (rand() - 0.5) * r * 0.8, y + (rand() - 0.5) * r * 0.8, (1.4 + rand() * 1.8) * dpr, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function fairMessage(): string {
  const n = diffCount(live.exp, CONTROL)
  if (n === 0) return '這是對照設定：室溫、濕、沒有防腐劑。'
  if (n === 1) return '與對照比較，你只改變了一個條件，這是公平測試。'
  return `與對照比較，你同時改變了 ${n} 個條件。這樣就不容易知道是哪一個條件令麵包發霉程度不同。`
}

let tableSig = ''

export function mountExperiment(root: HTMLElement): void {
  root.innerHTML = `
    <div class="fair-banner">公平測試：每次只改變一個條件，其他條件保持不變。對照是室溫、濕、沒有防腐劑。</div>
    <div class="safety-strip">
      <strong>安全提醒：</strong>發霉食物不可食用，也不要打開容器去聞。這是電腦模擬，用來代替用手接觸霉菌。
      <button type="button" class="ghost tiny" id="exp-safety">閱讀全部安全守則</button>
    </div>
    <div class="exp-grid">
      <section class="card">
        <h2>設定條件</h2>
        <p class="control-label">溫度</p>
        <div class="seg" id="temp-seg">
          <button type="button" data-temp="cold">冷<small>好像雪櫃</small></button>
          <button type="button" data-temp="room">室溫</button>
          <button type="button" data-temp="warm">暖<small>溫暖處</small></button>
        </div>
        <p class="control-label">水分</p>
        <div class="seg" id="moist-seg">
          <button type="button" data-moisture="dry">乾</button>
          <button type="button" data-moisture="wet">濕</button>
        </div>
        <p class="control-label">防腐劑</p>
        <div class="seg" id="pres-seg">
          <button type="button" data-pres="no">沒有</button>
          <button type="button" data-pres="yes">有防腐劑</button>
        </div>
        <p class="fair-note" id="fair-note"></p>
      </section>
      <section class="card bread-card">
        <h2>麵包的變化</h2>
        <canvas id="bread-canvas" aria-label="麵包發霉模擬圖"></canvas>
        <p id="bread-caption" class="bread-caption"></p>
        <label class="slider-label">經過日數：<strong id="day-readout">0</strong> 天
          <input id="day-slider" type="range" min="0" max="7" step="1" value="0" />
        </label>
        <div class="day-ticks" aria-hidden="true"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span></div>
        <button type="button" class="primary" id="view-mould">放到顯微鏡觀察</button>
      </section>
      <section class="card">
        <h2>先作預測</h2>
        <p>在拖動日數之前，先估計這片麵包會怎樣。</p>
        <div class="seg stack" id="expect-seg">
          <button type="button" data-expect="none">幾乎不發霉</button>
          <button type="button" data-expect="some">會有少許霉</button>
          <button type="button" data-expect="lots">會有很多霉</button>
        </div>
        <button type="button" class="primary" id="start-exp">開始觀察</button>
        <p id="predict-feedback" class="hint-note"></p>
        <button type="button" class="ghost" id="record-trial">記入結果表</button>
      </section>
    </div>
    <div class="exp-results">
      <section class="card">
        <div class="notes-head">
          <h2>結果表</h2>
          <button type="button" class="ghost tiny" id="clear-trials">清除紀錄</button>
        </div>
        <div id="trial-table"></div>
      </section>
      <section class="card">
        <h2>發霉程度</h2>
        <p class="muted">條形越長，模擬的發霉越多（滿分 10）。</p>
        <div id="trial-chart" class="chart"></div>
      </section>
    </div>
    <section class="card">
      <h2>我的結論</h2>
      <p>用自己的句子寫下：哪一個條件令麵包較容易發霉？你有沒有只改變一個條件？</p>
      <textarea id="conclusion" rows="4" placeholder="我發現麵包在溫暖、潮濕又沒有防腐劑時較容易發霉。我比較時只改變了一個條件。"></textarea>
    </section>`

  root.querySelector('#exp-safety')?.addEventListener('click', () => {
    document.getElementById('open-safety')?.dispatchEvent(new Event('click'))
  })

  root.querySelectorAll<HTMLButtonElement>('[data-temp]').forEach((button) => {
    button.addEventListener('click', () => {
      changeSetup({ temp: button.dataset.temp as 'cold' | 'room' | 'warm' })
    })
  })
  root.querySelectorAll<HTMLButtonElement>('[data-moisture]').forEach((button) => {
    button.addEventListener('click', () => {
      changeSetup({ moisture: button.dataset.moisture as 'dry' | 'wet' })
    })
  })
  root.querySelectorAll<HTMLButtonElement>('[data-pres]').forEach((button) => {
    button.addEventListener('click', () => {
      changeSetup({ preservative: button.dataset.pres === 'yes' })
    })
  })
  root.querySelectorAll<HTMLButtonElement>('[data-expect]').forEach((button) => {
    button.addEventListener('click', () => {
      live.exp.expectation = button.dataset.expect as 'none' | 'some' | 'lots'
      if (live.exp.started) {
        live.exp.started = false
        live.exp.day = 0
        toast('預測已更改。請再按「開始觀察」。')
      }
      emit()
    })
  })
  root.querySelector('#start-exp')?.addEventListener('click', () => {
    if (!live.exp.expectation) {
      toast('請先選擇你的預測。')
      return
    }
    live.exp.started = true
    live.exp.day = 0
    progress.everPredicted = true
    persistSoon()
    emit()
  })
  root.querySelector<HTMLInputElement>('#day-slider')?.addEventListener('input', (event) => {
    if (!live.exp.started) {
      toast('請先作預測，再按「開始觀察」。')
      ;(event.target as HTMLInputElement).value = '0'
      return
    }
    live.exp.day = clampDay(Number((event.target as HTMLInputElement).value))
    emit()
  })
  root.querySelector('#record-trial')?.addEventListener('click', () => {
    if (!live.exp.started || !live.exp.expectation) {
      toast('請先預測並開始觀察，再記錄結果。')
      return
    }
    const score = currentScore()
    const next = {
      id: `${Date.now()}`,
      temp: live.exp.temp,
      moisture: live.exp.moisture,
      preservative: live.exp.preservative,
      day: live.exp.day,
      score,
      expectation: live.exp.expectation,
    }
    const index = progress.trials.findIndex(
      (trial) =>
        trial.temp === next.temp &&
        trial.moisture === next.moisture &&
        trial.preservative === next.preservative &&
        trial.day === next.day,
    )
    if (index >= 0) progress.trials[index] = next
    else progress.trials.push(next)
    persist()
    toast(index >= 0 ? '已更新相同條件的記錄。' : '已記入結果表。')
    emit()
  })
  root.querySelector('#view-mould')?.addEventListener('click', () => {
    if (!live.exp.started) {
      toast('請先預測並開始觀察。')
      return
    }
    live.specimen = 'mould'
    live.sampleX = 20
    live.sampleY = -10
    live.mouldDensity = densityFromScore(currentScore())
    live.fromExperiment = true
    progress.flags.placedSlide = true
    persistSoon()
    setTab('scope')
  })
  root.querySelector('#clear-trials')?.addEventListener('click', () => {
    if (!progress.trials.length && !progress.conclusion) return
    progress.trials = []
    persist()
    toast('已清除實驗紀錄。')
    emit()
  })
  const conclusion = root.querySelector<HTMLTextAreaElement>('#conclusion')
  conclusion?.addEventListener('input', () => {
    progress.conclusion = conclusion.value
    persistSoon()
    emit()
  })

  const canvas = root.querySelector<HTMLCanvasElement>('#bread-canvas')
  if (canvas) new ResizeObserver(() => drawBread(canvas)).observe(canvas)
}

function changeSetup(patch: Partial<typeof live.exp>): void {
  Object.assign(live.exp, patch)
  if (live.exp.started) {
    live.exp.started = false
    live.exp.day = 0
    live.exp.expectation = null
    toast('你改變了條件。請先再作預測，然後才觀察。')
  }
  emit()
}

let tableBound = false

export function updateExperiment(root: HTMLElement): void {
  if (root.hidden && live.tab !== 'experiment') return
  root.querySelectorAll<HTMLButtonElement>('[data-temp]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.temp === live.exp.temp ? 'true' : 'false')
  })
  root.querySelectorAll<HTMLButtonElement>('[data-moisture]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.moisture === live.exp.moisture ? 'true' : 'false')
  })
  root.querySelectorAll<HTMLButtonElement>('[data-pres]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.pres === (live.exp.preservative ? 'yes' : 'no') ? 'true' : 'false')
  })
  root.querySelectorAll<HTMLButtonElement>('[data-expect]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.expect === live.exp.expectation ? 'true' : 'false')
  })
  const fair = root.querySelector('#fair-note')
  if (fair) fair.textContent = fairMessage()
  const slider = root.querySelector<HTMLInputElement>('#day-slider')
  if (slider) {
    slider.disabled = !live.exp.started
    if (document.activeElement !== slider) slider.value = String(live.exp.day)
  }
  const readout = root.querySelector('#day-readout')
  if (readout) readout.textContent = String(live.exp.day)
  const score = currentScore()
  const caption = root.querySelector('#bread-caption')
  if (caption) {
    if (!live.exp.started) caption.textContent = '尚未開始。先選擇預測，再按「開始觀察」。'
    else caption.textContent = `第 ${live.exp.day} 天 · 發霉程度：${describeMould(score)}（${score}／10）`
  }
  const feedback = root.querySelector('#predict-feedback')
  if (feedback) {
    if (live.exp.started && live.exp.expectation && live.exp.day >= 2) {
      const words = describeMould(score)
      const match = expectationMatches(live.exp.expectation, score)
      feedback.textContent = `你預測「${expectationLabel(live.exp.expectation)}」。第 ${live.exp.day} 天的模擬結果是「${words}」（${score}／10）。${match ? '結果與預測接近。' : '結果和預測不同，可以想想哪個條件影響最大。'}`
    } else if (live.exp.started && live.exp.day < 2) {
      feedback.textContent = '頭一兩天通常還看不見明顯霉菌。把日數再調後一點。'
    } else if (!live.exp.expectation) {
      feedback.textContent = '尚未選擇預測。'
    } else {
      feedback.textContent = '預測已選好。按「開始觀察」後才拖動日數。'
    }
  }
  const start = root.querySelector<HTMLButtonElement>('#start-exp')
  if (start) start.disabled = !live.exp.expectation
  const canvas = root.querySelector<HTMLCanvasElement>('#bread-canvas')
  if (canvas && live.tab === 'experiment') drawBread(canvas)

  const conclusion = root.querySelector<HTMLTextAreaElement>('#conclusion')
  if (conclusion && document.activeElement !== conclusion) conclusion.value = progress.conclusion

  const sig = JSON.stringify(progress.trials)
  if (sig === tableSig && tableBound) return
  tableSig = sig
  tableBound = true
  const table = root.querySelector('#trial-table')
  const chart = root.querySelector('#trial-chart')
  if (table) table.innerHTML = renderTable()
  if (chart) chart.innerHTML = renderChart()
}

function renderTable(): string {
  if (!progress.trials.length) {
    return '<p class="muted">尚未記錄結果。觀察後按「記入結果表」，最好至少做兩次，而且兩次只相差一個條件。</p>'
  }
  const rows = progress.trials
    .map((trial) => {
      const diff = diffCount(trial, CONTROL)
      const tag = diff === 0 ? '對照' : diff === 1 ? '只改變一個條件' : `改變了 ${diff} 個條件`
      return `<tr>
        <td>${tempLabel(trial.temp)}</td>
        <td>${moistureLabel(trial.moisture)}</td>
        <td>${presLabel(trial.preservative)}</td>
        <td>第 ${trial.day} 天</td>
        <td>${describeMould(trial.score)}（${trial.score}）</td>
        <td>${tag}</td>
      </tr>`
    })
    .join('')
  return `<div class="table-scroll"><table>
    <thead><tr><th>溫度</th><th>水分</th><th>防腐劑</th><th>日數</th><th>發霉程度</th><th>和對照比較</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`
}

function renderChart(): string {
  if (!progress.trials.length) {
    return '<p class="muted">記錄結果後，這裏會顯示條形圖。</p>'
  }
  return progress.trials
    .map((trial) => {
      const diff = diffCount(trial, CONTROL)
      const kind = diff === 0 ? 'control' : diff === 1 ? 'fair' : 'multi'
      const width = Math.max(2, (trial.score / 10) * 100)
      return `<div class="bar-row">
        <span class="bar-label">${setupLabel(trial)} · 第${trial.day}天</span>
        <div class="bar-track"><div class="bar-fill ${kind}" style="width:${width}%"></div></div>
        <span class="bar-score">${trial.score}</span>
      </div>`
    })
    .join('')
}
