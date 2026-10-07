<script setup lang="ts">
import { computed, ref } from 'vue'

type Quadrant = {
  id: 'east' | 'north' | 'west' | 'south'
  name: string
  direction: string
  color: string
  mansions: readonly string[]
}

const quadrants: readonly Quadrant[] = [
  { id: 'east', name: '东方青龙', direction: '东宫', color: '#48c9bd', mansions: ['角', '亢', '氐', '房', '心', '尾', '箕'] },
  { id: 'north', name: '北方玄武', direction: '北宫', color: '#72a7e8', mansions: ['斗', '牛', '女', '虚', '危', '室', '壁'] },
  { id: 'west', name: '西方白虎', direction: '西宫', color: '#c4d2e8', mansions: ['奎', '娄', '胃', '昴', '毕', '觜', '参'] },
  { id: 'south', name: '南方朱雀', direction: '南宫', color: '#e68778', mansions: ['井', '鬼', '柳', '星', '张', '翼', '轸'] },
]

const books = [
  { title: '黄帝内经', detail: '素问 · 灵枢', href: '/四大经典/黄帝内经/' },
  { title: '伤寒论', detail: '六经辨证', href: '/四大经典/伤寒论/' },
  { title: '金匮要略', detail: '杂病篇目', href: '/四大经典/金匮要略/' },
  { title: '神农本草经', detail: '三品本草', href: '/四大经典/神农本草经/' },
] as const

const mansions = quadrants.flatMap((quadrant, quadrantIndex) =>
  quadrant.mansions.map((name, mansionIndex) => ({
    name,
    quadrant,
    quadrantIndex,
    mansionIndex,
  })),
)

const dial = ref<HTMLElement | null>(null)
const rotation = ref(0)
const selectedIndex = ref(0)
const dragging = ref(false)
const STEP = 360 / mansions.length
const ticks = Array.from({ length: 84 }, (_, index) => ({
  angle: index * (360 / 84),
  major: index % 3 === 0,
}))

let activePointer: number | null = null
let previousPointerAngle = 0
let dragDistance = 0
let pointerCaptured = false
let suppressClickUntil = 0

const selected = computed(() => mansions[selectedIndex.value])
const selectedGroupStart = computed(() => selected.value.quadrantIndex * 7)
const rotorTransform = computed(() => `rotate(${rotation.value} 300 300)`)

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}

function pointerAngle(event: PointerEvent) {
  const rect = dial.value!.getBoundingClientRect()
  return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI
}

function shortestDelta(current: number, previous: number) {
  return modulo(current - previous + 180, 360) - 180
}

function selectMansion(index: number, snap = true) {
  selectedIndex.value = modulo(index, mansions.length)
  if (snap) rotation.value = -selectedIndex.value * STEP
}

function selectFromClick(index: number) {
  if (performance.now() < suppressClickUntil) return
  selectMansion(index)
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || activePointer !== null) return
  activePointer = event.pointerId
  previousPointerAngle = pointerAngle(event)
  dragDistance = 0
  pointerCaptured = false
  dragging.value = false
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== activePointer) return
  const angle = pointerAngle(event)
  const delta = shortestDelta(angle, previousPointerAngle)
  rotation.value += delta
  dragDistance += Math.abs(delta)
  previousPointerAngle = angle

  // Capturing on pointerdown retargets an ordinary click from the mansion to
  // the dial. Wait until this is clearly a drag so both gestures keep working.
  if (dragDistance > 2 && !pointerCaptured) {
    pointerCaptured = true
    dragging.value = true
    try {
      dial.value?.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic tests may not create a native active pointer.
    }
  }
}

function finishPointer(event: PointerEvent, cancelled = false) {
  if (event.pointerId !== activePointer) return
  if (pointerCaptured) {
    try {
      if (dial.value?.hasPointerCapture(event.pointerId)) dial.value.releasePointerCapture(event.pointerId)
    } catch {
      // The browser may already have cancelled capture.
    }
  }
  activePointer = null
  pointerCaptured = false
  dragging.value = false
  if (cancelled) return

  if (dragDistance > 2) {
    suppressClickUntil = performance.now() + 300
    selectMansion(Math.round(-rotation.value / STEP))
  }
}

function onDialKeydown(event: KeyboardEvent) {
  let target: number | null = null
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = selectedIndex.value + 1
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = selectedIndex.value - 1
  else if (event.key === 'Home') target = 0
  else if (event.key === 'End') target = mansions.length - 1
  if (target === null) return
  event.preventDefault()
  selectMansion(target)
}

function mansionTransform(index: number) {
  return `rotate(${index * STEP} 300 300)`
}

function uprightTransform(index: number) {
  return `rotate(${-index * STEP - rotation.value} 300 69)`
}

function arcPath(startAngle: number, endAngle: number, radius = 250) {
  const point = (angle: number) => {
    const radians = angle * Math.PI / 180
    return { x: 300 + radius * Math.sin(radians), y: 300 - radius * Math.cos(radians) }
  }
  const start = point(startAngle)
  const end = point(endAngle)
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`
}
</script>

<template>
  <section class="constellation" aria-labelledby="constellation-title">
    <header class="section-heading">
      <p>二十八宿 · 星图观测仪</p>
      <h2 id="constellation-title">拨转天盘，循宿览书</h2>
      <span>拖动圆盘或使用方向键选择星宿；点击四象可快速定位。</span>
    </header>

    <div class="observatory">
      <div class="dial-column">
        <div
          ref="dial"
          class="dial"
          :class="{ dragging }"
          role="application"
          tabindex="0"
          data-testid="constellation-dial"
          :aria-label="`二十八宿旋转星盘，当前选择${selected.quadrant.name}${selected.name}宿。按左右方向键切换，Home 键归位。`"
          @keydown="onDialKeydown"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="finishPointer"
          @pointercancel="finishPointer($event, true)"
        >
          <svg viewBox="0 0 600 600" aria-hidden="true">
            <defs>
              <radialGradient id="instrument-core" cx="50%" cy="42%">
                <stop offset="0" stop-color="#77dcff" stop-opacity=".2" />
                <stop offset=".58" stop-color="#173454" stop-opacity=".12" />
                <stop offset="1" stop-color="#07111e" stop-opacity="0" />
              </radialGradient>
              <filter id="selected-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <circle class="dish" cx="300" cy="300" r="288" />
            <circle class="orbit orbit-outer" cx="300" cy="300" r="267" />
            <circle class="orbit" cx="300" cy="300" r="226" />
            <circle class="orbit orbit-dashed" cx="300" cy="300" r="184" />
            <circle class="orbit" cx="300" cy="300" r="139" />
            <path class="reticle" d="M300 112V488M112 300H488M167 167L433 433M433 167L167 433" />

            <g :transform="rotorTransform" class="rotor">
              <path
                v-for="(quadrant, index) in quadrants"
                :key="quadrant.id"
                class="quadrant-arc"
                :d="arcPath(index * 90 + 2, (index + 1) * 90 - 2)"
                :stroke="quadrant.color"
              />
              <line
                v-for="tick in ticks"
                :key="tick.angle"
                class="tick"
                :class="{ major: tick.major }"
                x1="300"
                :y1="tick.major ? 36 : 42"
                x2="300"
                y2="51"
                :transform="`rotate(${tick.angle} 300 300)`"
              />

              <g
                v-for="(mansion, index) in mansions"
                :key="`${mansion.quadrant.id}-${mansion.name}`"
                class="mansion"
                :class="{ selected: selectedIndex === index }"
                :style="{ '--mansion-color': mansion.quadrant.color }"
                :transform="mansionTransform(index)"
                data-testid="mansion-button"
                :data-name="mansion.name"
                @click.stop="selectFromClick(index)"
              >
                <circle v-if="selectedIndex === index" class="signal-ring" cx="300" cy="69" r="18" />
                <circle class="star-node" cx="300" cy="69" :r="selectedIndex === index ? 7 : 4.5" />
                <g :transform="uprightTransform(index)">
                  <rect class="label-plate" x="282" y="82" width="36" height="30" rx="8" />
                  <text class="mansion-name" x="300" y="103" text-anchor="middle">{{ mansion.name }}</text>
                </g>
              </g>
            </g>

            <circle class="core-halo" cx="300" cy="300" r="123" fill="url(#instrument-core)" />
            <circle class="core" cx="300" cy="300" r="91" />
            <circle class="core-index" cx="300" cy="300" r="73" />
            <path class="north-mark" d="M300 190l-8 17h16z" />
            <text class="core-overline" x="300" y="270" text-anchor="middle">CELESTIAL SECTOR</text>
            <text class="core-name" x="300" y="322" text-anchor="middle">{{ selected.name }}</text>
            <text class="core-meta" x="300" y="350" text-anchor="middle">{{ selected.quadrant.direction }} · {{ String(selectedIndex + 1).padStart(2, '0') }}/28</text>
          </svg>
          <span class="drag-hint" aria-hidden="true">拖动旋转</span>
        </div>

        <div class="dial-controls" aria-label="星盘控制">
          <button type="button" aria-label="选择上一宿" @click="selectMansion(selectedIndex - 1)">← 一宿</button>
          <button type="button" @click="selectMansion(0)">归位 · 角</button>
          <button type="button" aria-label="选择下一宿" @click="selectMansion(selectedIndex + 1)">一宿 →</button>
        </div>
      </div>

      <aside class="readout" aria-live="polite">
        <div class="readout-status">
          <span>OBSERVATION / {{ String(selectedIndex + 1).padStart(2, '0') }}</span>
          <i :style="{ background: selected.quadrant.color }"></i>
          <b>{{ selected.quadrant.name }}</b>
        </div>
        <p class="selected-name"><strong>{{ selected.name }}</strong><span>宿</span></p>

        <div class="quadrant-tabs" aria-label="选择四象">
          <button
            v-for="(quadrant, index) in quadrants"
            :key="quadrant.id"
            type="button"
            data-testid="quadrant-tab"
            :aria-pressed="selected.quadrant.id === quadrant.id"
            :class="{ active: selected.quadrant.id === quadrant.id }"
            :style="{ '--tab-color': quadrant.color }"
            @click="selectMansion(index * 7)"
          >
            {{ quadrant.name }}
          </button>
        </div>

        <div class="group-mansions">
          <span>本象七宿</span>
          <div>
            <button
              v-for="(name, index) in selected.quadrant.mansions"
              :key="name"
              type="button"
              :aria-current="selected.name === name ? 'true' : undefined"
              @click="selectMansion(selectedGroupStart + index)"
            >{{ name }}</button>
          </div>
        </div>

        <details class="all-mansions" data-testid="mansion-list">
          <summary>展开二十八宿完整名单</summary>
          <div v-for="(quadrant, quadrantIndex) in quadrants" :key="quadrant.id">
            <span>{{ quadrant.name }}</span>
            <p>
              <button
                v-for="(name, index) in quadrant.mansions"
                :key="name"
                type="button"
                :aria-current="selected.name === name ? 'true' : undefined"
                @click="selectMansion(quadrantIndex * 7 + index)"
              >{{ name }}</button>
            </p>
          </div>
        </details>

        <div class="book-navigation">
          <div class="panel-title">
            <span>本站书目入口</span>
            <small>四大经典</small>
          </div>
          <a
            v-for="book in books"
            :key="book.href"
            :href="book.href"
            data-testid="book-link"
          >
            <span><b>{{ book.title }}</b><small>{{ book.detail }}</small></span>
            <em>进入篇目 →</em>
          </a>
        </div>

        <p class="editorial-note">
          星宿导览是本站的导航设计；四象与四大经典并非历史上的逐一对应关系。
        </p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.constellation {
  --instrument-bg: rgba(245, 249, 255, 0.78);
  --instrument-panel: rgba(255, 255, 255, 0.72);
  --instrument-line: rgba(33, 82, 125, 0.18);
  --instrument-line-strong: rgba(42, 122, 180, 0.38);
  --instrument-text: #162638;
  --instrument-muted: #627489;
  position: relative;
  margin: 38px auto 0;
  padding: clamp(18px, 3vw, 30px);
  overflow: hidden;
  color: var(--instrument-text);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, .5), transparent 42%),
    radial-gradient(circle at 20% 10%, rgba(73, 179, 224, .13), transparent 34%),
    var(--instrument-bg);
  border: 1px solid var(--instrument-line);
  border-radius: 24px;
  box-shadow: 0 24px 70px -45px rgba(17, 65, 105, .55);
  backdrop-filter: blur(22px) saturate(130%);
}
:global(.dark .constellation) {
  --instrument-bg: rgba(8, 18, 31, 0.82);
  --instrument-panel: rgba(12, 29, 47, 0.7);
  --instrument-line: rgba(130, 201, 238, 0.14);
  --instrument-line-strong: rgba(105, 208, 249, 0.35);
  --instrument-text: #e5f3fb;
  --instrument-muted: #8fa8ba;
  box-shadow: 0 30px 90px -48px rgba(43, 178, 232, .55);
}
.constellation::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--instrument-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--instrument-line) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,.34), transparent 55%);
}
.section-heading { position: relative; text-align: center; max-width: 680px; margin: 0 auto 20px; }
.section-heading p { margin: 0; color: #2c91be; font: 600 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .24em; }
.section-heading h2 { margin: 8px 0 7px; font-size: clamp(23px, 3vw, 34px); font-weight: 500; letter-spacing: .16em; }
.section-heading span { color: var(--instrument-muted); font-size: 13px; }
.observatory { position: relative; display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(280px, .8fr); gap: clamp(20px, 4vw, 42px); align-items: center; }
.dial-column { min-width: 0; }
.dial { position: relative; max-width: 620px; margin: auto; aspect-ratio: 1; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; outline: none; }
.dial.dragging { cursor: grabbing; }
.dial:focus-visible { border-radius: 50%; box-shadow: 0 0 0 3px rgba(65, 176, 226, .45); }
.dial svg { display: block; width: 100%; height: 100%; overflow: visible; }
.dish { fill: rgba(74, 147, 184, .035); stroke: var(--instrument-line); stroke-width: 1; }
.orbit { fill: none; stroke: var(--instrument-line); stroke-width: 1; }
.orbit-outer { stroke: var(--instrument-line-strong); stroke-width: 1.4; }
.orbit-dashed { stroke-dasharray: 3 8; }
.reticle { fill: none; stroke: var(--instrument-line); stroke-width: .8; stroke-dasharray: 2 10; }
.rotor { transition: transform .28s cubic-bezier(.2,.8,.2,1); transform-origin: center; }
.dragging .rotor { transition: none; }
.quadrant-arc { fill: none; stroke-width: 5; stroke-linecap: round; opacity: .68; }
.tick { stroke: var(--instrument-muted); stroke-width: 1; opacity: .38; }
.tick.major { stroke: #58bfe9; stroke-width: 1.6; opacity: .8; }
.mansion { cursor: pointer; color: var(--mansion-color); }
.star-node { fill: var(--instrument-bg); stroke: currentColor; stroke-width: 2; transition: r .2s ease, fill .2s ease; }
.mansion:hover .star-node, .mansion.selected .star-node { fill: currentColor; }
.signal-ring { fill: none; stroke: currentColor; stroke-width: 1.5; opacity: .7; filter: url(#selected-glow); }
.label-plate { fill: var(--instrument-panel); stroke: var(--instrument-line); stroke-width: 1; }
.mansion-name { fill: var(--instrument-text); font-size: 16px; font-weight: 600; }
.mansion.selected .mansion-name { fill: currentColor; }
.core-halo { pointer-events: none; }
.core { fill: var(--instrument-panel); stroke: var(--instrument-line-strong); stroke-width: 1.4; }
.core-index { fill: none; stroke: var(--instrument-line); stroke-width: 1; stroke-dasharray: 3 5; }
.north-mark { fill: #58c7ec; opacity: .8; }
.core-overline, .core-meta { fill: var(--instrument-muted); font: 10px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: 2px; }
.core-name { fill: var(--instrument-text); font-size: 44px; font-weight: 500; }
.core-meta { letter-spacing: 1px; }
.drag-hint { position: absolute; left: 50%; bottom: 4%; translate: -50% 0; padding: 4px 10px; border: 1px solid var(--instrument-line); border-radius: 999px; color: var(--instrument-muted); background: var(--instrument-panel); font-size: 11px; letter-spacing: .15em; pointer-events: none; }
.dial-controls { display: flex; justify-content: center; gap: 8px; margin-top: -3px; }
.dial-controls button, .quadrant-tabs button, .group-mansions button { border: 1px solid var(--instrument-line); color: var(--instrument-text); background: var(--instrument-panel); cursor: pointer; }
.dial-controls button { min-height: 38px; padding: 7px 13px; border-radius: 9px; }
.dial-controls button:hover, .dial-controls button:focus-visible { border-color: var(--instrument-line-strong); }
.readout { min-width: 0; padding: 19px; background: var(--instrument-panel); border: 1px solid var(--instrument-line); border-radius: 18px; box-shadow: inset 0 1px rgba(255,255,255,.08); }
.readout-status { display: grid; grid-template-columns: 1fr auto; gap: 6px 9px; align-items: center; padding-bottom: 13px; border-bottom: 1px solid var(--instrument-line); }
.readout-status span { color: var(--instrument-muted); font: 10px ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .14em; }
.readout-status i { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 12px currentColor; }
.readout-status b { grid-column: 1 / -1; font-weight: 500; letter-spacing: .12em; }
.selected-name { display: flex; align-items: baseline; gap: 7px; margin: 14px 0; }
.selected-name strong { font-size: clamp(42px, 6vw, 68px); font-weight: 400; line-height: 1; }
.selected-name span { color: var(--instrument-muted); font-size: 18px; }
.quadrant-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.quadrant-tabs button { min-height: 38px; padding: 7px; border-radius: 8px; font-size: 12px; }
.quadrant-tabs button.active { color: var(--tab-color); border-color: var(--tab-color); box-shadow: inset 0 0 18px color-mix(in srgb, var(--tab-color) 10%, transparent); }
.group-mansions { margin-top: 16px; }
.group-mansions > span, .panel-title { color: var(--instrument-muted); font-size: 11px; letter-spacing: .14em; }
.group-mansions > div { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: 7px; }
.group-mansions button { aspect-ratio: 1; border-radius: 7px; padding: 0; }
.group-mansions button[aria-current="true"] { color: #37a9d7; border-color: var(--instrument-line-strong); }
.all-mansions { margin-top: 14px; color: var(--instrument-muted); font-size: 12px; }
.all-mansions summary { min-height: 40px; display: flex; align-items: center; cursor: pointer; border-top: 1px solid var(--instrument-line); }
.all-mansions > div { margin-top: 8px; }
.all-mansions > div > span { letter-spacing: .12em; }
.all-mansions p { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin: 5px 0 9px; }
.all-mansions button { min-width: 0; aspect-ratio: 1; padding: 0; color: var(--instrument-text); border: 1px solid var(--instrument-line); border-radius: 7px; background: var(--instrument-panel); cursor: pointer; }
.all-mansions button[aria-current="true"] { color: #37a9d7; border-color: var(--instrument-line-strong); }
.book-navigation { margin-top: 20px; }
.panel-title { display: flex; justify-content: space-between; margin-bottom: 7px; }
.panel-title small { font: inherit; }
.book-navigation a { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 2px; color: var(--instrument-text); border-top: 1px solid var(--instrument-line); text-decoration: none; }
.book-navigation a:hover b, .book-navigation a:focus-visible b { color: #319fcf; }
.book-navigation a span { display: flex; flex-direction: column; gap: 2px; }
.book-navigation a b { font-size: 14px; font-weight: 500; }
.book-navigation a small, .book-navigation a em { color: var(--instrument-muted); font-size: 11px; font-style: normal; }
.editorial-note { margin: 14px 0 0; padding-top: 12px; color: var(--instrument-muted); border-top: 1px solid var(--instrument-line); font-size: 11px; line-height: 1.65; }
@media (max-width: 820px) {
  .observatory { grid-template-columns: 1fr; }
  .dial { max-width: 560px; }
  .readout { max-width: 560px; width: 100%; margin: auto; }
}
@media (max-width: 520px) {
  .constellation { margin-inline: -8px; padding: 16px 10px; border-radius: 18px; }
  .section-heading h2 { letter-spacing: .08em; }
  .section-heading span { display: block; padding-inline: 12px; }
  .mansion-name { font-size: 22px; }
  .drag-hint { display: none; }
  .readout { padding: 15px; }
  .dial-controls { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
  .dial-controls button { min-width: 0; min-height: 44px; padding-inline: 4px; font-size: 12px; }
  .quadrant-tabs button { min-height: 44px; }
  .group-mansions > div, .all-mansions p { grid-template-columns: repeat(4, minmax(44px, 1fr)); }
  .group-mansions button, .all-mansions button { min-height: 44px; aspect-ratio: auto; }
  .all-mansions summary { min-height: 44px; }
  .book-navigation a { min-height: 49px; }
}
@media (prefers-reduced-motion: reduce) {
  .rotor, .star-node { transition: none; }
}
@media (prefers-reduced-transparency: reduce) {
  .constellation { backdrop-filter: none; background: var(--instrument-bg); }
}
</style>
