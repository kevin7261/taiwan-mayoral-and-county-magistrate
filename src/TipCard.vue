<template>
  <!-- 資訊卡：照片（維基百科條目的主圖，有才放）、名字、註記、生卒、黨籍、任期。
       滑鼠：跟著游標的浮動卡；觸控（tip.sheet）：點一下格子／縣市，從畫面下面出來的一張卡，裡面有開維基的按鈕 -->
  <div v-if="tip" class="tipcard kcard" :class="{ sheet: tip.sheet, pin: tip.pin }" ref="el" :style="tip.sheet ? null : { ...tip.pos, transform: `translate(${shift.x}px, ${shift.y}px)` }" @pointerdown.stop @click.stop>
    <img v-if="tip.photo" :src="tip.photo" alt="" />
    <div class="tc-body">
      <div class="tc-name kcard-title">{{ tip.name }}<span v-for="g in tip.tags" :key="g" class="badge">{{ g }}</span></div>
      <!-- plain＝只有名字和連結的卡（縣市）；其他是人的卡：生卒、黨籍、任期 -->
      <div v-if="tip.plain" class="tc-row tc-unit">{{ tip.unit }}</div>
      <template v-else>
        <div v-if="tip.life" class="tc-row tc-life">{{ tip.life }}</div>
        <div class="tc-row"><i class="dot" :style="{ background: tip.color }"></i>{{ tip.party }}</div>
        <div class="tc-row tc-unit">{{ tip.unit }}</div>
        <div class="tc-row tc-date">{{ tip.from }} – {{ tip.to }}</div>
        <div class="tc-row tc-dim">在任 {{ tip.dur }}<template v-if="tip.terms > 1">・連任，共 {{ tip.terms }} 任</template></div>
      </template>
      <div v-if="tip.note" class="tc-row tc-dim">{{ tip.note }}</div>
      <a v-if="tip.sheet || tip.pin" class="btn btn-sm btn-tb active tc-open" :href="tip.url" target="_blank" rel="noopener"><span class="material-symbols-outlined">open_in_new</span>維基百科</a>
    </div>
    <button v-if="tip.sheet || tip.pin" type="button" class="btn btn-sm btn-tb tc-close" aria-label="關閉" @click="$emit('close')"><span class="material-symbols-outlined">close</span></button>
  </div>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue'

const props = defineProps({ tip: { type: Object, default: null } })
defineEmits(['close'])

// 卡片不可以超出瀏覽器的畫面：位置先照游標放（shared.js 的 tipPos），畫出來之後量實際的大小，
// 哪一邊超出去就往回推（四邊各留 8px）。內容、位置一變就重量一次
const el = ref(null), shift = reactive({ x: 0, y: 0 })
const M = 8
watch(() => props.tip, async (t) => {
  if (!t || t.sheet) return
  await nextTick()
  if (!el.value) return
  const r = el.value.getBoundingClientRect(), x = r.left - shift.x, y = r.top - shift.y // 沒推過的位置
  shift.x = Math.round(Math.max(M - x, Math.min(0, innerWidth - M - (x + r.width))))
  shift.y = Math.round(Math.max(M - y, Math.min(0, innerHeight - M - (y + r.height))))
}, { flush: 'post' })
</script>

<style scoped>
.tipcard { position: fixed; z-index: 20; display: flex; gap: 12px; width: max-content; max-width: min(300px, calc(100vw - 16px)); max-height: calc(100dvh - 16px); overflow: hidden; padding: var(--card-pad); color: var(--text); font-size: 12px; line-height: 1.5; pointer-events: none; }
.tipcard img { flex: none; width: 72px; height: 96px; border-radius: 8px; object-fit: cover; object-position: top; background: var(--btn); }
.tc-body { min-width: 0; }
.tc-name { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 4px; }
.tc-name .badge { padding: 2px 6px; border-radius: 999px; background: rgba(var(--fg), 0.1); color: var(--text); font-size: 11px; font-weight: 500; }
.tc-row { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.tc-unit { color: var(--muted); }
.tc-life { margin: -2px 0 4px; color: var(--muted); font-variant-numeric: tabular-nums; }
.tc-date { margin-top: 4px; font-variant-numeric: tabular-nums; }
.tc-dim { color: var(--dim); white-space: normal; }
/* 點了固定住的卡（滑鼠）：可以點裡面的連結 */
.tipcard.pin { pointer-events: auto; max-width: min(340px, calc(100vw - 16px)); }
.tipcard.pin .tc-open { --bs-btn-padding-y: 4px; --bs-btn-padding-x: 10px; --bs-btn-font-size: 12px; margin-top: 8px; }
/* 觸控：畫面下面的一張卡 */
.tipcard.sheet { left: 8px; right: 8px; bottom: calc(8px + env(safe-area-inset-bottom)); width: auto; max-width: none; padding: 14px; font-size: 13px; pointer-events: auto; animation: up 0.18s ease-out; }
.tipcard.sheet img { width: 84px; height: 112px; }
.tipcard.sheet .tc-body { flex: 1; }
.tc-open { margin-top: 10px; --bs-btn-padding-y: 7px; --bs-btn-padding-x: 12px; --bs-btn-font-size: 13px; }
/* 關閉鈕固定在卡片右上角（內容多寡都不會把它擠到下面） */
.tipcard.sheet, .tipcard.pin { padding-right: 46px; }
.tc-close { position: absolute; right: 8px; top: 8px; --bs-btn-padding-y: 6px; --bs-btn-padding-x: 6px; }
@keyframes up { from { transform: translateY(16px); opacity: 0; } }
</style>
