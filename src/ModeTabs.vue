<template>
  <!-- 工具列最前面的兩組（兩個分頁的工具列都放）：切換編年表／地圖、時間的方向 -->
  <div class="tb-grp" role="tablist" aria-label="分頁">
    <button v-for="[k, l] in TABS" :key="k" type="button" role="tab" class="btn btn-sm btn-tb" :class="{ active: mode === k }" :aria-selected="mode === k" @click="setMode(k)">{{ l }}</button>
  </div>
  <div class="vr"></div>
  <!-- 時間的方向：近到遠（預設）／遠到近 -->
  <div class="tb-grp" role="radiogroup" aria-label="時間方向">
    <button v-for="[k, l, tip] in ORDERS" :key="l" type="button" role="radio" class="btn btn-sm btn-tb" :class="{ active: rev === k }" :aria-checked="rev === k" :title="tip" @click="rev = k">{{ l }}</button>
  </div>
</template>

<script setup>
import { ORDERS, TABS, mode, rev, setMode } from './mode.js'
</script>
