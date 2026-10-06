import './style.css'
import { emit, live, setTab, subscribe, tabFromHash } from './state'
import { persistSoon, progress } from './storage'
import { mountParts, updateParts } from './parts'
import { mountScope, updateScope } from './microscope'
import { mountExperiment, updateExperiment } from './experiment'
import { syncAchievements, updateMissions } from './missions'
import { toast } from './toast'

const app = document.querySelector<HTMLElement>('#app')
if (!app) throw new Error('找不到應用程式根節點')

app.innerHTML = `
  <header class="topbar">
    <div class="brand">
      <p class="eyebrow">小學五年級 · 常識科</p>
      <h1>虛擬顯微鏡</h1>
      <p class="unit">看不見的世界 — 顯微鏡下的微生物</p>
    </div>
    <div class="mode-switch" role="group" aria-label="使用模式">
      <button type="button" id="mode-student" aria-pressed="true">學生任務</button>
      <button type="button" id="mode-teacher" aria-pressed="false">教師示範</button>
    </div>
    <div class="header-actions">
      <button type="button" class="ghost" id="open-safety">安全衞生</button>
      <button type="button" class="ghost" id="fullscreen">全螢幕</button>
    </div>
    <nav class="tabs" role="tablist" aria-label="學習內容">
      <button type="button" role="tab" data-tab="parts" aria-selected="true">顯微鏡部件</button>
      <button type="button" role="tab" data-tab="scope" aria-selected="false">操作顯微鏡</button>
      <button type="button" role="tab" data-tab="experiment" aria-selected="false">麵包發霉實驗</button>
    </nav>
  </header>
  <div id="mission-slot"></div>
  <main class="shell">
    <section id="view-parts" data-view="parts"></section>
    <section id="view-scope" data-view="scope" hidden></section>
    <section id="view-exp" data-view="experiment" hidden></section>
  </main>
  <footer class="site-foot">
    <p>標本和發霉情況由程式繪製，是教學模擬，不是真實顯微照片。細胞大小經過簡化，方便在螢幕上觀察，但仍保持「洋蔥細胞最大、酵母菌次之、細菌最細，而且細菌要高倍才看得見」。</p>
  </footer>
  <dialog id="safety-dialog">
    <article>
      <h2>安全與衞生</h2>
      <ul>
        <li>發霉的麵包不可食用，也不要打開容器直接去聞。霉菌孢子可能使人過敏。</li>
        <li>如果在現實中做實驗，用過的發霉食物要封好才丟掉，之後用肥皂洗手。</li>
        <li>玻片是玻璃，要輕放。如有破損，告訴老師，不要用手去撿。</li>
        <li>搬動顯微鏡要一手握鏡臂、一手托鏡座，並保持鏡身垂直。</li>
        <li>使用 40× 物鏡時，只用細調焦輪，避免鏡頭壓破玻片。</li>
        <li>這個程式是電腦模擬，可以放心練習操作。真正的微生物實驗必須跟隨老師的指示。</li>
      </ul>
      <button type="button" class="primary" id="close-safety">知道了</button>
    </article>
  </dialog>
  <div id="toast" role="status"></div>`

const partsView = document.querySelector<HTMLElement>('#view-parts')!
const scopeView = document.querySelector<HTMLElement>('#view-scope')!
const expView = document.querySelector<HTMLElement>('#view-exp')!
const missionSlot = document.querySelector<HTMLElement>('#mission-slot')!

mountParts(partsView)
mountScope(scopeView)
mountExperiment(expView)

function render(): void {
  document.body.classList.toggle('teacher', live.teacher)
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((section) => {
    section.hidden = section.dataset.view !== live.tab
  })
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
    const on = button.dataset.tab === live.tab
    button.setAttribute('aria-selected', on ? 'true' : 'false')
  })
  document.getElementById('mode-student')?.setAttribute('aria-pressed', live.teacher ? 'false' : 'true')
  document.getElementById('mode-teacher')?.setAttribute('aria-pressed', live.teacher ? 'true' : 'false')
  syncAchievements()
  updateParts(partsView)
  updateScope(scopeView)
  updateExperiment(expView)
  updateMissions(missionSlot)
}

subscribe(render)

document.querySelector('.tabs')?.addEventListener('click', (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-tab]')
  if (!button?.dataset.tab) return
  const tab = button.dataset.tab
  if (tab === 'parts' || tab === 'scope' || tab === 'experiment') setTab(tab)
})

document.getElementById('mode-student')?.addEventListener('click', () => {
  live.teacher = false
  progress.teacher = false
  persistSoon()
  emit()
})
document.getElementById('mode-teacher')?.addEventListener('click', () => {
  live.teacher = true
  progress.teacher = true
  persistSoon()
  emit()
})

const safety = document.querySelector<HTMLDialogElement>('#safety-dialog')
document.getElementById('open-safety')?.addEventListener('click', () => safety?.showModal())
document.getElementById('close-safety')?.addEventListener('click', () => safety?.close())

const fullscreenBtn = document.getElementById('fullscreen')
fullscreenBtn?.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
    else await document.exitFullscreen()
  } catch {
    toast('這部裝置未能進入全螢幕，可以改用瀏覽器的全螢幕功能。')
  }
})
document.addEventListener('fullscreenchange', () => {
  if (fullscreenBtn) fullscreenBtn.textContent = document.fullscreenElement ? '退出全螢幕' : '全螢幕'
})

window.addEventListener('hashchange', () => {
  const tab = tabFromHash(location.hash)
  if (tab !== live.tab) {
    live.tab = tab
    emit()
  }
})

live.tab = tabFromHash(location.hash)
if (!location.hash) history.replaceState(null, '', '#parts')
render()
