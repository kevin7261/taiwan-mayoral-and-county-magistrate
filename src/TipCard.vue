<template>
  <!-- 資訊卡：照片（維基百科條目的主圖，有才放）、名字、註記、生卒、黨籍、任期。
       滑鼠：跟著游標的浮動卡；觸控（tip.sheet）：點一下格子／縣市，從畫面下面出來的一張卡，裡面有開維基的按鈕 -->
  <div v-if="tip" class="tipcard kcard" :class="{ sheet: tip.sheet, pin: tip.pin }" :style="tip.sheet ? null : tip.pos" @pointerdown.stop @click.stop>
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
defineProps({ tip: { type: Object, default: null } })
defineEmits(['close'])
</script>

<style scoped>
.tipcard { position: fixed; z-index: 20; display: flex; gap: 12px; width: max-content; max-width: 300px; padding: var(--card-pad); color: var(--text); font-size: 12px; line-height: 1.5; pointer-events: none; }
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
.tipcard.pin { pointer-events: auto; max-width: 340px; }
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
