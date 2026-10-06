let timer = 0

export function toast(message: string): void {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = message
  el.classList.add('show')
  window.clearTimeout(timer)
  timer = window.setTimeout(() => el.classList.remove('show'), 2800)
}
