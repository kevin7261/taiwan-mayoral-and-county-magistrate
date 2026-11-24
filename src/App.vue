<template>
  <!-- 整頁：標題＋兩個分頁（編年表／地圖）、分頁的內容、頁尾的圖例 -->
  <div class="page">
    <header class="bar">
      <h1>台灣縣市長年表</h1>
      <!-- 分頁放在標題下面 -->
      <nav class="btn-group btn-group-sm tabs" role="tablist" aria-label="分頁">
        <button v-for="[k, l] in TABS" :key="k" type="button" role="tab" class="btn btn-sm btn-outline-secondary" :class="{ active: mode === k }" :aria-selected="mode === k" @click="go(k)">{{ l }}</button>
      </nav>
    </header>

    <!-- 編年表留著不卸掉（切回來時縮放、捲到哪裡都還在）；地圖第一次點才載入（界線檔比較大） -->
    <Chrono v-show="mode === 'chrono'" :active="mode === 'chrono'" />
    <MapView v-if="mode === 'map'" />

    <footer class="foot">
      <span v-for="p in H.parties.filter((p) => count[p.key])" :key="p.key" class="lg" :title="`${count[p.key] ?? 0} 人次（民選，同一人連任算一次）`"><i :style="{ background: COLOR[p.key] }"></i>{{ p.label }}</span>
      <span class="lg"><i :style="{ background: UNKNOWN }"></i>黨籍不詳</span>
      <span class="lg"><i class="acting" :style="{ background: COLOR.kmt }"></i>代理</span>
      <span class="lg"><i class="noted" :style="{ background: COLOR.kmt }"></i>非民選</span>
      <span class="credit">
        <span class="ver" title="版本">v{{ VERSION }}</span>
        <a href="https://github.com/szfftz/taiwan-mayoral-and-county-magistrate" target="_blank" rel="noopener">szfftz</a>
      </span>
    </footer>
  </div>
</template>

<script setup>
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import Chrono from './Chrono.vue'
import { COLOR, UNKNOWN } from './parties.js'
import { H, count } from './shared.js'

const MapView = defineAsyncComponent(() => import('./MapView.vue'))
const VERSION = __APP_VERSION__ // package.json 的 version（vite.config.js 的 define）
const TABS = [['chrono', '編年表'], ['map', '地圖']]

// 分頁記在網址的 #（#map＝地圖），重新整理、貼連結都會開在同一頁
const fromHash = () => (location.hash === '#map' ? 'map' : 'chrono')
const mode = ref(fromHash())
function go(k) {
  mode.value = k
  history.replaceState(null, '', k === 'map' ? '#map' : location.pathname + location.search)
}
const onHash = () => (mode.value = fromHash())
onMounted(() => window.addEventListener('hashchange', onHash))
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash))
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100%; }
.bar, .foot { flex: none; display: flex; align-items: center; gap: 4px 12px; padding: 6px 12px; font-size: 12px; background: var(--chrome); }
/* 標題放正中間，下面一列是分頁 */
.bar { flex-direction: column; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.bar h1 { margin: 0; text-align: center; font-size: 15px; font-weight: 700; line-height: 1.5; white-space: nowrap; }
.tabs .btn { --bs-btn-padding-y: 2px; --bs-btn-padding-x: 12px; }
.foot { flex-wrap: wrap; border-top: 1px solid var(--line); padding: 4px 12px; }
.lg { display: flex; align-items: center; gap: 5px; color: var(--muted); white-space: nowrap; }
.lg i { width: 14px; height: 10px; border-radius: 2px; }
.lg i.noted { background-image: repeating-linear-gradient(135deg, rgba(22, 22, 22, 0.4) 0 2px, transparent 2px 6px); }
.lg i.acting { box-shadow: inset 0 0 0 20px rgba(22, 22, 22, 0.45); }
.credit { display: flex; gap: 8px; margin-left: auto; padding-left: 12px; white-space: nowrap; }
.credit .ver { color: var(--dim); font-variant-numeric: tabular-nums; }
.credit a { color: var(--dim); }
.credit a:hover { color: var(--accent); }
/* 手機版面：圖例不換行，放不下用滑的 */
@media (max-width: 720px) {
  .bar { gap: 4px; padding: 6px 8px; }
  .bar h1 { font-size: 14px; }
  .foot { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .foot::-webkit-scrollbar { display: none; }
}
</style>
