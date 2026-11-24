<template>
  <!-- 資訊卡：照片（維基百科條目的主圖，有才放）、名字、註記、生卒、黨籍、任期。
       滑鼠：跟著游標的浮動卡；觸控（tip.sheet）：點一下格子／縣市，從畫面下面出來的一張卡，裡面有開維基的按鈕 -->
  <div v-if="tip" class="tipcard" :class="{ sheet: tip.sheet }" :style="tip.sheet ? null : tip.pos">
    <img v-if="tip.photo" :src="tip.photo" alt="" />
    <div class="tc-body">
      <div class="tc-name">{{ tip.name }}<span v-for="g in tip.tags" :key="g" class="badge">{{ g }}</span></div>
      <div v-if="tip.life" class="tc-row tc-life">{{ tip.life }}</div>
      <div class="tc-row"><i :style="{ background: tip.color }"></i>{{ tip.party }}</div>
      <div class="tc-row tc-unit">{{ tip.unit }}</div>
      <div class="tc-row tc-date">{{ tip.from }} – {{ tip.to }}</div>
      <div class="tc-row tc-dim">在任 {{ tip.dur }}<template v-if="tip.terms > 1">・連任，共 {{ tip.terms }} 任</template></div>
      <div v-if="tip.note" class="tc-row tc-dim">{{ tip.note }}</div>
      <a v-if="tip.sheet" class="btn btn-sm btn-tb active tc-open" :href="tip.url" target="_blank" rel="noopener"><span class="material-symbols-outlined">open_in_new</span>開維基百科</a>
      <div v-else class="tc-row tc-link"><span class="material-symbols-outlined">open_in_new</span>點一下開維基百科</div>
    </div>
    <button v-if="tip.sheet" type="button" class="btn btn-sm btn-tb tc-close" aria-label="關閉" @click="$emit('close')"><span class="material-symbols-outlined">close</span></button>
  </div>
</template>

<script setup>
defineProps({ tip: { type: Object, default: null } })
defineEmits(['close'])
</script>

<style scoped>
.tipcard { position: fixed; z-index: 20; display: flex; gap: 12px; width: max-content; max-width: 300px; padding: 12px; border: 1px solid #48484a; border-radius: 14px; background: rgba(44, 44, 46, 0.82); -webkit-backdrop-filter: blur(14px) saturate(1.3); backdrop-filter: blur(14px) saturate(1.3); box-shadow: var(--shadow); color: var(--text); font-size: 12px; line-height: 1.5; pointer-events: none; }
.tipcard img { flex: none; width: 72px; height: 96px; border-radius: 10px; object-fit: cover; object-position: top; background: #3a3a3c; }
.tc-body { min-width: 0; }
.tc-name { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 16px; font-weight: 700; line-height: 1.3; }
.tc-name .badge { padding: 2px 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.1); color: var(--text); font-size: 11px; font-weight: 500; }
.tc-row { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.tc-row i { flex: none; width: 10px; height: 10px; border-radius: 3px; }
.tc-unit { color: var(--muted); }
.tc-life { margin: -2px 0 4px; color: var(--muted); font-variant-numeric: tabular-nums; }
.tc-date { margin-top: 4px; font-variant-numeric: tabular-nums; }
.tc-dim { color: var(--dim); white-space: normal; }
.tc-link { margin-top: 6px; gap: 3px; color: var(--accent); font-size: 11px; }
.tc-link .material-symbols-outlined { font-size: 14px; }
/* 觸控：畫面下面的一張卡 */
.tipcard.sheet { left: 8px; right: 8px; bottom: calc(8px + env(safe-area-inset-bottom)); width: auto; max-width: none; padding: 14px; font-size: 13px; pointer-events: auto; animation: up 0.18s ease-out; }
.tipcard.sheet img { width: 84px; height: 112px; }
.tipcard.sheet .tc-body { flex: 1; }
.tc-open { margin-top: 10px; --bs-btn-padding-y: 7px; --bs-btn-padding-x: 12px; --bs-btn-font-size: 13px; }
.tc-close { align-self: flex-start; --bs-btn-padding-y: 6px; --bs-btn-padding-x: 6px; }
@keyframes up { from { transform: translateY(16px); opacity: 0; } }
</style>
