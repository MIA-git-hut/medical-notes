<script setup lang="ts">
defineProps<{
  id: 'east' | 'west' | 'south' | 'north'
}>()
</script>

<template>
  <g
    fill="none"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <template v-if="id === 'east'">
      <path d="M22 76 C34 64 30 50 44 46 C54 43 54 30 44 24 C38 20 32 22 30 28" />
      <path d="M34 26 L40 14 M34 26 L46 16" stroke-width="2" />
      <path d="M36 30 C30 33 28 38 30 44 M36 30 C42 33 44 38 42 44" stroke-width="1.6" />
      <circle cx="32" cy="31" r="1.8" fill="currentColor" stroke="none" />
      <path d="M40 52 C34 55 30 60 32 66" stroke-width="2" />
      <path d="M40 60 C36 64 34 68 36 74" stroke-width="2" />
      <path d="M26 72 C20 74 16 70 18 64 C19 60 24 58 27 60" stroke-width="1.6" />
      <path d="M28 78 C24 82 18 82 16 78" stroke-width="1.6" />
    </template>

    <template v-else-if="id === 'west'">
      <path d="M50 22 C66 22 78 34 78 50 C78 68 64 80 50 80 C36 80 22 68 22 50 C22 34 34 22 50 22" />
      <path d="M32 30 L28 16 L42 24" stroke-width="2.4" />
      <path d="M68 30 L72 16 L58 24" stroke-width="2.4" />
      <path d="M38 40 h24 M50 36 v16 M38 50 h24" stroke-width="2.2" />
      <circle cx="35" cy="58" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="65" cy="58" r="2.4" fill="currentColor" stroke="none" />
      <path d="M50 63 L45 69 L55 69 Z" stroke-width="2" />
      <path d="M42 74 Q50 80 58 74" stroke-width="2.2" />
      <path d="M24 44 Q30 48 26 56 M76 44 Q70 48 74 56" stroke-width="1.8" />
    </template>

    <template v-else-if="id === 'south'">
      <path d="M50 62 C44 56 36 52 30 52 C32 42 42 38 50 38 C58 38 68 42 70 52 C64 52 56 56 50 62" />
      <path d="M34 50 C24 46 14 40 8 32 C16 36 26 40 34 46" stroke-width="2.2" />
      <path d="M66 50 C76 46 86 40 92 32 C84 36 74 40 66 46" stroke-width="2.2" />
      <path d="M50 64 L45 84 M50 66 L51 86 M50 66 L57 82" stroke-width="2.2" />
      <path d="M50 36 C50 30 54 28 60 30" stroke-width="2" />
      <circle cx="46" cy="44" r="1.8" fill="currentColor" stroke="none" />
      <path d="M52 40 L60 38 L54 45 Z" stroke-width="1.8" />
    </template>

    <template v-else>
      <path d="M28 46 C28 30 38 24 50 24 C62 24 72 30 72 46 C72 62 62 68 50 68 C38 68 28 62 28 46" />
      <path d="M50 24 C50 46 50 56 50 68" stroke-width="2" />
      <path d="M33 34 C40 42 60 42 67 34 M30 46 C38 54 62 54 70 46 M33 58 C40 64 60 64 67 58" stroke-width="1.8" />
      <path d="M50 68 L50 78" stroke-width="2.4" />
      <path d="M28 52 L18 55 M72 52 L82 55" stroke-width="2.4" />
      <path d="M34 30 C20 34 16 48 26 56 C34 62 46 60 50 52" stroke-width="2.2" />
      <path d="M26 56 L14 58 L18 48" stroke-width="2.4" />
      <circle cx="21" cy="51" r="1.6" fill="currentColor" stroke="none" />
    </template>
  </g>
</template>
