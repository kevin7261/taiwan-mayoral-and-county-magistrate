<template>
  <!-- 整頁：標題、分頁的內容（編年表／地圖，切換鈕在各自工具列的最前面）、頁尾的圖例 -->
  <div class="page">
    <header class="bar">
      <h1>台灣縣市長年表</h1>
      <!-- 日／夜模式：顯示的是按下去會變成的那一個 -->
      <button type="button" class="btn btn-sm btn-tb theme" :title="theme === 'dark' ? '切換成日間模式' : '切換成夜間模式'" :aria-label="theme === 'dark' ? '切換成日間模式' : '切換成夜間模式'" @click="toggleTheme">
        <span class="material-symbols-outlined">{{ theme === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
      </button>
    </header>

    <!-- 編年表留著不卸掉（切回來時縮放、捲到哪裡都還在）；地圖第一次點才載入（界線檔比較大） -->
    <Chrono v-show="mode === 'chrono'" :active="mode === 'chrono'" />
    <MapView v-if="mode === 'map'" />

    <footer class="foot">
      <!-- 圖例：放不下時先換成簡稱（國、民、眾…）；還是放不下，排不進這一行的就不顯示（右邊的版本、名字比較重要，一定留著） -->
      <div ref="lgs" class="lgs" :class="{ short }">
        <span v-for="l in LEGEND" :key="l.label" class="lg" :title="l.tip"><i :class="l.cls" :style="l.color && { background: l.color }"></i><span class="full">{{ l.label }}</span><span class="abbr">{{ l.abbr }}</span></span>
      </div>
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
import Loading from './Loading.vue'
import { COLOR, UNKNOWN } from './parties.js'
import { H, count } from './shared.js'
import { mode } from './mode.js'
import { theme, toggleTheme } from './theme.js'

// 地圖分頁第一次打開才載入（界線檔比較大）；載的時候中間顯示「載入中」。頁尾有 margin-top: auto，中間還沒東西的時候也留在最下面，不會跑上來
const MapView = defineAsyncComponent({ loader: () => import('./MapView.vue'), loadingComponent: Loading, delay: 0 })
// 頁尾的圖例：有人當選過的政黨（照資料的順序）、黨籍不詳、代理、非民選；abbr＝畫面窄的時候用的簡稱
const ABBR = { kmt: '國', dpp: '民', tpp: '眾', ind: '無', pfp: '親', np: '新', csdp: '民社', cyp: '青', nnc: '新國' }
const LEGEND = [
  ...H.parties.filter((p) => count[p.key]).map((p) => ({ label: p.label, abbr: ABBR[p.key] ?? p.label, color: COLOR[p.key], tip: `${p.label}：${count[p.key]} 人次（民選，同一人連任算一次）` })),
  { label: '黨籍不詳', abbr: '不詳', color: UNKNOWN, tip: '黨籍不詳' },
  { label: '代理', abbr: '代理', cls: 'acting', tip: '代理：那一格的黨色壓暗' },
  { label: '非民選', abbr: '非民選', cls: 'noted', tip: '非民選（官派、戰地政務）：那一格的黨色加斜線' },
]
// 全名排不排得下：量一次全名那一排總共要多寬，之後寬度變了就比一比
const lgs = ref(null), short = ref(false)
let need = 0, ro
function fit() {
  const el = lgs.value
  if (!el?.clientWidth) return
  if (!need && !short.value) need = [...el.children].reduce((w, c) => w + c.offsetWidth, 0) + 12 * (el.children.length - 1)
  short.value = need > el.clientWidth + 0.5
}
onMounted(() => {
  ro = new ResizeObserver(fit)
  ro.observe(lgs.value)
  document.fonts?.ready.then(() => { need = 0; short.value = false; requestAnimationFrame(fit) }) // 字型載好後寬度會變：重量
})
onBeforeUnmount(() => ro?.disconnect())
const VERSION = __APP_VERSION__ // package.json 的 version（vite.config.js 的 define）
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100%; }
/* 標題放中間 */
.bar { position: relative; flex: none; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--line); background: var(--chrome); }
.bar h1 { min-width: 0; margin: 0; text-align: center; overflow: hidden; text-overflow: ellipsis; font-size: 17px; font-weight: 700; line-height: 1.3; letter-spacing: 0.06em; white-space: nowrap; }
/* 日／夜切換：貼右邊，標題照樣在正中間 */
.bar .theme { position: absolute; right: 12px; top: 50%; translate: 0 -50%; }
/* 頁尾：圖例（一顆一顆圓角的標籤）、版本、名字 */
.foot { flex: none; margin-top: auto; display: flex; flex-wrap: nowrap; align-items: center; gap: 6px; padding: 6px 12px; border-top: 1px solid var(--line); background: var(--chrome); font-size: 12px; }
/* 圖例那一排：只有一行高，排不進這一行的（換到第二行的）整顆被裁掉＝不顯示 */
.lgs { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0 12px; height: 22px; overflow: hidden; }
.lgs .abbr, .lgs.short .full { display: none; }
.lgs.short .abbr { display: inline; }
.lgs.short .lg { gap: 4px; }
.lg { flex: none; height: 22px; display: flex; align-items: center; gap: 5px; color: var(--muted); white-space: nowrap; } /* 只有色塊＋字，沒有外面那一圈膠囊 */
.lg i { flex: none; width: 10px; height: 10px; border-radius: 3px; }
.lg i.noted { width: 16px; background: #aeaeb2 repeating-linear-gradient(135deg, rgba(var(--shade), 0.75) 0 2px, transparent 2px 5px); } /* 示範用灰色，不是某一黨 */
.lg i.acting { width: 16px; background: linear-gradient(90deg, #aeaeb2 50%, #68686b 50%); } /* 左：原本的顏色，右：壓暗後 */
.credit { flex: none; display: flex; align-items: center; gap: 8px; margin-left: auto; padding-left: 6px; white-space: nowrap; }
.credit .ver { padding: 1px 7px; border: 1px solid var(--line); border-radius: 999px; color: var(--dim); font-size: 11px; font-variant-numeric: tabular-nums; }
.credit a { color: var(--muted); font-weight: 500; }
.credit a:hover { color: var(--accent); }
@media (max-width: 720px) {
  .bar { gap: 8px; padding: 6px 8px; }
  .bar h1 { font-size: 15px; }
}
</style>
