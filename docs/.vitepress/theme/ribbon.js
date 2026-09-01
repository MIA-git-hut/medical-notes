// Canvas ribbon background, adapted from zproo/canvas-ribbon (MIT)
// Options: initRibbon({ zIndex, alpha, size })
//   zIndex: layer of the canvas, default -1 (behind page content)
//   alpha:  opacity 0~1, default 0.5
//   size:   ribbon width in px, default 90

const defaults = { zIndex: -1, alpha: 0.5, size: 90 }

let canvas = null
let ctx = null
let timer = null
let config = { ...defaults }
let pts = []
let width = 0
let height = 0
let r = 0
const PI_2 = Math.PI * 2

function geneY(y) {
  const temp = y + (Math.random() * 2 - 1.1) * config.size
  return temp > height || temp < 0 ? geneY(y) : temp
}

function generate() {
  if (!canvas || !ctx) return
  pts = [
    { x: 0, y: height * 0.7 + config.size },
    { x: 0, y: height * 0.7 - config.size },
  ]
  let i = 0
  while (pts[i + 1].x < width + config.size) {
    const end = pts[i + 1]
    const nextX = end.x + (Math.random() * 2 - 0.25) * config.size
    const nextY = geneY(end.y)
    pts.push({ x: nextX, y: nextY })
    i++
  }
}

function paint() {
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, width, height)
  for (let i = 0; i < pts.length - 2; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const c = pts[i + 2]
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.closePath()
    r -= PI_2 / -50
    ctx.fillStyle =
      '#' +
      ((Math.cos(r) * 127 + 128) << 16 |
        (Math.cos(r + PI_2 / 3) * 127 + 128) << 8 |
        (Math.cos(r + (PI_2 / 3) * 2) * 127 + 128)).toString(16)
    ctx.fill()
  }
}

function resize() {
  width = window.innerWidth
  height = window.innerHeight
  if (!canvas || !ctx) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.globalAlpha = config.alpha
  generate()
  paint()
}

function startTimer() {
  if (timer) return
  timer = window.setInterval(paint, 150)
}

function stopTimer() {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

function onResize() {
  resize()
}

function onClick() {
  generate()
  paint()
}

function onVisibility() {
  if (document.hidden) stopTimer()
  else startTimer()
}

export function initRibbon(options = {}) {
  if (typeof window === 'undefined') return
  disposeRibbon()
  config = { ...defaults, ...options }
  canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:fixed;top:0;left:0;z-index:' + config.zIndex + ';pointer-events:none'
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
  resize()
  window.addEventListener('resize', onResize)
  window.addEventListener('click', onClick)
  document.addEventListener('visibilitychange', onVisibility)
  startTimer()
}

export function disposeRibbon() {
  stopTimer()
  if (canvas) {
    canvas.remove()
    canvas = null
    ctx = null
  }
  window.removeEventListener('resize', onResize)
  window.removeEventListener('click', onClick)
  document.removeEventListener('visibilitychange', onVisibility)
}
