<script setup lang="ts">
import catalog from '../../../content/astronomy/mansions.json'
import { projectAsterism } from '../../../shared/star-projection'
const charts = catalog.mansions.map(mansion => {
  const stars = projectAsterism(mansion.stars, 108)
  const positions = new Map(stars.map(star => [star.hip, star]))
  return { ...mansion, stars, paths: mansion.lines.map(line => line.map(hip => {
    const star = positions.get(hip)!
    return `${star.x},${star.y}`
  }).join(' ')) }
})
</script>

<template>
  <div class="star-atlas">
    <figure v-for="chart in charts" :key="chart.name">
      <svg viewBox="-75 -75 150 150" role="img" :aria-label="`${chart.name}宿星图`">
        <polyline v-for="(line, i) in chart.paths" :key="i" :points="line" />
        <circle v-for="star in chart.stars" :key="star.hip" :cx="star.x" :cy="star.y" :r="Math.max(1.2, 3.3 - star.magnitude * .3)">
          <title>HIP {{ star.hip }} · 赤经 {{ star.ra }}° · 赤纬 {{ star.dec }}°</title>
        </circle>
      </svg>
      <figcaption><strong>{{ chart.name }}宿</strong><span>{{ chart.stars.length }} 颗已核对主星</span></figcaption>
      <p v-if="chart.missingOrdinals.length" class="incomplete">源表缺 {{ chart.missingOrdinals.length }} 颗，待补核</p>
    </figure>
  </div>
</template>

<style scoped>
.star-atlas { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 14px; margin: 28px 0; }
figure { margin: 0; padding: 14px; border: 1px solid var(--vp-c-divider); border-radius: 14px; background: var(--vp-c-bg-soft); }
svg { display: block; width: 100%; color: var(--vp-c-brand-1); }
polyline { fill: none; stroke: currentColor; stroke-width: .8; opacity: .6; }
circle { fill: currentColor; }
figcaption { display: flex; flex-direction: column; text-align: center; gap: 4px; }
figcaption strong { font-size: 19px; }
figcaption span, .incomplete { font-size: 12px; color: var(--vp-c-text-2); }
.incomplete { text-align: center; margin: 4px 0 0; }
</style>
