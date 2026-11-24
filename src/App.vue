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
      <span v-for="p in H.parties.filter((p) => count[p.key])" :key="p.key" class="lg" :title="`${count[p.key] ?? 0} 人次（民選，同一人連任算一次）`"><i :style="{ background: COLOR[p.key] }"></i>{{ p.label }}</span>
      <span class="lg"><i :style="{ background: UNKNOWN }"></i>黨籍不詳</span>
      <span class="lg" title="代理：那一格的黨色壓暗"><i class="acting"></i>代理</span>
      <span class="lg" title="非民選（官派、戰地政務）：那一格的黨色加斜線"><i class="noted"></i>非民選</span>
      <span class="credit">
        <span class="ver" title="版本">v{{ VERSION }}</span>
        <a href="https://github.com/szfftz/taiwan-mayoral-and-county-magistrate" target="_blank" rel="noopener">szfftz</a>
      </span>
    </footer>
  </div>
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import Chrono from './Chrono.vue'
import { COLOR, UNKNOWN } from './parties.js'
import { H, count } from './shared.js'
import { mode } from './mode.js'
import { theme, toggleTheme } from './theme.js'

const MapView = defineAsyncComponent(() => import('./MapView.vue'))
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
.foot { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 6px 12px; border-top: 1px solid var(--line); background: var(--chrome); font-size: 12px; }
.lg { display: flex; align-items: center; gap: 6px; padding: 2px 9px 2px 7px; border-radius: 999px; background: rgba(var(--fg), 0.045); color: var(--muted); white-space: nowrap; }
.lg i { flex: none; width: 10px; height: 10px; border-radius: 3px; }
.lg i.noted { width: 16px; background: #aeaeb2 repeating-linear-gradient(135deg, rgba(var(--shade), 0.75) 0 2px, transparent 2px 5px); } /* 示範用灰色，不是某一黨 */
.lg i.acting { width: 16px; background: linear-gradient(90deg, #aeaeb2 50%, #68686b 50%); } /* 左：原本的顏色，右：壓暗後 */
.credit { display: flex; align-items: center; gap: 8px; margin-left: auto; padding-left: 12px; white-space: nowrap; }
.credit .ver { padding: 1px 7px; border: 1px solid var(--line); border-radius: 999px; color: var(--dim); font-size: 11px; font-variant-numeric: tabular-nums; }
.credit a { color: var(--muted); font-weight: 500; }
.credit a:hover { color: var(--accent); }
/* 手機版面：圖例不換行，放不下用滑的 */
@media (max-width: 720px) {
  .bar { gap: 8px; padding: 6px 8px; }
  .bar h1 { font-size: 15px; }
  .foot { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .foot::-webkit-scrollbar { display: none; }
}
</style>
