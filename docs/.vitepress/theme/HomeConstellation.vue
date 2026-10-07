<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type Quadrant = {
  id: 'east' | 'north' | 'west' | 'south'
  name: string
  mansions: readonly string[]
}

type SelectedMansion = {
  name: string
  quadrant: string
  index: number
}

const emit = defineEmits<{
  'update:selected': [selection: SelectedMansion]
}>()

const quadrants: readonly Quadrant[] = [
  { id: 'east', name: '东方青龙', mansions: ['角', '亢', '氐', '房', '心', '尾', '箕'] },
  { id: 'north', name: '北方玄武', mansions: ['斗', '牛', '女', '虚', '危', '室', '壁'] },
  { id: 'west', name: '西方白虎', mansions: ['奎', '娄', '胃', '昴', '毕', '觜', '参'] },
  { id: 'south', name: '南方朱雀', mansions: ['井', '鬼', '柳', '星', '张', '翼', '轸'] },
]

const CENTER = 590
const PRIMARY_RADIUS = 475
const TARGET_ANGLE = -65
const STEP = 360 / 28
const DRAG_THRESHOLD = 6

const mansions = quadrants.flatMap((quadrant, quadrantIndex) =>
  quadrant.mansions.map((name, mansionIndex) => {
    const index = quadrantIndex * 7 + mansionIndex
    const angle = TARGET_ANGLE + index * STEP
    const radians = angle * Math.PI / 180
    const radialX = Math.cos(radians)
    const radialY = Math.sin(radians)
    const tangentX = -radialY
    const tangentY = radialX
    const point = (tangent: number, radial: number) => ({
      x: CENTER + (PRIMARY_RADIUS + radial) * radialX + tangent * tangentX,
      y: CENTER + (PRIMARY_RADIUS + radial) * radialY + tangent * tangentY,
    })
    const offsets = [
      [-18, 5],
      [-7, -8 - (index % 3) * 2],
      [5, 3],
      [17 + (index % 4), -6],
    ] as const
    const stars = offsets.map(([tangent, radial]) => point(tangent, radial))

    return {
      name,
      quadrant,
      index,
      x: CENTER + PRIMARY_RADIUS * radialX,
      y: CENTER + PRIMARY_RADIUS * radialY,
      stars,
      line: stars.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    }
  }),
)

const ticks = Array.from({ length: 140 }, (_, index) => ({
  angle: index * (360 / 140),
  major: index % 5 === 0,
}))

const atmosphereStars = Array.from({ length: 54 }, (_, index) => {
  const angle = ((index * 137.508) + (index % 5) * 7) * Math.PI / 180
  const radius = 350 + ((index * 47) % 190)
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
    radius: index % 9 === 0 ? 2 : index % 3 === 0 ? 1.35 : .8,
  }
})

const atmosphereLines = Array.from({ length: 14 }, (_, index) => ({
  start: atmosphereStars[(index * 3) % atmosphereStars.length],
  end: atmosphereStars[(index * 3 + 1) % atmosphereStars.length],
}))

const dial = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)
const rotation = ref(0)
const selectedIndex = ref(0)
const dragging = ref(false)
const reducedMotion = ref(false)
const wheelTransform = computed(() => `rotate(${rotation.value} ${CENTER} ${CENTER})`)
const selected = computed(() => mansions[selectedIndex.value])

let activePointer: number | null = null
let pointerCaptured = false
let startX = 0
let startY = 0
let startAngle = 0
let previousAngle = 0
let previousTime = 0
let angularVelocity = 0
let animationFrame = 0
let suppressClickUntil = 0
let motionQuery: MediaQueryList | null = null

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}

function shortestDelta(current: number, previous: number) {
  return modulo(current - previous + 180, 360) - 180
}

function pointerAngle(event: PointerEvent) {
  const rect = svg.value!.getBoundingClientRect()
  const scaleX = 1180 / rect.width
  const scaleY = 1180 / rect.height
  const x = (event.clientX - rect.left) * scaleX
  const y = (event.clientY - rect.top) * scaleY
  return Math.atan2(y - CENTER, x - CENTER) * 180 / Math.PI
}

function updateSelection() {
  const next = modulo(Math.round(-rotation.value / STEP), mansions.length)
  if (next === selectedIndex.value) return
  selectedIndex.value = next
  announceSelection()
}

function announceSelection() {
  const mansion = mansions[selectedIndex.value]
  emit('update:selected', {
    name: mansion.name,
    quadrant: mansion.quadrant.name,
    index: mansion.index,
  })
}

function cancelAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

function equivalentTarget(index: number) {
  const canonical = -modulo(index, mansions.length) * STEP
  return rotation.value + shortestDelta(canonical, rotation.value)
}

function springTo(target: number, initialVelocity = 0) {
  cancelAnimation()
  if (reducedMotion.value) {
    rotation.value = target
    updateSelection()
    return
  }

  let velocity = initialVelocity
  const frame = () => {
    const distance = target - rotation.value
    velocity = (velocity + distance * .11) * .76
    rotation.value += velocity

    if (Math.abs(distance) < .025 && Math.abs(velocity) < .025) {
      rotation.value = target
      animationFrame = 0
      return
    }
    animationFrame = requestAnimationFrame(frame)
  }
  animationFrame = requestAnimationFrame(frame)
}

function selectMansion(index: number) {
  const normalized = modulo(index, mansions.length)
  selectedIndex.value = normalized
  announceSelection()
  springTo(equivalentTarget(normalized))
}

function selectFromClick(index: number) {
  if (performance.now() < suppressClickUntil) return
  selectMansion(index)
}

function startInertia(velocity: number) {
  cancelAnimation()
  if (reducedMotion.value || Math.abs(velocity) < .08) {
    springTo(equivalentTarget(selectedIndex.value))
    return
  }

  let currentVelocity = velocity
  const frame = () => {
    currentVelocity *= .94
    rotation.value += currentVelocity
    updateSelection()

    if (Math.abs(currentVelocity) < .08) {
      animationFrame = 0
      springTo(equivalentTarget(selectedIndex.value), currentVelocity)
      return
    }
    animationFrame = requestAnimationFrame(frame)
  }
  animationFrame = requestAnimationFrame(frame)
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || activePointer !== null) return
  cancelAnimation()
  dial.value?.focus({ preventScroll: true })
  activePointer = event.pointerId
  pointerCaptured = false
  startX = event.clientX
  startY = event.clientY
  startAngle = pointerAngle(event)
  previousAngle = startAngle
  previousTime = event.timeStamp
  angularVelocity = 0
  dragging.value = false
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== activePointer) return
  const distance = Math.hypot(event.clientX - startX, event.clientY - startY)

  if (!pointerCaptured) {
    if (distance < DRAG_THRESHOLD) return
    pointerCaptured = true
    dragging.value = true
    try {
      svg.value?.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointer events may not have an active native pointer.
    }
    const currentAngle = pointerAngle(event)
    const delta = shortestDelta(currentAngle, startAngle)
    rotation.value += delta
    previousAngle = currentAngle
    previousTime = event.timeStamp
    updateSelection()
    return
  }

  const currentAngle = pointerAngle(event)
  const delta = shortestDelta(currentAngle, previousAngle)
  const elapsed = Math.max(1, event.timeStamp - previousTime)
  rotation.value += delta
  angularVelocity = angularVelocity * .55 + (delta / elapsed * 16.667) * .45
  previousAngle = currentAngle
  previousTime = event.timeStamp
  updateSelection()
}

function finishPointer(event: PointerEvent, cancelled = false) {
  if (event.pointerId !== activePointer) return
  const wasDragging = pointerCaptured
  if (pointerCaptured) {
    try {
      if (svg.value?.hasPointerCapture(event.pointerId)) svg.value.releasePointerCapture(event.pointerId)
    } catch {
      // The browser may already have released capture.
    }
  }
  activePointer = null
  pointerCaptured = false
  dragging.value = false

  if (!wasDragging) return
  suppressClickUntil = performance.now() + 320
  if (cancelled) {
    springTo(equivalentTarget(selectedIndex.value))
    return
  }
  startInertia(angularVelocity)
}

function onDialKeydown(event: KeyboardEvent) {
  let next: number | null = null
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = selectedIndex.value + 1
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = selectedIndex.value - 1
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = mansions.length - 1
  if (next === null) return
  event.preventDefault()
  selectMansion(next)
}

function labelTransform(mansion: typeof mansions[number]) {
  return `rotate(${-rotation.value} ${mansion.x} ${mansion.y})`
}

function onMotionPreference(event: MediaQueryListEvent) {
  reducedMotion.value = event.matches
  if (event.matches) cancelAnimation()
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionPreference)
  announceSelection()
})

onBeforeUnmount(() => {
  cancelAnimation()
  motionQuery?.removeEventListener('change', onMotionPreference)
})
</script>

<template>
  <div
    ref="dial"
    class="celestial-orbit"
    :class="{ dragging }"
    role="application"
    tabindex="0"
    data-testid="constellation-dial"
    :aria-label="`二十八宿星轮，当前选择${selected.quadrant.name}${selected.name}宿。使用方向键切换星宿。`"
    @keydown="onDialKeydown"
  >
    <svg
      ref="svg"
      viewBox="0 0 1180 1180"
      aria-hidden="true"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="finishPointer"
      @pointercancel="finishPointer($event, true)"
    >
      <defs>
        <radialGradient id="celestial-fade" gradientUnits="userSpaceOnUse" cx="590" cy="590" r="560">
          <stop offset="0" stop-color="black" />
          <stop offset="55%" stop-color="black" />
          <stop offset="83%" stop-color="white" />
          <stop offset="100%" stop-color="white" />
        </radialGradient>
        <mask id="celestial-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1180" height="1180">
          <rect width="1180" height="1180" fill="url(#celestial-fade)" />
        </mask>
        <filter id="mansion-halo" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <circle
        class="interaction-ring"
        :cx="CENTER"
        :cy="CENTER"
        :r="PRIMARY_RADIUS"
      />

      <g class="wheel-graphics" :transform="wheelTransform" mask="url(#celestial-mask)">
        <circle class="orbit orbit-outer" :cx="CENTER" :cy="CENTER" r="520" />
        <circle class="orbit orbit-primary" :cx="CENTER" :cy="CENTER" r="475" />
        <circle class="orbit orbit-inner" :cx="CENTER" :cy="CENTER" r="430" />
        <circle class="orbit orbit-echo" :cx="CENTER" :cy="CENTER" r="452" />
        <circle class="orbit orbit-echo orbit-echo-wide" :cx="CENTER" :cy="CENTER" r="498" />

        <g class="ticks">
          <line
            v-for="tick in ticks"
            :key="tick.angle"
            class="tick"
            :class="{ major: tick.major }"
            :x1="CENTER"
            :y1="tick.major ? 63 : 68"
            :x2="CENTER"
            :y2="tick.major ? 82 : 77"
            :transform="`rotate(${tick.angle} ${CENTER} ${CENTER})`"
          />
        </g>

        <g class="atmosphere">
          <line
            v-for="(line, index) in atmosphereLines"
            :key="`line-${index}`"
            :x1="line.start.x"
            :y1="line.start.y"
            :x2="line.end.x"
            :y2="line.end.y"
          />
          <circle
            v-for="(star, index) in atmosphereStars"
            :key="`star-${index}`"
            :cx="star.x"
            :cy="star.y"
            :r="star.radius"
          />
        </g>

        <g
          v-for="mansion in mansions"
          :key="`${mansion.quadrant.id}-${mansion.name}`"
          class="mansion"
          :class="{ selected: selectedIndex === mansion.index }"
          data-testid="mansion-button"
          :data-name="mansion.name"
          @click.stop="selectFromClick(mansion.index)"
        >
          <polyline class="constellation-line" :points="mansion.line" />
          <circle
            v-for="(star, starIndex) in mansion.stars"
            :key="starIndex"
            class="cluster-star"
            :cx="star.x"
            :cy="star.y"
            :r="starIndex === 1 ? 2.2 : 1.25"
          />
          <circle class="mansion-hit" :cx="mansion.x" :cy="mansion.y" r="22" />
          <circle class="mansion-star" :cx="mansion.x" :cy="mansion.y" :r="selectedIndex === mansion.index ? 6.5 : 3" />
          <g class="label" :transform="labelTransform(mansion)">
            <text :x="mansion.x" :y="mansion.y - 17" text-anchor="middle">{{ mansion.name }}</text>
          </g>
        </g>
      </g>

    </svg>
    <span class="sr-only" aria-live="polite">已选择{{ selected.quadrant.name }}{{ selected.name }}宿</span>
  </div>
</template>

<style scoped>
.celestial-orbit {
  --orbit-cyan: #376f88;
  --orbit-gold: #b8a06b;
  position: absolute;
  z-index: 0;
  top: -80px;
  left: 50%;
  width: 1180px;
  height: 1180px;
  color: var(--orbit-cyan);
  pointer-events: none;
  transform: translateX(-50%);
  outline: none;
}
:global(.dark .celestial-orbit) {
  --orbit-cyan: #89d8ee;
  --orbit-gold: #b8a06b;
}
.celestial-orbit:focus-visible::after {
  content: '';
  position: absolute;
  inset: 8.5%;
  border: 1px solid color-mix(in srgb, var(--orbit-cyan) 35%, transparent);
  border-radius: 50%;
}
svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.orbit {
  fill: none;
  stroke: var(--orbit-cyan);
  vector-effect: non-scaling-stroke;
}
.orbit-outer { stroke-width: 1.2; opacity: .25; }
.orbit-primary { stroke-width: 1; opacity: .35; }
.orbit-inner { stroke-width: .8; opacity: .19; stroke-dasharray: 2 9; }
.orbit-echo { stroke: var(--orbit-gold); stroke-width: .7; opacity: .16; stroke-dasharray: 1 6; }
.orbit-echo-wide { stroke-dasharray: 20 12 2 12; opacity: .12; }
.tick {
  stroke: var(--orbit-cyan);
  stroke-width: .7;
  opacity: .14;
  vector-effect: non-scaling-stroke;
}
.tick.major { stroke: var(--orbit-gold); stroke-width: 1; opacity: .28; }
.atmosphere { fill: var(--orbit-cyan); stroke: var(--orbit-cyan); }
.atmosphere circle { opacity: .22; }
.atmosphere line { stroke-width: .6; opacity: .12; vector-effect: non-scaling-stroke; }
.mansion {
  color: var(--orbit-cyan);
  cursor: pointer;
  pointer-events: all;
  touch-action: none;
}
.constellation-line {
  fill: none;
  stroke: currentColor;
  stroke-width: .7;
  opacity: .2;
  vector-effect: non-scaling-stroke;
}
.cluster-star { fill: currentColor; opacity: .42; }
.mansion-hit { fill: transparent; stroke: none; }
.mansion-star {
  fill: var(--orbit-gold);
  stroke: var(--orbit-cyan);
  stroke-width: 1;
  opacity: .58;
  vector-effect: non-scaling-stroke;
}
.label text {
  transition: font-size .24s ease, opacity .24s ease;
  fill: currentColor;
  font-family: "Kaiti SC", "STKaiti", "KaiTi", "Songti SC", serif;
  font-size: 15px;
  letter-spacing: .08em;
  opacity: .55;
  paint-order: stroke;
  stroke: transparent;
  stroke-width: 0;
}
.mansion.selected { color: var(--orbit-cyan); }
.mansion.selected .constellation-line { opacity: .34; }
.mansion.selected .cluster-star { opacity: .82; }
.mansion.selected .mansion-star {
  fill: var(--orbit-cyan);
  stroke: white;
  stroke-width: 1.5;
  opacity: 1;
  filter: url(#mansion-halo);
}
.mansion.selected .label text {
  fill: var(--orbit-cyan);
  font-size: 40px;
  font-weight: 600;
  opacity: 1;
  stroke: color-mix(in srgb, var(--orbit-cyan) 16%, transparent);
  stroke-width: 5px;
  filter: drop-shadow(0 0 9px color-mix(in srgb, var(--orbit-cyan) 58%, transparent));
}
.interaction-ring {
  fill: none;
  stroke: transparent;
  stroke-width: 100;
  pointer-events: stroke;
  touch-action: none;
  cursor: grab;
}
.dragging .interaction-ring { cursor: grabbing; }
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 700px) {
  .celestial-orbit {
    top: 0;
    width: 760px;
    height: 760px;
  }
  .label text { font-size: 18px; }
  .mansion.selected .label text { font-size: 42px; }
}
</style>
