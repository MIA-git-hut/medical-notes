<template>
  <div class="tcm-graph">
    <div class="tcm-graph-head">
      <div class="tcm-graph-title">
        <span class="tcm-pulse"></span>
        <strong>中药学知识图谱</strong>
        <span class="tcm-stats">{{ statsText }}</span>
      </div>
      <div class="tcm-graph-tools">
        <input
          v-model="query"
          class="tcm-search"
          type="search"
          placeholder="搜索药名 / 功效分类"
          spellcheck="false"
          @keydown.enter.prevent="jumpToMatch"
        />
        <div class="tcm-zoom">
          <button title="放大" @click="zoomBy(1.35)">+</button>
          <button title="缩小" @click="zoomBy(1 / 1.35)">−</button>
          <button title="适应视图" @click="fitView">适应</button>
        </div>
      </div>
    </div>

    <div class="tcm-canvas-wrap">
      <div ref="container" class="tcm-canvas"></div>
      <div v-if="loading" class="tcm-overlay">正在构建图谱…</div>
      <div v-else-if="error" class="tcm-overlay tcm-error">{{ error }}</div>
    </div>

    <div class="tcm-legend">
      <button
        v-for="(group, index) in groups"
        :key="group.name"
        class="tcm-chip"
        :class="{ active: activeGroup === index }"
        @click="toggleGroup(index)"
      >
        <i :style="{ background: group.color, boxShadow: `0 0 7px ${group.color}66` }"></i>
        <span>{{ group.name }}</span>
        <em>{{ group.count }}</em>
      </button>
      <span class="tcm-hubs">
        <i class="tcm-hub-c"></i>功效分类
        <i class="tcm-hub-m"></i>归经
      </span>
    </div>

    <p class="tcm-hint">拖动节点 · 滚轮缩放 · 悬停查看 · 点击药名进入笔记；点击分类或归经节点聚焦关联药物</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vitepress'

const router = useRouter()
const container = ref(null)
const loading = ref(true)
const error = ref('')
const query = ref('')
const activeGroup = ref(-1)
const stats = ref(null)
const groups = ref([])
const statsText = computed(() => {
  if (!stats.value) return '加载中'
  const { notes, categories, meridians, links } = stats.value
  return `${notes} 味药卡 · ${categories} 功效分类 · ${meridians} 归经 · ${links} 条关联`
})

let graph = null
let nodes = []
let links = []
let hoverNode = null
let activeHub = null
let focusIds = null
let searchIds = new Set()
let adjacency = new Map()
let degrees = new Map()
let nodeIndex = new Map()
let labelOrder = []
let disposed = false
let didFit = false
let resizeObserver = null
let detachClicks = null

const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
const HUB_COLOR = 'rgba(150, 170, 210, 0.85)'
const MERIDIAN_COLOR = '#d9a441'

const escapeHtml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function radiusOf(node) {
  if (node.t === 'm') return 3.4
  const degree = degrees.get(node.id) || 0
  if (node.t === 'c') return Math.min(6.4, 2.9 + Math.sqrt(degree) * 0.34)
  return Math.min(8.4, 2.15 + Math.sqrt(degree) * 0.62)
}

function isHub(node) {
  return node.t === 'c' || node.t === 'm'
}

function isDimmed(node) {
  return focusIds ? !focusIds.has(node.id) : false
}

function computeFocus() {
  if (hoverNode) {
    focusIds = new Set([hoverNode.id, ...(adjacency.get(hoverNode.id) || [])])
    return
  }
  if (activeHub) {
    focusIds = new Set([activeHub, ...(adjacency.get(activeHub) || [])])
    return
  }
  if (activeGroup.value >= 0) {
    const ids = new Set()
    for (const node of nodes) {
      if (node.g !== activeGroup.value || isHub(node)) continue
      ids.add(node.id)
      for (const neighborId of adjacency.get(node.id) || []) {
        const neighbor = nodeById(neighborId)
        if (neighbor && isHub(neighbor)) ids.add(neighborId)
      }
    }
    focusIds = ids
    return
  }
  if (searchIds.size) {
    const ids = new Set()
    for (const id of searchIds) {
      ids.add(id)
      for (const neighborId of adjacency.get(id) || []) ids.add(neighborId)
    }
    focusIds = ids
    return
  }
  focusIds = null
}

function nodeById(id) {
  return nodeIndex.get(id)
}

function redraw() {
  if (!graph || disposed) return
  // 换一个 accessor 实例触发 force-graph 的 notifyRedraw
  graph.nodeColor((node) => node.__color)
}

function paintNode(node, ctx, scale) {
  const dimmed = isDimmed(node)
  const hovered = hoverNode === node
  const radius = node.__r
  ctx.globalAlpha = dimmed ? 0.1 : 1

  if (node.t === 'c') {
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = '#0a0e18'
    ctx.fill()
    ctx.lineWidth = 1.1 / scale
    ctx.strokeStyle = hovered ? '#dbe6ff' : HUB_COLOR
    ctx.stroke()
  } else if (node.t === 'm') {
    const d = radius * 1.15
    ctx.beginPath()
    ctx.moveTo(node.x, node.y - d)
    ctx.lineTo(node.x + d, node.y)
    ctx.lineTo(node.x, node.y + d)
    ctx.lineTo(node.x - d, node.y)
    ctx.closePath()
    ctx.fillStyle = hovered ? '#ffd77a' : MERIDIAN_COLOR
    ctx.fill()
    if (hovered) {
      ctx.lineWidth = 1 / scale
      ctx.strokeStyle = '#fff3d0'
      ctx.stroke()
    }
  } else {
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = node.__color
    ctx.fill()
    if (hovered) {
      ctx.lineWidth = 1.6 / scale
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
    } else if (node.p) {
      ctx.lineWidth = 0.7 / scale
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
      ctx.stroke()
    }
  }

  if (hovered) {
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius + 3.2 / scale, 0, Math.PI * 2)
    ctx.lineWidth = 0.9 / scale
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)'
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function shouldLabel(node, scale) {
  if (node.t === 'c' || node.t === 'm') return true
  if (scale > 1.35) return true
  if (focusIds && focusIds.has(node.id)) return true
  return (degrees.get(node.id) || 0) >= 26
}

function paintLabels(ctx, scale) {
  const fontSize = 10.5 / scale
  const pad = 1.2 / scale
  const lineHeight = fontSize * 1.08
  ctx.font = `500 ${fontSize}px ${FONT_FAMILY}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  const placed = []
  const handled = new Set()
  const maxLabels = scale > 1.35 ? 240 : 150

  const drawLabel = (node) => {
    if (handled.has(node)) return false
    handled.add(node)
    const textWidth = ctx.measureText(node.id).width
    const x = node.x + node.__r + 2.4 / scale
    const rect = {
      x: x - pad,
      y: node.y - lineHeight / 2 - pad,
      w: textWidth + pad * 2,
      h: lineHeight + pad * 2,
    }
    for (const other of placed) {
      if (
        rect.x + rect.w > other.x &&
        rect.x < other.x + other.w &&
        rect.y + rect.h > other.y &&
        rect.y < other.y + other.h
      ) return false
    }
    placed.push(rect)

    const hovered = hoverNode === node
    let color
    if (node.t === 'm') color = 'rgba(232, 197, 122, 0.95)'
    else if (node.t === 'c') color = 'rgba(170, 186, 216, 0.92)'
    else color = node.__color
    ctx.globalAlpha = isDimmed(node) ? 0.08 : hovered ? 1 : node.t === 'c' || node.t === 'm' ? 0.94 : 0.8
    ctx.fillStyle = color
    ctx.fillText(node.id, x, node.y + 0.3 / scale)
    return true
  }

  if (hoverNode) {
    drawLabel(hoverNode)
    for (const id of adjacency.get(hoverNode.id) || []) {
      const neighbor = nodeIndex.get(id)
      if (neighbor) drawLabel(neighbor)
    }
  }

  if (focusIds) {
    for (const node of nodes) {
      if (placed.length >= maxLabels) break
      if (focusIds.has(node.id)) drawLabel(node)
    }
  }

  for (const node of labelOrder) {
    if (placed.length >= maxLabels) break
    if (shouldLabel(node, scale)) drawLabel(node)
  }

  ctx.globalAlpha = 1
}

function linkColor(link) {
  const source = link.source
  const target = link.target
  if (!source || !target || typeof source !== 'object') return 'rgba(110, 140, 210, 0.08)'
  const base = link.k === 2 ? 'rgba(217, 164, 65, ' : link.k === 1 ? 'rgba(150, 170, 210, ' : 'rgba(110, 140, 210, '
  let alpha = link.k === 2 ? 0.12 : link.k === 1 ? 0.2 : 0.12
  if (focusIds) {
    if (hoverNode && (source === hoverNode || target === hoverNode)) alpha = 0.52
    else if (focusIds.has(source.id) && focusIds.has(target.id)) alpha = link.k === 1 ? 0.34 : 0.22
    else alpha = 0.012
  }
  return base + alpha + ')'
}

function linkWidth(link) {
  if (hoverNode && typeof link.source === 'object' && (link.source === hoverNode || link.target === hoverNode)) return 1.3
  return link.k === 1 ? 0.65 : 0.42
}

function makeTooltip(node) {
  if (node.t === 'c') {
    return `<div class="tcm-tip"><div class="tcm-tip-name">${escapeHtml(node.id)}</div><div class="tcm-tip-sub">功效分类 · ${degrees.get(node.id) || 0} 味药</div><div class="tcm-tip-hint">点击聚焦关联药物</div></div>`
  }
  if (node.t === 'm') {
    return `<div class="tcm-tip"><div class="tcm-tip-name">${escapeHtml(node.id.replace(/^归/, ''))}</div><div class="tcm-tip-sub">归经 · ${degrees.get(node.id) || 0} 味药</div><div class="tcm-tip-hint">点击聚焦关联药物</div></div>`
  }
  const chapter = groups.value[node.g]?.name || ''
  const lines = []
  if (node.sx) lines.push(`<span class="tcm-tip-label">性味</span>${escapeHtml(node.sx)}`)
  if (node.mer) lines.push(`<span class="tcm-tip-label">归经</span>${escapeHtml(node.mer)}`)
  if (node.eff) lines.push(`<span class="tcm-tip-label">功效</span>${escapeHtml(node.eff)}`)
  if (node.memo) lines.push(`<span class="tcm-tip-label">速记</span>${escapeHtml(node.memo)}`)
  return `<div class="tcm-tip"><div class="tcm-tip-name">${escapeHtml(node.id)}<span class="tcm-tip-chapter">${escapeHtml(chapter)}</span>${node.p ? '<span class="tcm-tip-pending">整理中</span>' : ''}</div>${lines.map((line) => `<div class="tcm-tip-line">${line}</div>`).join('')}<div class="tcm-tip-hint">点击进入笔记</div></div>`
}

function pickNodeAt(point) {
  if (!graph) return null
  const extra = 4 / graph.zoom()
  let best = null
  let bestDist = Infinity
  for (const node of nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue
    const dist = Math.hypot(node.x - point.x, node.y - point.y)
    if (dist <= node.__r + extra && dist < bestDist) {
      best = node
      bestDist = dist
    }
  }
  return best
}

function activateNode(node) {
  if (!isHub(node)) {
    if (node.u) router.go(node.u)
    return
  }
  activeHub = activeHub === node.id ? null : node.id
  activeGroup.value = -1
  searchIds = new Set()
  query.value = ''
  computeFocus()
  redraw()
}

function toggleGroup(index) {
  activeGroup.value = activeGroup.value === index ? -1 : index
  activeHub = null
  searchIds = new Set()
  query.value = ''
  computeFocus()
  redraw()
}

function zoomBy(factor) {
  if (graph) graph.zoom(graph.zoom() * factor, 280)
}

function fitView() {
  if (graph) graph.zoomToFit(480, 46)
}

function clearFocus() {
  activeGroup.value = -1
  activeHub = null
  query.value = ''
  searchIds = new Set()
  computeFocus()
  redraw()
}

function jumpToMatch() {
  if (!graph || !searchIds.size) return
  const node = nodes.find((item) => searchIds.has(item.id) && !isHub(item)) || nodeById([...searchIds][0])
  if (!node) return
  graph.centerAt(node.x, node.y, 520)
  graph.zoom(Math.max(graph.zoom(), 2.2), 520)
  hoverNode = node
  computeFocus()
  redraw()
}

watch(query, (value) => {
  const term = value.trim().toLowerCase()
  searchIds = new Set()
  if (term) {
    for (const node of nodes) {
      const haystack = `${node.id} ${node.eff || ''} ${node.memo || ''}`.toLowerCase()
      if (haystack.includes(term)) searchIds.add(node.id)
    }
    activeGroup.value = -1
    activeHub = null
  }
  computeFocus()
  redraw()
})

onMounted(async () => {
  try {
    // 图谱数据每次构建都会重生成，用 no-cache 避免浏览器沿用旧字段结构
    const response = await fetch(import.meta.env.BASE_URL + 'tcm-graph.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error(`图谱数据加载失败（${response.status}）`)
    const data = await response.json()
    if (disposed) return

    nodes = data.nodes
    groups.value = data.groups
    stats.value = data.stats
    nodeIndex = new Map(nodes.map((node) => [node.id, node]))

    degrees = new Map(nodes.map((node) => [node.id, 0]))
    adjacency = new Map(nodes.map((node) => [node.id, new Set()]))
    links = data.links.map(([source, target, kind]) => {
      const s = nodes[source].id
      const t = nodes[target].id
      degrees.set(s, degrees.get(s) + 1)
      degrees.set(t, degrees.get(t) + 1)
      adjacency.get(s).add(t)
      adjacency.get(t).add(s)
      return { source: s, target: t, k: kind }
    })
    for (const node of nodes) {
      node.__r = radiusOf(node)
      node.__color = node.t === 'd' || node.t === 'g' ? (groups.value[node.g]?.color || '#8fa7d8') : HUB_COLOR
    }
    labelOrder = [...nodes].sort((a, b) => {
      const rank = (node) => (node.t === 'm' ? 2 : node.t === 'c' ? 1 : 0)
      return rank(b) - rank(a) || (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0)
    })

    const { default: ForceGraph } = await import('force-graph')
    if (disposed || !container.value) return

    const box = container.value.getBoundingClientRect()
    graph = new ForceGraph(container.value)
      .width(Math.max(320, Math.floor(box.width)))
      .height(Math.max(320, Math.floor(box.height)))
      .nodeId('id')
      .nodeRelSize(1)
      .nodeVal((node) => node.__r * node.__r)
      .nodeCanvasObjectMode(() => 'replace')
      .nodeCanvasObject(paintNode)
      .nodeLabel(makeTooltip)
      .linkColor(linkColor)
      .linkWidth(linkWidth)
      .linkCurvature(0)
      .backgroundColor('rgba(0, 0, 0, 0)')
      .warmupTicks(50)
      .cooldownTicks(180)
      .d3AlphaDecay(0.032)
      .d3VelocityDecay(0.36)
      .onNodeHover((node) => {
        hoverNode = node || null
        computeFocus()
        redraw()
      })
      .onEngineStop(() => {
        if (!graph || didFit) return
        didFit = true
        graph.zoomToFit(520, 52)
      })
      .onRenderFramePost(paintLabels)

    const charge = graph.d3Force('charge')
    if (charge) charge.strength(-90).distanceMax(280)
    const linkForce = graph.d3Force('link')
    if (linkForce) linkForce.distance((link) => (link.k === 1 ? 44 : link.k === 2 ? 56 : 30))

    graph.graphData({ nodes, links })

    // 自己按节点坐标做命中检测：库自带的点击依赖影子画布，自动化/低帧率下会漏
    const el = container.value
    let downAt = null
    const pointers = new Set()
    let multiTouch = false
    const onPointerDown = (event) => {
      pointers.add(event.pointerId)
      if (pointers.size > 1) multiTouch = true
      if (event.button === 0) downAt = { x: event.clientX, y: event.clientY }
    }
    const onPointerUp = (event) => {
      pointers.delete(event.pointerId)
      const wasMulti = multiTouch
      if (pointers.size === 0) multiTouch = false
      if (!downAt || event.button !== 0) {
        downAt = null
        return
      }
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y)
      downAt = null
      // 双指缩放结束时不应触发节点点击
      if (wasMulti || moved > 5 || !graph) return
      const rect = el.getBoundingClientRect()
      const point = graph.screen2GraphCoords(event.clientX - rect.left, event.clientY - rect.top)
      const node = pickNodeAt(point)
      if (node) activateNode(node)
      else clearFocus()
    }
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    detachClicks = () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }

    loading.value = false
    requestAnimationFrame(() => {
      if (!graph) return
      graph.zoomToFit(0, 40)
    })

    if (typeof ResizeObserver !== 'undefined' && container.value) {
      resizeObserver = new ResizeObserver(() => {
        if (!graph || !container.value) return
        const rect = container.value.getBoundingClientRect()
        graph.width(Math.max(320, Math.floor(rect.width))).height(Math.max(320, Math.floor(rect.height)))
      })
      resizeObserver.observe(container.value)
    }
  } catch (err) {
    console.error(err)
    error.value = err?.message || '图谱加载失败'
    loading.value = false
  }
})

onBeforeUnmount(() => {
  disposed = true
  if (detachClicks) {
    detachClicks()
    detachClicks = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (graph) {
    graph._destructor()
    graph = null
  }
})
</script>

<style scoped>
.tcm-graph {
  margin: 26px 0 20px;
  border: 1px solid var(--sby-border);
  border-radius: 18px;
  overflow: hidden;
  background:
    radial-gradient(1200px 640px at 50% 0%, rgba(38, 58, 110, 0.28), transparent 62%),
    #070a12;
  box-shadow: 0 30px 80px -44px rgba(0, 0, 0, 0.85);
}

.tcm-graph-head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
  justify-content: space-between;
  padding: 13px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(17, 23, 40, 0.9), rgba(10, 14, 24, 0.72));
  backdrop-filter: blur(12px);
}

.tcm-graph-title {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #e2e7f5;
  font-size: 14px;
}

.tcm-graph-title strong {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.tcm-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6aa5ff;
  box-shadow: 0 0 0 0 rgba(106, 165, 255, 0.55);
  animation: tcm-pulse 2.8s var(--sby-ease-out) infinite;
}

@keyframes tcm-pulse {
  0% { box-shadow: 0 0 0 0 rgba(106, 165, 255, 0.45); }
  60% { box-shadow: 0 0 0 8px rgba(106, 165, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(106, 165, 255, 0); }
}

.tcm-stats {
  color: #7e88a5;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.tcm-graph-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tcm-search {
  width: 190px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.04);
  color: #e2e7f5;
  font-size: 12.5px;
  outline: none;
  transition: border-color 0.18s var(--sby-ease-out), background 0.18s var(--sby-ease-out);
}

.tcm-search::placeholder { color: #6c7692; }
.tcm-search:focus {
  border-color: rgba(106, 165, 255, 0.55);
  background: rgba(106, 165, 255, 0.08);
}

.tcm-zoom {
  display: flex;
  gap: 4px;
}

.tcm-zoom button {
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: #c9d2e8;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.18s var(--sby-ease-out), border-color 0.18s var(--sby-ease-out);
}

.tcm-zoom button:hover {
  background: rgba(106, 165, 255, 0.14);
  border-color: rgba(106, 165, 255, 0.4);
}

.tcm-canvas-wrap {
  position: relative;
  height: clamp(540px, 72vh, 800px);
}

.tcm-canvas {
  position: absolute;
  inset: 0;
  cursor: grab;
  touch-action: none;
  overscroll-behavior: contain;
}

.tcm-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8b95b0;
  font-size: 13px;
  letter-spacing: 0.08em;
  background: #070a12;
}

.tcm-error { color: #f1a3a3; letter-spacing: 0; }

.tcm-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 11px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 14, 24, 0.72);
}

.tcm-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: #97a2bd;
  font-size: 11.5px;
  cursor: pointer;
  transition: background 0.18s var(--sby-ease-out), border-color 0.18s var(--sby-ease-out), color 0.18s var(--sby-ease-out);
}

.tcm-chip i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.tcm-chip em {
  color: #606a86;
  font-size: 10px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
}

.tcm-chip:hover { color: #dbe4f8; background: rgba(255, 255, 255, 0.05); }
.tcm-chip.active {
  color: #eaf1ff;
  background: rgba(106, 165, 255, 0.14);
  border-color: rgba(106, 165, 255, 0.38);
}

.tcm-hubs {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: #6f7994;
  font-size: 11px;
}

.tcm-hub-c {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.2px solid rgba(150, 170, 210, 0.85);
}

.tcm-hub-m {
  width: 7px;
  height: 7px;
  margin-left: 6px;
  transform: rotate(45deg);
  background: #d9a441;
}

.tcm-hint {
  margin: 0;
  padding: 0 16px 12px;
  color: #5f6883;
  font-size: 11.5px;
  background: rgba(10, 14, 24, 0.72);
}

@media (max-width: 640px) {
  .tcm-graph-head { padding: 11px 12px; }
  .tcm-graph-tools { width: 100%; }
  .tcm-search { flex: 1; width: auto; }
  .tcm-canvas-wrap { height: 62vh; min-height: 420px; }
  .tcm-stats { display: none; }
  .tcm-hubs { margin-left: 0; }
}

:deep(.float-tooltip-kap) {
  max-width: 280px;
  padding: 0;
  border-radius: 12px;
  background: rgba(12, 16, 28, 0.94);
  border: 1px solid rgba(140, 165, 220, 0.24);
  box-shadow: 0 14px 40px -12px rgba(0, 0, 0, 0.8);
  color: #dfe6f6;
  font-family: var(--vp-font-family-base);
  backdrop-filter: blur(14px);
}

:deep(.tcm-tip) { padding: 10px 12px; }

:deep(.tcm-tip-name) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

:deep(.tcm-tip-chapter) {
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(106, 165, 255, 0.14);
  color: #8fb8ff;
  font-size: 10px;
  font-weight: 500;
}

:deep(.tcm-tip-pending) {
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: #8b95b0;
  font-size: 10px;
  font-weight: 500;
}

:deep(.tcm-tip-line) {
  margin: 3px 0;
  color: #aeb9d4;
  font-size: 12px;
  line-height: 1.55;
}

:deep(.tcm-tip-label) {
  display: inline-block;
  min-width: 2.4em;
  margin-right: 5px;
  color: #6f7a97;
  font-size: 11px;
}

:deep(.tcm-tip-sub) { color: #8f9ab6; font-size: 12px; }
:deep(.tcm-tip-hint) { margin-top: 6px; color: #5f6a86; font-size: 10.5px; }
</style>
