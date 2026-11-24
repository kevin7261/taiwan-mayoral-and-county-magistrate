<template>
  <!-- 滑鼠移到格子／縣市上的資訊卡：照片（維基百科條目的主圖，有才放）、名字、註記、生卒、黨籍、任期 -->
  <div v-if="tip" class="tipcard" :style="tip.pos">
    <img v-if="tip.photo" :src="tip.photo" alt="" />
    <div class="tc-body">
      <div class="tc-name">{{ tip.name }}<span v-for="g in tip.tags" :key="g" class="badge">{{ g }}</span></div>
      <div v-if="tip.life" class="tc-row tc-life">{{ tip.life }}</div>
      <div class="tc-row"><i :style="{ background: tip.color }"></i>{{ tip.party }}</div>
      <div class="tc-row tc-unit">{{ tip.unit }}</div>
      <div class="tc-row tc-date">{{ tip.from }} – {{ tip.to }}</div>
      <div class="tc-row tc-dim">在任 {{ tip.dur }}<template v-if="tip.terms > 1">・連任，共 {{ tip.terms }} 任</template></div>
      <div v-if="tip.note" class="tc-row tc-dim">{{ tip.note }}</div>
      <div class="tc-row tc-link"><span class="material-symbols-outlined">open_in_new</span>點一下開維基百科</div>
    </div>
  </div>
</template>

<script setup>
defineProps({ tip: { type: Object, default: null } })
</script>

<style scoped>
.tipcard { position: fixed; z-index: 20; display: flex; gap: 12px; width: max-content; max-width: 300px; padding: 12px; border: 1px solid #3a3d3f; border-radius: 10px; background: rgba(28, 30, 31, 0.97); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55); color: var(--text); font-size: 12px; line-height: 1.5; pointer-events: none; }
.tipcard img { flex: none; width: 72px; height: 96px; border-radius: 6px; object-fit: cover; object-position: top; background: #2a2c2d; }
.tc-body { min-width: 0; }
.tc-name { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 16px; font-weight: 700; line-height: 1.3; }
.tc-name .badge { padding: 2px 6px; border-radius: 4px; background: #3d4144; color: var(--text); font-size: 11px; font-weight: 500; }
.tc-row { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.tc-row i { flex: none; width: 10px; height: 10px; border-radius: 2px; }
.tc-unit { color: var(--muted); }
.tc-life { margin: -2px 0 4px; color: var(--muted); font-variant-numeric: tabular-nums; }
.tc-date { margin-top: 4px; font-variant-numeric: tabular-nums; }
.tc-dim { color: var(--dim); white-space: normal; }
.tc-link { margin-top: 6px; gap: 3px; color: var(--accent); font-size: 11px; }
.tc-link .material-symbols-outlined { font-size: 14px; }
</style>
