// Gold constellation background.
// Adapted from MengTo/threeui (MIT) - https://github.com/MengTo/threeui
// "constellation-field" example. Pure Canvas 2D, zero dependencies.

const DEFAULTS = {
  nodeCount: 75,        // desktop node count (halved on small screens)
  linkDistance: 150,    // px, connect nodes closer than this
  lineAlpha: 0.5,       // max alpha of the connecting lines
  nodeColor: '#e8cf8f',
  lineColorBase: 'rgba(230, 200, 121, ',
  speed: 0.32,          // drift speed multiplier
  pointerRadius: 220,   // px, mouse gravity radius
}

let canvas = null
let ctx = null
let nodes = []
let width = 0
let height = 0
let rafId = 0
let config = { ...DEFAULTS }
let pointer = { x: -1000, y: -1000 }
let reduced = false

function resize() {
  if (!canvas || !ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = window.innerWidth
  height = window.innerHeight
  canvas.width = Math.max(1, Math.floor(width * dpr))
  canvas.height = Math.max(1, Math.floor(height * dpr))
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function initNodes() {
  const count = width < 768 ? Math.floor(config.nodeCount / 2) : config.nodeCount
  nodes = []
  for (let i = 0; i < count; i += 1) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * config.speed,
      vy: (Math.random() - 0.5) * config.speed,
      radius: Math.random() * 1.6 + 1.1,
    })
  }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function drawFrame() {
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, width, height)

  const link = config.linkDistance
  ctx.lineWidth = 1
  ctx.lineCap = 'round'

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const d = dist(nodes[i], nodes[j])
      if (d < link) {
        ctx.globalAlpha = 0.16 + (1 - d / link) * config.lineAlpha
        ctx.strokeStyle = config.lineColorBase + ctx.globalAlpha + ')'
        ctx.beginPath()
        ctx.moveTo(nodes[i].x, nodes[i].y)
        ctx.lineTo(nodes[j].x, nodes[j].y)
        ctx.stroke()
      }
    }
  }

  const now = Date.now()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    node.x += node.vx
    node.y += node.vy
    if (node.x < 0 || node.x > width) node.vx *= -1
    if (node.y < 0 || node.y > height) node.vy *= -1

    const pd = dist(node, pointer)
    if (pd < config.pointerRadius) {
      node.x -= (node.x - pointer.x) * 0.004
      node.y -= (node.y - pointer.y) * 0.004
    }

    const pulse = 0.75 + Math.sin(now * 0.0012 + node.x) * 0.25
    ctx.fillStyle = config.nodeColor
    ctx.globalAlpha = pulse * 0.22
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.radius * 2.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = pulse * 0.9
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalAlpha = 1
}

function tick() {
  rafId = 0
  if (document.hidden) return
  drawFrame()
  rafId = window.requestAnimationFrame(tick)
}

function onResize() {
  resize()
  initNodes()
  if (!rafId) {
    drawFrame()
    if (!reduced) rafId = window.requestAnimationFrame(tick)
  }
}

function onPointerMove(e) {
  pointer.x = e.clientX
  pointer.y = e.clientY
}

function onPointerLeave() {
  pointer.x = -1000
  pointer.y = -1000
}

function onVisibility() {
  if (document.hidden) {
    if (rafId) {
      window.cancelAnimationFrame(rafId)
      rafId = 0
    }
  } else if (!rafId && !reduced) {
    rafId = window.requestAnimationFrame(tick)
  }
}

export function initConstellation(options = {}) {
  if (typeof window === 'undefined') return
  disposeConstellation()
  config = { ...DEFAULTS, ...options }
  reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;z-index:-1;pointer-events:none'
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')

  resize()
  initNodes()
  drawFrame()
  if (!reduced) rafId = window.requestAnimationFrame(tick)

  window.addEventListener('resize', onResize)
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseleave', onPointerLeave)
  document.addEventListener('visibilitychange', onVisibility)
}

export function disposeConstellation() {
  if (rafId) {
    window.cancelAnimationFrame(rafId)
    rafId = 0
  }
  if (canvas) {
    canvas.remove()
    canvas = null
    ctx = null
  }
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseleave', onPointerLeave)
  document.removeEventListener('visibilitychange', onVisibility)
}
