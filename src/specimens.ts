import type { Objective, SpecimenId } from './types'

interface Point {
  x: number
  y: number
}

interface Hypha {
  pts: Point[]
  width: number
}

interface Sporangium {
  x: number
  y: number
  r: number
  fromX: number
  fromY: number
  open: boolean
}

interface Spore {
  x: number
  y: number
  r: number
}

interface MouldModel {
  starch: { x: number; y: number; r: number }[]
  hyphae: Hypha[]
  sporangia: Sporangium[]
  spores: Spore[]
}

interface YeastCell {
  x: number
  y: number
  rx: number
  ry: number
  rot: number
  bud: number
  budAngle: number
}

interface Bacterium {
  x: number
  y: number
  len: number
  ang: number
  chain: number
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

const mouldCache = new Map<number, MouldModel>()

function buildMould(density: number): MouldModel {
  const rand = mulberry32(density < 0.08 ? 3 : 11)
  const starch: MouldModel['starch'] = []
  for (let i = 0; i < 90; i += 1) {
    starch.push({
      x: (rand() - 0.5) * 2000,
      y: (rand() - 0.5) * 2000,
      r: 7 + rand() * 16,
    })
  }
  const hyphae: Hypha[] = []
  const sporangia: Sporangium[] = []
  const spores: Spore[] = []
  const n = density < 0.06 ? 0 : Math.round(2 + density * 15)
  for (let i = 0; i < n; i += 1) {
    let x = (rand() - 0.5) * 1100
    let y = (rand() - 0.5) * 1100
    const pts: Point[] = [{ x, y }]
    let ang = rand() * Math.PI * 2
    const segs = 5 + Math.floor(rand() * 8)
    for (let s = 0; s < segs; s += 1) {
      ang += (rand() - 0.5) * 1.05
      const len = 34 + rand() * 78
      x += Math.cos(ang) * len
      y += Math.sin(ang) * len
      pts.push({ x, y })
      if (rand() > 0.72) {
        const branch: Point[] = [{ x, y }]
        let bang = ang + (rand() > 0.5 ? 0.8 : -0.8)
        let bx = x
        let by = y
        const bsegs = 2 + Math.floor(rand() * 3)
        for (let b = 0; b < bsegs; b += 1) {
          bang += (rand() - 0.5) * 0.6
          const bl = 28 + rand() * 50
          bx += Math.cos(bang) * bl
          by += Math.sin(bang) * bl
          branch.push({ x: bx, y: by })
        }
        hyphae.push({ pts: branch, width: 5 + rand() * 3 })
      }
    }
    hyphae.push({ pts, width: 6 + rand() * 5 })
    if (rand() > 0.32) {
      const tip = pts[pts.length - 1]
      const stalk = 28 + rand() * 46
      const sx = tip.x + (rand() - 0.5) * 8
      const sy = tip.y - stalk
      const r = 16 + rand() * 14
      const open = rand() > 0.5
      sporangia.push({ x: sx, y: sy, r, fromX: tip.x, fromY: tip.y, open })
      const count = open ? 16 : 8
      for (let k = 0; k < count; k += 1) {
        const a = rand() * Math.PI * 2
        const d = open ? r * (0.35 + rand() * 1.15) : r * rand() * 0.55
        spores.push({ x: sx + Math.cos(a) * d, y: sy + Math.sin(a) * d, r: 1.5 + rand() * 1.3 })
      }
    }
  }
  if (density > 0.35) {
    hyphae.push({
      pts: [
        { x: -220, y: 50 },
        { x: -120, y: 20 },
        { x: -30, y: -8 },
        { x: 36, y: -6 },
      ],
      width: 9,
    })
    hyphae.push({
      pts: [
        { x: -30, y: -8 },
        { x: -10, y: 70 },
        { x: 24, y: 130 },
      ],
      width: 7,
    })
    sporangia.push({ x: 42, y: -62, r: 26, fromX: 36, fromY: -6, open: true })
    for (let k = 0; k < 18; k += 1) {
      const a = (k / 18) * Math.PI * 2 + 0.2
      spores.push({ x: 42 + Math.cos(a) * (30 + (k % 3) * 6), y: -62 + Math.sin(a) * (30 + (k % 4) * 4), r: 2 })
    }
  }
  return { starch, hyphae, sporangia, spores }
}

function getMould(density: number): MouldModel {
  const bucket = Math.round(Math.max(0, Math.min(1, density)) * 20) / 20
  let model = mouldCache.get(bucket)
  if (!model) {
    model = buildMould(bucket)
    mouldCache.set(bucket, model)
  }
  return model
}

function buildYeast(): YeastCell[] {
  const rand = mulberry32(42)
  const cells: YeastCell[] = [
    { x: -4, y: 2, rx: 7.2, ry: 5.6, rot: 0.4, bud: 0.62, budAngle: 0.7 },
    { x: 16, y: -8, rx: 6.4, ry: 5, rot: -0.2, bud: 0, budAngle: 0 },
    { x: -18, y: -12, rx: 6, ry: 4.8, rot: 0.9, bud: 0.5, budAngle: 2.4 },
    { x: 6, y: 16, rx: 5.5, ry: 4.4, rot: 0.1, bud: 0.45, budAngle: -1.2 },
  ]
  const colonies = [
    { x: 0, y: 0, n: 10, spread: 28 },
    { x: 280, y: -160, n: 14, spread: 46 },
    { x: -320, y: 180, n: 12, spread: 40 },
    { x: 140, y: 260, n: 9, spread: 34 },
    { x: -180, y: -300, n: 8, spread: 30 },
  ]
  for (const colony of colonies) {
    for (let i = 0; i < colony.n; i += 1) {
      if (colony.x === 0 && i < 4) continue
      const ang = rand() * Math.PI * 2
      const dist = rand() * colony.spread
      cells.push({
        x: colony.x + Math.cos(ang) * dist,
        y: colony.y + Math.sin(ang) * dist,
        rx: 4.6 + rand() * 2.6,
        ry: 3.6 + rand() * 2,
        rot: rand() * Math.PI,
        bud: rand() > 0.45 ? 0.4 + rand() * 0.35 : 0,
        budAngle: rand() * Math.PI * 2,
      })
    }
  }
  return cells
}

const yeastCells = buildYeast()

function buildBacteria(): Bacterium[] {
  const rand = mulberry32(99)
  const cells: Bacterium[] = []
  for (let i = 0; i < 90; i += 1) {
    const ang = rand() * Math.PI * 2
    const dist = rand() * 78
    const dir = rand() * Math.PI
    const chain = rand() > 0.55 ? 2 + Math.floor(rand() * 3) : 1
    const len = 5.4 + rand() * 2.4
    for (let c = 0; c < chain; c += 1) {
      cells.push({
        x: Math.cos(ang) * dist + Math.cos(dir) * c * (len + 1.1),
        y: Math.sin(ang) * dist + Math.sin(dir) * c * (len + 1.1),
        len,
        ang: dir,
        chain,
      })
    }
  }
  return cells
}

const bacteria = buildBacteria()

const BUBBLES: Record<SpecimenId, { x: number; y: number; r: number }[]> = {
  onion: [
    { x: 460, y: -280, r: 78 },
    { x: -420, y: 340, r: 52 },
  ],
  yeast: [{ x: -360, y: -240, r: 64 }],
  mould: [],
  bacteria: [],
}

function strokeWidth(px: number, pxPerUm: number): number {
  return Math.max(px, 0.8) / pxPerUm
}

function drawBubbles(ctx: CanvasRenderingContext2D, specimen: SpecimenId, pxPerUm: number): void {
  for (const bubble of BUBBLES[specimen]) {
    ctx.beginPath()
    ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fill()
    ctx.lineWidth = strokeWidth(2.4, pxPerUm)
    ctx.strokeStyle = 'rgba(40,30,20,0.55)'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(bubble.x - bubble.r * 0.35, bubble.y - bubble.r * 0.3, bubble.r * 0.22, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = strokeWidth(1.4, pxPerUm)
    ctx.stroke()
  }
}

function drawOnion(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusUm: number,
  pxPerUm: number,
): void {
  ctx.fillStyle = '#e4c27a'
  ctx.beginPath()
  ctx.arc(centerX, centerY, radiusUm * 1.35, 0, Math.PI * 2)
  ctx.fill()

  const cellW = 200
  const cellH = 76
  const minCol = Math.floor((centerX - radiusUm) / cellW) - 2
  const maxCol = Math.floor((centerX + radiusUm) / cellW) + 2
  const minRow = Math.floor((centerY - radiusUm) / cellH) - 2
  const maxRow = Math.floor((centerY + radiusUm) / cellH) + 2

  for (let row = minRow; row <= maxRow; row += 1) {
    const shift = Math.abs(row) % 2 === 0 ? 0 : cellW / 2
    for (let col = minCol; col <= maxCol; col += 1) {
      const x = col * cellW + shift - cellW / 2
      const y = row * cellH - cellH / 2
      if (x > centerX + radiusUm + cellW || x + cellW < centerX - radiusUm - cellW) continue
      if (y > centerY + radiusUm + cellH || y + cellH < centerY - radiusUm - cellH) continue

      const wobble = ((row * 13 + col * 7) % 5) - 2
      const inset = 3
      ctx.beginPath()
      ctx.roundRect(x + inset, y + inset + wobble * 0.4, cellW - inset * 2, cellH - inset * 2, 8)
      const shade = 232 + ((col * 3 + row) % 5) * 3
      ctx.fillStyle = `rgb(${shade}, ${214 + ((row + col) % 3) * 4}, ${150 + ((col - row) % 4) * 3})`
      ctx.fill()
      ctx.lineWidth = strokeWidth(2.2, pxPerUm)
      ctx.strokeStyle = '#7a5528'
      ctx.stroke()

      const showNucleus = (col === 0 && row === 0) || (Math.abs(row * 5 + col * 3) % 5 !== 0)
      if (!showNucleus) continue
      const nx = x + cellW * (col === 0 && row === 0 ? 0.62 : 0.58 + ((col + row) % 3) * 0.06)
      const ny = y + cellH * 0.52
      const nr = 11
      if (nr * pxPerUm < 2.2) continue
      ctx.beginPath()
      ctx.arc(nx, ny, nr, 0, Math.PI * 2)
      ctx.fillStyle = '#c46a1d'
      ctx.fill()
      if (nr * pxPerUm > 9) {
        ctx.beginPath()
        ctx.arc(nx + 2, ny + 1, 3.2, 0, Math.PI * 2)
        ctx.fillStyle = '#7a3d12'
        ctx.fill()
      }
    }
  }
  drawBubbles(ctx, 'onion', pxPerUm)
}

function traceHypha(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i += 1) {
    const prev = pts[i - 1]
    const cur = pts[i]
    const mx = (prev.x + cur.x) / 2
    const my = (prev.y + cur.y) / 2
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last.x, last.y)
}

function drawMould(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusUm: number,
  pxPerUm: number,
  density: number,
): void {
  ctx.fillStyle = '#efd3a4'
  ctx.beginPath()
  ctx.arc(centerX, centerY, radiusUm * 1.35, 0, Math.PI * 2)
  ctx.fill()

  const model = getMould(density)
  for (const grain of model.starch) {
    if (Math.hypot(grain.x - centerX, grain.y - centerY) > radiusUm + grain.r + 20) continue
    ctx.beginPath()
    ctx.ellipse(grain.x, grain.y, grain.r, grain.r * 0.72, 0.4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,248,230,0.45)'
    ctx.fill()
    ctx.lineWidth = strokeWidth(1, pxPerUm)
    ctx.strokeStyle = 'rgba(150,110,60,0.25)'
    ctx.stroke()
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const hypha of model.hyphae) {
    traceHypha(ctx, hypha.pts)
    ctx.lineWidth = hypha.width
    ctx.strokeStyle = 'rgba(92, 78, 58, 0.82)'
    ctx.stroke()
    traceHypha(ctx, hypha.pts)
    ctx.lineWidth = hypha.width * 0.35
    ctx.strokeStyle = 'rgba(255,244,214,0.55)'
    ctx.stroke()
  }

  for (const sp of model.sporangia) {
    ctx.beginPath()
    ctx.moveTo(sp.fromX, sp.fromY)
    ctx.lineTo(sp.x, sp.y)
    ctx.lineWidth = 3.4
    ctx.strokeStyle = '#6a5434'
    ctx.stroke()
    const g = ctx.createRadialGradient(sp.x - sp.r * 0.3, sp.y - sp.r * 0.35, sp.r * 0.1, sp.x, sp.y, sp.r)
    g.addColorStop(0, sp.open ? '#5c564e' : '#4a453f')
    g.addColorStop(0.55, '#241f1b')
    g.addColorStop(1, '#100e0c')
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2)
    ctx.fillStyle = g
    ctx.fill()
    if (sp.open) {
      ctx.beginPath()
      ctx.arc(sp.x + sp.r * 0.15, sp.y + sp.r * 0.1, sp.r * 0.72, 0.2, Math.PI * 1.15)
      ctx.strokeStyle = 'rgba(230,220,200,0.35)'
      ctx.lineWidth = strokeWidth(1.2, pxPerUm)
      ctx.stroke()
    }
  }

  for (const spore of model.spores) {
    if (spore.r * pxPerUm < 1.6) continue
    ctx.beginPath()
    ctx.arc(spore.x, spore.y, spore.r, 0, Math.PI * 2)
    ctx.fillStyle = '#1a1613'
    ctx.fill()
  }
}

function drawYeast(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusUm: number,
  pxPerUm: number,
): void {
  ctx.fillStyle = '#f6f1e6'
  ctx.beginPath()
  ctx.arc(centerX, centerY, radiusUm * 1.35, 0, Math.PI * 2)
  ctx.fill()

  for (const cell of yeastCells) {
    if (Math.hypot(cell.x - centerX, cell.y - centerY) > radiusUm + 30) continue
    const drawOne = (x: number, y: number, rx: number, ry: number, rot: number, mother: boolean) => {
      if (Math.max(rx, ry) * pxPerUm < 1.5) return
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      ctx.beginPath()
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = mother ? '#e7d4ef' : '#f3e4f6'
      ctx.fill()
      ctx.lineWidth = strokeWidth(1.7, pxPerUm)
      ctx.strokeStyle = '#6d3f78'
      ctx.stroke()
      if (rx * pxPerUm > 10) {
        ctx.beginPath()
        ctx.ellipse(-rx * 0.15, 0, rx * 0.28, ry * 0.22, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(120, 70, 130, 0.28)'
        ctx.fill()
      }
      ctx.restore()
    }
    drawOne(cell.x, cell.y, cell.rx, cell.ry, cell.rot, true)
    if (cell.bud > 0 && cell.rx * pxPerUm > 3.2) {
      const bx = cell.x + Math.cos(cell.budAngle) * (cell.rx + cell.rx * cell.bud * 0.45)
      const by = cell.y + Math.sin(cell.budAngle) * (cell.ry + cell.ry * cell.bud * 0.35)
      drawOne(bx, by, cell.rx * cell.bud, cell.ry * cell.bud, cell.rot, false)
    }
  }
  drawBubbles(ctx, 'yeast', pxPerUm)
}

function drawBacteria(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusUm: number,
  pxPerUm: number,
  objective: Objective,
): void {
  ctx.fillStyle = '#f3eee4'
  ctx.beginPath()
  ctx.arc(centerX, centerY, radiusUm * 1.35, 0, Math.PI * 2)
  ctx.fill()

  const rand = mulberry32(7)
  for (let i = 0; i < 18; i += 1) {
    const x = centerX + (rand() - 0.5) * radiusUm * 1.6
    const y = centerY + (rand() - 0.5) * radiusUm * 1.6
    ctx.beginPath()
    ctx.ellipse(x, y, 18 + rand() * 26, 12 + rand() * 16, rand() * 3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(90, 70, 140, 0.06)'
    ctx.fill()
  }

  if (objective < 40) return

  for (const cell of bacteria) {
    if (Math.hypot(cell.x - centerX, cell.y - centerY) > radiusUm + 12) continue
    ctx.save()
    ctx.translate(cell.x, cell.y)
    ctx.rotate(cell.ang)
    ctx.beginPath()
    ctx.roundRect(-cell.len / 2, -0.85, cell.len, 1.7, 0.85)
    ctx.fillStyle = cell.chain > 2 ? '#3d4f86' : '#5a3d86'
    ctx.fill()
    ctx.restore()
  }

  // A quiet reference: these marks only appear once the 40× objective can resolve them.
  void pxPerUm
}

export function drawSpecimen(
  ctx: CanvasRenderingContext2D,
  specimen: SpecimenId,
  centerX: number,
  centerY: number,
  radiusUm: number,
  pxPerUm: number,
  objective: Objective,
  mouldDensity: number,
): void {
  if (specimen === 'onion') drawOnion(ctx, centerX, centerY, radiusUm, pxPerUm)
  else if (specimen === 'mould') drawMould(ctx, centerX, centerY, radiusUm, pxPerUm, mouldDensity)
  else if (specimen === 'yeast') drawYeast(ctx, centerX, centerY, radiusUm, pxPerUm)
  else drawBacteria(ctx, centerX, centerY, radiusUm, pxPerUm, objective)
}

export function specimenName(id: SpecimenId): string {
  if (id === 'mould') return '麵包霉菌'
  if (id === 'yeast') return '酵母菌'
  if (id === 'bacteria') return '乳酪中的細菌'
  return '洋蔥表皮細胞'
}

export function specimenBlurb(id: SpecimenId): string {
  if (id === 'mould') {
    return '霉菌是真菌。麵包上常見絲狀的菌絲，菌絲頂端有深色孢子囊，裡面有很多孢子。'
  }
  if (id === 'yeast') {
    return '酵母菌是單細胞真菌，細胞呈橢圓形。有時旁邊會長出小芽，這種繁殖方法叫出芽。'
  }
  if (id === 'bacteria') {
    return '細菌比酵母菌細小得多。在 4× 和 10× 下通常只見到一片淡淡的染色，要用 40× 物鏡（總放大 400×）才看得清楚。'
  }
  return '洋蔥表皮不是微生物，用來和微生物比較。細胞較大，像長方形排在一起，有細胞壁，染色後可看見細胞核。'
}
