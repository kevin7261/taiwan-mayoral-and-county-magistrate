<template>
  <!-- 工具列最前面的一組：切換編年表／地圖（兩個分頁的工具列都放） -->
  <div class="tb-grp" role="tablist" aria-label="分頁">
    <button v-for="[k, l] in TABS" :key="k" type="button" role="tab" class="btn btn-sm btn-tb" :class="{ active: mode === k }" :aria-selected="mode === k" @click="setMode(k)">{{ l }}</button>
  </div>
  <div class="vr"></div>
</template>

<script setup>
import { TABS, mode, setMode } from './mode.js'
</script>
